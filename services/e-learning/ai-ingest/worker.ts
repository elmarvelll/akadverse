import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import { createSignedDownloadUrl } from "@/lib/storage/supabase-storage";
import { AiServiceError, aiIngestCallbackUrl, isAiIngestConfigured, requestDelete, requestIngest } from "./client";
import { AI_INGEST_STALE_MS, buildIngestPayload, loadMaterialForIngestion } from "./ingest-material";
import { eligibility, positiveSetting, retryDelay } from "./policy";

// A lease outlives our 15s HTTP timeout. Never resubmit an expired POST claim:
// it may have committed remotely even when this process died before recording it.
const LEASE_MS = 90_000;
export async function runAiIngestSweep(limit = 10) {
  if (process.env.AI_INGEST_ENABLED !== "true") return { processed: 0, disabled: true };
  const now = new Date();
  await elearningDb.aiIngestTask.updateMany({
    where: { operation: "INGEST", OR: [
      { state: "CLAIMED", leaseUntil: { lt: now } },
      { state: "ACCEPTED", submittedAt: { lt: new Date(+now - AI_INGEST_STALE_MS) } },
    ] },
    data: { state: "ATTENTION", lastError: "Submission or callback outcome uncertain. Remote reconciliation required.", claimToken: null, leaseUntil: null },
  });
  await elearningDb.aiIngestTask.updateMany({
    where: { operation: "DELETE", state: "CLAIMED", leaseUntil: { lt: now } },
    data: { state: "RETRY", claimToken: null, leaseUntil: null },
  });
  const candidates = await elearningDb.aiIngestTask.findMany({
    where: { state: { in: ["READY", "RETRY"] }, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" }, take: Math.min(20, Math.max(1, limit)),
  });
  let processed = 0;
  const deadline = Date.now() + 240_000;
  for (const task of candidates) {
    if (Date.now() > deadline) break;
    const token = randomUUID();
    const claim = await elearningDb.aiIngestTask.updateMany({
      where: { id: task.id, operation: task.operation, state: task.state, updatedAt: task.updatedAt },
      data: { state: "CLAIMED", claimToken: token, leaseUntil: new Date(Date.now() + LEASE_MS), attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });
    if (!claim.count) continue;
    processed++;
    let posting = false;
    try {
      if (!isAiIngestConfigured()) throw new AiServiceError("AI service configuration missing.", 401);
      if (task.operation === "DELETE") {
        await requestDelete(task.documentId);
      } else {
        const material = await loadMaterialForIngestion(task.documentId);
        if (!material || eligibility(material) !== "eligible") throw new AiServiceError("Material is unavailable or ineligible.", 422);
        const callbackUrl = aiIngestCallbackUrl();
        if (!callbackUrl || new URL(callbackUrl).protocol !== "https:") throw new AiServiceError("Public HTTPS callback URL required.", 422);
        const url = await createSignedDownloadUrl(material.storageBucket, material.storagePath, null, 3600);
        const payload = buildIngestPayload(material, url);
        if (Object.values(payload.metadata).some((v) => v == null || v === "")) throw new AiServiceError("Required academic metadata missing.", 422);
        // Guard against deletion winning while preparing the signed URL.
        const active = await elearningDb.$transaction(async (tx) => {
          const result = await tx.aiIngestTask.updateMany({
            where: { id: task.id, claimToken: token, operation: "INGEST" }, data: { submittedAt: new Date() },
          });
          if (result.count) await tx.courseMaterial.updateMany({ where: { id: material.id }, data: {
            aiIngestStatus: "PENDING", aiIngestError: null, aiIngestUpdatedAt: new Date(),
          } });
          return result;
        });
        if (!active.count) continue;
        posting = true;
        await requestIngest(payload);
      }
      await elearningDb.aiIngestTask.updateMany({ where: { id: task.id, claimToken: token, operation: task.operation, callbackAt: task.operation === "INGEST" ? null : undefined },
        data: { state: task.operation === "DELETE" ? (task.cleanupUncertain ? "ATTENTION" : "DONE") : "ACCEPTED", claimToken: null, leaseUntil: null,
          lastError: task.operation === "DELETE" && task.cleanupUncertain ? "Remote records deleted, but an unfinished AI worker may recreate them. Confirm cancellation with AI engineer." : null },
      });
      console.info("[ai-ingest] accepted", { documentId: task.documentId, operation: task.operation });
    } catch (err) {
      const status = err instanceof AiServiceError ? err.status : null;
      // No contract guarantees that a failed/timeout POST did not enqueue a job.
      // Only failures BEFORE POST and idempotent DELETE operations can retry.
      const retryable = !posting && (status === null || status === 429 || (status >= 500));
      const attempts = task.attempts + 1;
      const retry = retryable && attempts < positiveSetting("AI_INGEST_MAX_ATTEMPTS", 5, 20);
      const error = posting && !(status !== null && [401, 403, 422].includes(status)) ? "Submission outcome uncertain. Reconcile with AI service before retrying."
        : status === 401 || status === 403 ? "AI service credentials or configuration require administrator review."
        : status === 422 ? "Request metadata or integration configuration requires correction."
        : retry ? "Temporary integration failure; retry scheduled." : "Integration failed; administrator review required.";
      await elearningDb.$transaction(async (tx) => {
        const changed = await tx.aiIngestTask.updateMany({ where: { id: task.id, claimToken: token, operation: task.operation },
          data: { state: retry ? "RETRY" : "ATTENTION", claimToken: null, leaseUntil: null, lastError: error,
            nextAttemptAt: new Date(Date.now() + retryDelay(attempts)),
            // Explicit pre-admission rejections can be retried manually after correction.
            ...(posting && status !== null && [401, 403, 422].includes(status) ? { submittedAt: null } : {}),
          },
        });
        if (changed.count && task.materialId && task.operation === "INGEST") await tx.courseMaterial.updateMany({
          where: { id: task.materialId }, data: { aiIngestStatus: retry ? "RETRY_PENDING" : "FAILED", aiIngestError: error, aiIngestUpdatedAt: new Date() },
        });
      });
      console.warn("[ai-ingest] task failed", { documentId: task.documentId, retry, status });
    }
  }
  return { processed };
}

// DAPU action only. Existing remote identities cannot be reset under the v1 API.
export async function retryReviewedTask(id: string) {
  const changed = await elearningDb.aiIngestTask.updateMany({
    where: { id, state: "ATTENTION", OR: [{ operation: "DELETE" }, { operation: "INGEST", submittedAt: null, callbackAt: null }] },
    data: { state: "READY", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  if (!changed.count) throw new Error("This task needs remote reconciliation; safe re-ingestion is not supported by the AI API.");
}
