import { unstable_rethrow } from "next/navigation";
import { authenticateRevisionRequest } from "./security";
import { parseRevisionPayload } from "./contract";
import { RevisionWebhookError } from "./errors";
import { validateTeachingDelivery, prepareRevisionBatch, persistRevisionBatch } from "./processing";
import { reserveRevisionDelivery, releaseRevisionClaim, type RevisionClaim } from "./idempotency";
import { queueRevisionAlert } from "./worker";
import { revisionLog } from "./monitor";
const authFailures = new Map<string, number>();
const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
export async function handleRevisionWebhook(request: Request) {
  const correlationId = crypto.randomUUID(), start = Date.now();
  let claim: RevisionClaim | undefined;
  try {
    const authenticated = await authenticateRevisionRequest(request);
    const payload = parseRevisionPayload(authenticated.raw, authenticated.idempotencyKey);
    revisionLog("received", { correlationId, eventId: payload.event_id, teachingEventId: payload.teaching_event_id, conceptId: payload.context.concept_id });
    if (process.env.REVISION_QUESTIONS_ENABLED !== "true") throw new RevisionWebhookError(503, "REVISION_DISABLED", "Revision processing has not been enabled for this deployment.", 60);
    const event = await validateTeachingDelivery(payload);
    const reservation = await reserveRevisionDelivery(authenticated.idempotencyKey, authenticated.bodyHash, payload.teaching_event_id, payload.event_id, authenticated.raw);
    if (reservation.kind === "replay") { revisionLog("replay", { correlationId, teachingEventId: event.id }); return new Response(reservation.response, { status: 200, headers }); }
    if (reservation.kind === "processing") throw new RevisionWebhookError(503, "DELIVERY_PROCESSING", "This delivery is still processing. Retry the same bytes.", reservation.retryAfter);
    claim = reservation.claim;
    const prepared = await prepareRevisionBatch(payload, event);
    const response = await persistRevisionBatch(payload, event, claim, prepared);
    const results = JSON.parse(response).results as { outcome: string }[];
    revisionLog("processed", { correlationId, teachingEventId: event.id, studentId: payload.student_id, idempotencyKey: authenticated.idempotencyKey, durationMs: Date.now() - start, generatedCount: results.length, createdCount: results.filter(r => r.outcome === "created" || r.outcome === "created_variant").length, reusedCount: results.filter(r => r.outcome === "reused_existing").length, rejectedCount: results.filter(r => r.outcome === "rejected_invalid").length });
    return new Response(response, { status: 200, headers });
  } catch (error) {
    unstable_rethrow(error);
    const known = error instanceof RevisionWebhookError;
    const status = known ? error.status : 500, code = known ? error.code : "INTERNAL_ERROR";
    if (claim) await releaseRevisionClaim(claim, code).catch(() => {});
    if (process.env.REVISION_QUESTIONS_ENABLED === "true") {
      if (claim && claim.attempts >= 3 && status >= 500) await queueRevisionAlert(code, claim.teachingEventId).catch(() => console.warn("[revision-questions] alert persistence unavailable", { correlationId }));
      if (["INVALID_SIGNATURE", "EXPIRED_TIMESTAMP"].includes(code)) {
        const bucket = `${code}:${Math.floor(Date.now() / 900000)}`;
        const count = (authFailures.get(bucket) || 0) + 1; authFailures.set(bucket, count);
        for (const old of authFailures.keys()) if (!old.endsWith(String(Math.floor(Date.now() / 900000)))) authFailures.delete(old);
        if (count === 5) await queueRevisionAlert("REPEATED_AUTHENTICATION_FAILURE", bucket).catch(() => console.warn("[revision-questions] auth alert persistence unavailable", { correlationId }));
      }
    }
    revisionLog("rejected", { correlationId, failureCode: code, durationMs: Date.now() - start });
    return Response.json({ error: { code, message: known ? error.message : "Revision processing failed. Retry the same delivery after the service recovers.", correlation_id: correlationId } }, { status, headers: { ...headers, ...(known && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
  }
}
