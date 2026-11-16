import { createHmac } from "node:crypto";
import { handleRevisionWebhook } from "@/services/e-learning/revision-questions/handler";
import { boundedStewartRequest } from "@/app/api/e-learning/stewart/shared";
import { requireAdmin } from "@/lib/admin";
import { revisionReadiness } from "@/services/e-learning/revision-questions/readiness";
import { ServiceError } from "@/lib/service-error";
import { RevisionWebhookError } from "@/services/e-learning/revision-questions/errors";
import { sourceFingerprint, sourceSnapshot, workspaceEnabled } from "@/services/e-learning/revision-questions/eligibility";
import { elearningDb } from "@/lib/db/elearning";
const headers = { "Cache-Control": "private, no-store" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function respond(work: () => Promise<unknown>) {
  try { await requireAdmin(); return Response.json({ result: await work() }, { headers }); }
  catch (error) { const known = error instanceof ServiceError || error instanceof RevisionWebhookError; return Response.json({ error: known ? error.message : "Operational status is unavailable." }, { status: known ? error.status : 503, headers }); }
}
export async function GET(request: Request) {
  return respond(async () => {
    const params = new URL(request.url).searchParams;
    if (params.has("questions")) {
      if (!workspaceEnabled()) throw new ServiceError(503, "Revisions workspace is disabled.");
      return elearningDb.revisionQuestion.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, stem: true, type: true, governance: true, concept: { select: { title: true, materialId: true } } } });
    }
    const id = params.get("event");
    const [counts, totals, recent, pendingAlerts, analysis, alertQueue] = await Promise.all([
      elearningDb.revisionGenerationJob.groupBy({ by: ["status"], _count: true }),
      elearningDb.revisionGenerationJob.aggregate({ _sum: { generatedCount: true, createdCount: true, reusedCount: true, rejectedCount: true, cardsCreated: true } }),
      elearningDb.revisionGenerationJob.findMany({ where: id ? { teachingEventId: id } : { status: { in: ["FAILED", "NEEDS_REVIEW"] } }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, teachingEventId: true, status: true, attempts: true, errorCode: true, needsReview: true, startedAt: true, completedAt: true, lastAttemptAt: true, generatedCount: true, acceptedCount: true, rejectedCount: true, webhookStatus: true } }),
      elearningDb.revisionAdminAlert.count({ where: { status: "PENDING" } }),
      elearningDb.revisionConceptAnalysisJob.findMany({ where: id ? { id } : { status: { not: "COMPLETED" } }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, materialId: true, status: true, attempts: true, lastErrorCode: true, leaseUntil: true, updatedAt: true } }),
      elearningDb.revisionAdminAlert.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 30, select: { id: true, category: true, correlationId: true, attempts: true, nextAttemptAt: true } }),
    ]);
    const times = await elearningDb.$queryRaw<{ averageMs: number | null }[]>`SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) * 1000)::float8 AS "averageMs" FROM "RevisionGenerationJob" WHERE "completedAt" IS NOT NULL AND "startedAt" IS NOT NULL`;
    return { ...revisionReadiness(), counts, totals: totals._sum, averageGenerationProcessingMs: times[0]?.averageMs ?? null, recent, pendingAlerts, analysis, alertQueue };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) throw new ServiceError(403, "Invalid origin.");
    const input = await (await boundedStewartRequest(request, 2048)).json().catch(() => null);
    if (!input || typeof input !== "object") throw new ServiceError(400, "Invalid operational request.");
    if (input.action === "publication") {
      if (!workspaceEnabled()) throw new ServiceError(503, "Revisions workspace is disabled.");
      if (typeof input.questionId !== "string" || !["PUBLISHED", "SUSPENDED", "RETIRED"].includes(input.status) || (input.status === "PUBLISHED" && input.confirmProvenanceReviewed !== true)) throw new ServiceError(400, "Provide a valid publication status and confirm provenance review before publication.");
      const q = await elearningDb.revisionQuestion.findUnique({ where: { id: input.questionId }, include: { concept: { include: { material: true } } } });
      if (!q) throw new ServiceError(404, "Question unavailable.");
      if (input.status === "PUBLISHED" && (!q.concept.active || q.concept.material.aiIngestStatus !== "INGESTED")) throw new ServiceError(409, "This question's source is not available for publication.");
      return elearningDb.revisionQuestionGovernance.upsert({ where: { questionId: q.id }, create: { questionId: q.id, publicationStatus: input.status, sourceFingerprint: sourceFingerprint(q.concept.material), sourceSnapshot: sourceSnapshot(q.concept.material) }, update: { publicationStatus: input.status, ...(input.status === "PUBLISHED" ? { sourceFingerprint: sourceFingerprint(q.concept.material), sourceSnapshot: sourceSnapshot(q.concept.material) } : {}) } });
    }
    if (input.action === "replay_delivery" && input.confirmReplay === true && typeof input.teachingEventId === "string") {
      const receipt = await elearningDb.revisionWebhookIdempotency.findUnique({ where: { idempotencyKey: `teach_${input.teachingEventId}` } });
      if (!receipt?.requestBody) throw new ServiceError(409, "No authenticated original delivery bytes are available.");
      const secret = process.env.AI_WEBHOOK_SECRET?.trim(); if (!secret) throw new ServiceError(503, "Webhook signing is not configured.");
      const raw = new Uint8Array(receipt.requestBody);
      const response = await handleRevisionWebhook(new Request(new URL("/api/webhooks/tutor/questions", request.url), { method: "POST", headers: { "content-type": "application/json", "idempotency-key": receipt.idempotencyKey, "x-akadverse-timestamp": new Date().toISOString(), "x-akadverse-signature": createHmac("sha256", secret).update(raw).digest("hex") }, body: raw }));
      const result = await response.json(); if (!response.ok) throw new ServiceError(response.status, "Original delivery replay did not complete. Review its receipt and retry guidance.");
      return result;
    }
    if (input.action !== "release_confirmed_stopped" || input.confirmRemoteStopped !== true || typeof input.jobId !== "string") throw new ServiceError(400, "Explicit remote-stop confirmation and job ID are required.");
    if (input.kind === "analysis") {
      const changed = await elearningDb.revisionConceptAnalysisJob.updateMany({ where: { id: input.jobId, status: "FAILED", attempts: { lt: 3 } }, data: { status: "PENDING", claimToken: null, leaseUntil: null, nextAttemptAt: new Date() } });
      if (!changed.count) throw new ServiceError(409, "This analysis cannot be released for retry.");
    } else if (input.kind === "generation") {
      // Release capacity, not a regeneration permission. Original payload replay is still required.
      const changed = await elearningDb.revisionGenerationJob.updateMany({ where: { id: input.jobId, status: "NEEDS_REVIEW" }, data: { status: "FAILED", claimToken: null, leaseUntil: null, errorCode: "ORIGINAL_DELIVERY_REPLAY_REQUIRED" } });
      if (!changed.count) throw new ServiceError(409, "This generation cannot be released.");
    } else throw new ServiceError(400, "Select analysis or generation.");
    return { released: true };
  });
}
