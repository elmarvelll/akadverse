import { elearningDb } from "@/lib/db/elearning";
import { notFound, ServiceError } from "@/lib/service-error";
import { requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";
import { aiIngestCallbackUrl, type AiIngestPayload } from "./client";
import { eligibility, safeProcessingError } from "./policy";

export const AI_INGEST_STALE_MS = 30 * 60 * 1000;

export async function loadMaterialForIngestion(materialId: string) {
  return elearningDb.courseMaterial.findUnique({
    where: { id: materialId },
    include: { courseOffering: { include: { curriculumCourse: { include: { course: true, curriculum: { include: { academicSession: true, semester: true } } } } } } },
  });
}
type MaterialForIngestion = NonNullable<Awaited<ReturnType<typeof loadMaterialForIngestion>>>;

// Exported for tests: exactly what the microservice receives. `metadata` is copied onto every chunk.
export function buildIngestPayload(m: MaterialForIngestion, fileUrl: string): AiIngestPayload {
  const { course, curriculum } = m.courseOffering.curriculumCourse;
  return {
    document_id: m.id,
    file_url: fileUrl,
    file_name: m.fileName,
    mime_type: m.mimeType,
    callback_url: aiIngestCallbackUrl(),
    metadata: {
      course_code: course.code,
      course_title: course.title,
      course_offering_id: m.courseOfferingId,
      academic_session: curriculum.academicSession.name,
      semester: curriculum.semester.name,
      start_week: m.startWeek,
      end_week: m.endWeek,
      weeks: Array.from({ length: m.endWeek - m.startWeek + 1 }, (_, i) => m.startWeek + i),
      material_type: m.type,
      title: m.title,
      document_id: m.id,
    },
  };
}


// Compatibility entry point for backfill/manual actions: enqueue, never POST from a request.
export async function sendMaterialForIngestion(materialId: string) {
  return elearningDb.$transaction(async (tx) => {
    const m = await tx.courseMaterial.findUnique({ where: { id: materialId } });
    if (!m) return null;
    const eligible = eligibility(m);
    if (eligible === "ineligible") return null;
    if (eligible === "unsupported") {
      await tx.courseMaterial.update({ where: { id: m.id }, data: { aiIngestStatus: "UNSUPPORTED_FORMAT" } });
      return "UNSUPPORTED_FORMAT" as const;
    }
    // Historical submissions have unknown remote state. Never silently requeue them.
    if (m.aiIngestStatus !== null) return m.aiIngestStatus;
    await tx.aiIngestTask.upsert({ where: { documentId: m.id }, create: { documentId: m.id, materialId: m.id }, update: {} });
    await tx.courseMaterial.update({ where: { id: m.id }, data: { aiIngestStatus: "PENDING", aiIngestUpdatedAt: new Date() } });
    return "PENDING" as const;
  });
}

export interface IngestCallback {
  document_id: string;
  status: "ingested" | "failed";
  chunk_count?: number | null;
  error?: string | null;
}

export function parseIngestCallback(raw: unknown): IngestCallback | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.document_id !== "string" || !b.document_id.trim() || b.document_id.length > 100) return null;
  if (b.status !== "ingested" && b.status !== "failed") return null;
  if (b.status === "ingested" && !(Number.isSafeInteger(b.chunk_count) && (b.chunk_count as number) > 0 && (b.chunk_count as number) <= 2147483647)) return null;
  if (b.error != null && typeof b.error !== "string") return null;
  return { document_id: b.document_id, status: b.status, chunk_count: b.chunk_count as number | undefined, error: b.error as string | undefined };
}

export async function recordIngestCallback(cb: IngestCallback): Promise<boolean> {
  return elearningDb.$transaction(async (tx) => {
    const task = await tx.aiIngestTask.findUnique({ where: { documentId: cb.document_id } });
    if (!task?.materialId || task.operation !== "INGEST") return false;
    // First terminal callback wins. No new attempts are allowed for a remotely submitted ID.
    if (task.callbackAt) return true;
    if (!task.submittedAt) return false;
    const error = cb.status === "failed" ? safeProcessingError(cb.error) : null;
    const claimed = await tx.aiIngestTask.updateMany({
      where: { id: task.id, operation: "INGEST", callbackAt: null },
      data: { state: cb.status === "ingested" ? "DONE" : "ATTENTION", callbackAt: new Date(), lastError: error, claimToken: null, leaseUntil: null },
    });
    if (!claimed.count) return true;
    await tx.courseMaterial.updateMany({ where: { id: task.materialId }, data: {
      aiIngestStatus: cb.status === "ingested" ? "INGESTED" : "FAILED",
      aiChunkCount: cb.status === "ingested" ? cb.chunk_count : null,
      aiIngestError: error, aiIngestUpdatedAt: new Date(),
    } });
    return true;
  });
}

export async function retryMaterialIngestion(facultyUserId: string, materialId: string) {
  const m = await elearningDb.courseMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("That material doesn't exist.");
  await requireLecturer(facultyUserId, m.courseOfferingId);
  if (m.aiIngestStatus !== null) throw new ServiceError(409, "This task requires administrator review before reprocessing.");
  return sendMaterialForIngestion(m.id);
}

// Persist cleanup BEFORE the original record can disappear. An active POST's lease is
// retained so cleanup waits until the bounded local HTTP request has ended.
export async function removeMaterialFromAi(material: { id: string; aiIngestStatus: string | null }) {
  await elearningDb.$transaction(async (tx) => {
    // Serialize against the worker's final pre-POST update before inspecting remote state.
    await tx.$queryRaw`SELECT "id" FROM "AiIngestTask" WHERE "documentId" = ${material.id} FOR UPDATE`;
    const old = await tx.aiIngestTask.findUnique({ where: { documentId: material.id } });
    if (!old && (material.aiIngestStatus === null || material.aiIngestStatus === "UNSUPPORTED_FORMAT")) return;
    await tx.aiIngestTask.upsert({ where: { documentId: material.id },
      create: { documentId: material.id, materialId: material.id, operation: "DELETE", cleanupUncertain: true },
      update: { operation: "DELETE", state: "READY", attempts: 0, claimToken: null,
        cleanupUncertain: old?.cleanupUncertain || Boolean(old?.submittedAt && !old?.callbackAt),
        nextAttemptAt: old?.leaseUntil && old.leaseUntil > new Date() ? old.leaseUntil : new Date(), lastError: null },
    });
  });
}
