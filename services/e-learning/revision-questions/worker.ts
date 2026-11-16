import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { RevisionGenerationJob, RevisionConceptAnalysisJob } from "@/generated/prisma-elearning";
import { validateAnalysis } from "./analysis-contract";
import { conceptKey } from "./policy";
import { learningRequest, aiConfiguration } from "./providers";
import { RevisionWebhookError } from "./errors";
import { notifyAdmins } from "@/services/marketplace/notifications/notification.service";
import { revisionLog } from "./monitor";
import { refreshRevisionContexts } from "./learning-context";
const retryAt = (attempts: number) => new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1)) * 1000);
export async function queueRevisionAlert(category: string, correlationId: string) {
  await elearningDb.revisionAdminAlert.upsert({ where: { dedupeKey: `${category}:${correlationId}` }, update: {}, create: { category, correlationId, dedupeKey: `${category}:${correlationId}` } });
}
export async function flushRevisionAlerts() {
  const rows = await elearningDb.revisionAdminAlert.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } }, take: 10, orderBy: { createdAt: "asc" } });
  let delivered = 0;
  for (const row of rows) {
    const claimed = await elearningDb.revisionAdminAlert.updateMany({ where: { id: row.id, status: "PENDING", nextAttemptAt: { lte: new Date() } }, data: { nextAttemptAt: new Date(Date.now() + 120000), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      await notifyAdmins({ type: "revision-generation-attention", title: "Revision generation needs review", message: `Revision pipeline issue: ${row.category}. Event/reference: ${row.correlationId}. Inspect the operational status endpoint.`, targetUrl: `/api/e-learning/admin/revision-generation?event=${encodeURIComponent(row.correlationId)}` });
      await elearningDb.revisionAdminAlert.update({ where: { id: row.id }, data: { status: "DELIVERED", deliveredAt: new Date() } }); delivered++;
    } catch {
      await elearningDb.revisionAdminAlert.update({ where: { id: row.id }, data: { nextAttemptAt: retryAt(row.attempts + 1) } });
      console.warn("[revision-questions] admin notification retry scheduled", { correlationId: row.correlationId });
    }
  }
  return delivered;
}
export async function claimRevisionWork() {
  return elearningDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72419039)::text`;
    const now = new Date();
    const stale = await tx.revisionGenerationJob.findMany({ where: { status: "PROCESSING", leaseUntil: { lt: now } }, select: { id: true, teachingEventId: true, needsReview: true } });
    for (const row of stale) {
      const receipt = await tx.revisionWebhookIdempotency.findUnique({ where: { idempotencyKey: `teach_${row.teachingEventId}` } });
      if (receipt?.status === "COMPLETED") await tx.revisionGenerationJob.update({ where: { id: row.id }, data: { status: row.needsReview ? "NEEDS_REVIEW" : "COMPLETED", completedAt: receipt.completedAt, webhookStatus: "processed", claimToken: null, leaseUntil: null } });
      else {
        await tx.revisionGenerationJob.update({ where: { id: row.id }, data: { status: "NEEDS_REVIEW", needsReview: true, errorCode: "DISPATCH_UNCERTAIN" } });
        await tx.revisionAdminAlert.upsert({ where: { dedupeKey: `uncertain:${row.id}` }, update: {}, create: { dedupeKey: `uncertain:${row.id}`, category: "DISPATCH_UNCERTAIN", correlationId: row.teachingEventId } });
      }
    }
    const analysisStale = await tx.revisionConceptAnalysisJob.findMany({ where: { status: "PROCESSING", leaseUntil: { lt: now } }, select: { id: true } });
    for (const row of analysisStale) {
      await tx.revisionConceptAnalysisJob.update({ where: { id: row.id }, data: { status: "FAILED", lastErrorCode: "ANALYSIS_UNCERTAIN" } });
      await tx.revisionAdminAlert.upsert({ where: { dedupeKey: `analysis:${row.id}` }, update: {}, create: { dedupeKey: `analysis:${row.id}`, category: "ANALYSIS_UNCERTAIN", correlationId: row.id } });
    }
    // Quarantined uncertain requests keep their slot. No remote cancellation contract exists.
    const occupied = await tx.revisionGenerationJob.count({ where: { claimToken: { not: null } } }) + await tx.revisionConceptAnalysisJob.count({ where: { claimToken: { not: null } } });
    if (occupied >= 2) return null;
    const generation = await tx.revisionGenerationJob.findFirst({ where: { status: "PENDING", nextAttemptAt: { lte: now } }, orderBy: { createdAt: "asc" } });
    if (generation) return { type: "generation" as const, job: await tx.revisionGenerationJob.update({ where: { id: generation.id }, data: { status: "PROCESSING", claimToken: randomUUID(), leaseUntil: new Date(Date.now() + 150000), attempts: { increment: 1 }, startedAt: now, lastAttemptAt: now } }) };
    const analysis = await tx.revisionConceptAnalysisJob.findFirst({ where: { status: "PENDING", nextAttemptAt: { lte: now } }, orderBy: { createdAt: "asc" } });
    if (analysis) return { type: "analysis" as const, job: await tx.revisionConceptAnalysisJob.update({ where: { id: analysis.id }, data: { status: "PROCESSING", claimToken: randomUUID(), leaseUntil: new Date(Date.now() + 150000), attempts: { increment: 1 } } }) };
    return null;
  });
}
export async function processConceptAnalysis(job: RevisionConceptAnalysisJob) {
  try {
    const material = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: job.materialId }, include: { courseOffering: { include: { curriculumCourse: { include: { course: true, curriculum: true } } } } } });
    if (material.aiIngestStatus !== "INGESTED") throw new RevisionWebhookError(409, "MATERIAL_NOT_INGESTED", "Material ingestion is not complete.");
    const result = validateAnalysis(await learningRequest("/analyse-material", { document_id: material.id, max_concepts: 12 }), material.id);
    if (result.lesson_plan.concepts.length > 20 || result.lesson_plan.concepts.some(c => c.title.length > 200 || c.description.length > 2000 || c.learning_objective.length > 2000)) throw new RevisionWebhookError(502, "ANALYSIS_CONTRACT_INVALID", "Analysis returned too many concepts.");
    await elearningDb.$transaction(async tx => {
      const claimed = await tx.revisionConceptAnalysisJob.updateMany({ where: { id: job.id, claimToken: job.claimToken, status: "PROCESSING", leaseUntil: { gt: new Date() } }, data: { status: "COMPLETED", completedAt: new Date(), claimToken: null, leaseUntil: null, lastErrorCode: null } });
      if (!claimed.count) throw new Error("Analysis lease lost");
      const cc = material.courseOffering.curriculumCourse;
      for (const c of result.lesson_plan.concepts) {
        const key = conceptKey({ subject: cc.course.title, curriculum: cc.curriculum.name, level: String(cc.level), title: c.title, learningObjective: c.learning_objective });
        const existing = await tx.revisionConcept.findUnique({ where: { materialId_externalId: { materialId: material.id, externalId: c.concept_id } } });
        if (existing && (existing.conceptKey !== key || existing.description !== c.description)) throw new RevisionWebhookError(409, "CONCEPT_CHANGED_REVIEW", "Existing concept meaning changed; a reviewed version is required.");
        await tx.revisionConcept.upsert({ where: { materialId_externalId: { materialId: material.id, externalId: c.concept_id } }, update: { active: true }, create: { materialId: material.id, externalId: c.concept_id, title: c.title, description: c.description, learningObjective: c.learning_objective, conceptKey: key, subject: cc.course.title, curriculum: cc.curriculum.name, level: String(cc.level), topic: material.title, language: "en" } });
      }
    });
  } catch (error) {
    const uncertain = error instanceof RevisionWebhookError && error.code === "AI_REQUEST_UNCERTAIN";
    const retry = !uncertain && job.attempts < 3 && error instanceof RevisionWebhookError && error.status >= 500;
    await elearningDb.revisionConceptAnalysisJob.updateMany({ where: { id: job.id, claimToken: job.claimToken }, data: { status: retry ? "PENDING" : "FAILED", lastErrorCode: uncertain ? "ANALYSIS_UNCERTAIN" : "ANALYSIS_FAILED", nextAttemptAt: retryAt(job.attempts), ...(!uncertain ? { claimToken: null, leaseUntil: null } : {}) } });
    if (!retry) await queueRevisionAlert("ANALYSIS_FAILED", job.id);
  }
}
export async function processRevisionGeneration(job: RevisionGenerationJob) {
  const event = await elearningDb.revisionTeachingEvent.findUniqueOrThrow({ where: { id: job.teachingEventId }, include: { concept: true } });
  const context = event.context as Record<string, string>;
  revisionLog("generation_started", { correlationId: job.id, teachingEventId: event.id, conceptId: event.conceptId });
  let submitted = false;
  try {
    const receipt = await elearningDb.revisionWebhookIdempotency.findUnique({ where: { idempotencyKey: `teach_${event.id}` } });
    if (receipt?.status === "COMPLETED") {
      await elearningDb.revisionGenerationJob.updateMany({ where: { id: job.id, claimToken: job.claimToken }, data: { status: job.needsReview ? "NEEDS_REVIEW" : "COMPLETED", completedAt: receipt.completedAt, claimToken: null, leaseUntil: null, webhookStatus: "processed" } }); return;
    }
    if (job.submittedAt) throw new RevisionWebhookError(409, "DISPATCH_UNCERTAIN", "A previous dispatch must be reconciled before regeneration.");
    aiConfiguration();
    const dispatch = await elearningDb.revisionGenerationJob.updateMany({ where: { id: job.id, claimToken: job.claimToken, status: "PROCESSING", submittedAt: null, leaseUntil: { gt: new Date() } }, data: { submittedAt: new Date() } });
    if (!dispatch.count) return; // An expired/replaced worker cannot start a remote request.
    submitted = true;
    const result = await learningRequest("/generate-revision-questions", { teaching_event_id: event.id, student_id: event.studentId, concept_id: context.concept_id, concept_description: context.concept_title, taught_summary: event.taughtSummary, subject: context.subject, curriculum: context.curriculum, level: context.level, topic: context.topic, language: context.language, max_questions: 3, question_types: ["mcq", "short_answer", "true_false"] }, 120000);
    if (result?.teaching_event_id !== event.id || !Number.isInteger(result.generated_count) || result.generated_count < 0 || result.generated_count > 5 || typeof result.webhook_attempted !== "boolean" || !["processed", "accepted_async", "failed_permanent", "failed_transient", "not_attempted"].includes(result.webhook_status) || typeof result.needs_review !== "boolean" || !Array.isArray(result.webhook_results)) throw new RevisionWebhookError(502, "GENERATION_CONTRACT_INVALID", "Generation response failed validation.");
    const committed = await elearningDb.revisionWebhookIdempotency.findUnique({ where: { idempotencyKey: `teach_${event.id}` } });
    if (result.webhook_status !== "processed" || !result.webhook_attempted || committed?.status !== "COMPLETED") throw new RevisionWebhookError(503, "GENERATION_NOT_COMMITTED", "No complete synchronous webhook receipt was confirmed.");
    const expected = JSON.parse(committed.responsePayload!).results;
    if (result.generated_count !== expected.length || result.webhook_results.length !== expected.length || new Set(result.webhook_results.map((r: { client_ref?: string }) => r.client_ref)).size !== expected.length || expected.some((row: { client_ref: string; question_id: string | null; student_card_id: string | null; outcome: string }) => { const remote = result.webhook_results.find((r: { client_ref?: string }) => r.client_ref === row.client_ref); return !remote || remote.question_id !== row.question_id || remote.student_card_id !== row.student_card_id || remote.outcome !== row.outcome; })) throw new RevisionWebhookError(502, "GENERATION_RESULT_MISMATCH", "Generator results differ from the committed webhook receipt.");
    // Webhook committed the counts and completion already. Do not overwrite them on late transport failure.
    if (result.needs_review) { await elearningDb.revisionGenerationJob.update({ where: { id: job.id }, data: { status: "NEEDS_REVIEW", needsReview: true } }); await queueRevisionAlert("GENERATION_NEEDS_REVIEW", event.id); }
  } catch (error) {
    const committed = await elearningDb.revisionWebhookIdempotency.findUnique({ where: { idempotencyKey: `teach_${event.id}` } });
    if (committed?.status === "COMPLETED") {
      if (error instanceof RevisionWebhookError && ["GENERATION_CONTRACT_INVALID", "GENERATION_RESULT_MISMATCH"].includes(error.code)) {
        await elearningDb.revisionGenerationJob.update({ where: { id: job.id }, data: { status: "NEEDS_REVIEW", needsReview: true, errorCode: error.code, claimToken: null, leaseUntil: null } });
        await queueRevisionAlert(error.code, event.id);
      }
      return;
    }
    const uncertain = submitted, retry = !submitted && job.attempts < 3;
    const code = error instanceof RevisionWebhookError ? error.code : "GENERATION_FAILED";
    await elearningDb.revisionGenerationJob.updateMany({ where: { id: job.id, claimToken: job.claimToken, status: "PROCESSING" }, data: { status: retry ? "PENDING" : uncertain ? "NEEDS_REVIEW" : "FAILED", errorCode: code, needsReview: !retry, nextAttemptAt: retryAt(job.attempts), ...(!uncertain ? { claimToken: null, leaseUntil: null } : {}) } });
    if (!retry) await queueRevisionAlert(code, event.id);
    revisionLog("generation_failed", { correlationId: job.id, teachingEventId: event.id, failureCode: code });
  }
}
export async function runRevisionSweep() {
  if (process.env.REVISION_GENERATION_ENABLED !== "true") return { disabled: true, processed: 0 };
  let processed = 0; const end = Date.now() + 240000;
  while (Date.now() + 125000 < end && processed < 3) {
    const work = await claimRevisionWork(); if (!work) break;
    if (work.type === "generation") await processRevisionGeneration(work.job); else await processConceptAnalysis(work.job);
    processed++;
  }
  const alertsDelivered = await flushRevisionAlerts();
  let contextsRefreshed = 0; try { contextsRefreshed = await refreshRevisionContexts(); } catch { console.warn("[revisions] Context refresh unavailable; learning jobs remain independent."); }
  return { processed, alertsDelivered, contextsRefreshed };
}
