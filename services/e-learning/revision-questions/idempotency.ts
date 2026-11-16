import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import { RevisionWebhookError } from "./errors";
import type { RevisionResponse } from "./contract";
export const REVISION_LEASE_MS = 180000;
export interface RevisionClaim { id: string; token: string; key: string; bodyHash: string; teachingEventId: string; attempts: number }
export type Reservation = { kind: "claimed"; claim: RevisionClaim } | { kind: "replay"; response: string } | { kind: "processing"; retryAfter: number };
export async function reserveRevisionDelivery(key: string, bodyHash: string, teachingEventId: string, eventId: string, raw?: Uint8Array): Promise<Reservation> {
  if (key !== `teach_${teachingEventId}` || teachingEventId.length > 200 || !/^[a-f0-9]{64}$/.test(bodyHash)) throw new RevisionWebhookError(400, "INVALID_IDEMPOTENCY_KEY", "Invalid delivery identity.");
  const token = randomUUID(), now = new Date(), leaseExpiresAt = new Date(+now + REVISION_LEASE_MS);
  try {
    const row = await elearningDb.revisionWebhookIdempotency.create({ data: { idempotencyKey: key, teachingEventId, eventId, bodyHash, requestBody: raw ? new Uint8Array(raw) : undefined, claimToken: token, leaseExpiresAt } });
    return { kind: "claimed", claim: { id: row.id, token, key, bodyHash, teachingEventId, attempts: 1 } };
  } catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") throw error; }
  // Unique insertion decides the winner; this lookup never reserves a new key.
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await elearningDb.revisionWebhookIdempotency.findUnique({ where: { idempotencyKey: key } });
    if (!row) throw new RevisionWebhookError(503, "RECEIPT_UNAVAILABLE", "The delivery receipt is temporarily unavailable.", 5);
    if (row.bodyHash !== bodyHash) throw new RevisionWebhookError(409, "IDEMPOTENCY_CONFLICT", "This teaching event already has a submission with different body bytes.");
    if (row.status === "COMPLETED") {
      if (!row.responsePayload) throw new Error("Completed revision receipt has no response");
      return { kind: "replay", response: row.responsePayload };
    }
    if (row.leaseExpiresAt && +row.leaseExpiresAt > Date.now()) return { kind: "processing", retryAfter: 5 };
    const changed = await elearningDb.revisionWebhookIdempotency.updateMany({
      where: { id: row.id, bodyHash, status: "PROCESSING", claimToken: row.claimToken, leaseExpiresAt: { lte: new Date() } },
      data: { claimToken: token, leaseExpiresAt: new Date(Date.now() + REVISION_LEASE_MS), attempts: { increment: 1 }, lastFailureCode: null },
    });
    if (changed.count) return { kind: "claimed", claim: { id: row.id, token, key, bodyHash, teachingEventId, attempts: row.attempts + 1 } };
  }
  return { kind: "processing", retryAfter: 5 };
}
export async function renewRevisionClaim(claim: RevisionClaim) {
  const changed = await elearningDb.revisionWebhookIdempotency.updateMany({ where: { id: claim.id, bodyHash: claim.bodyHash, status: "PROCESSING", claimToken: claim.token, leaseExpiresAt: { gt: new Date() } }, data: { leaseExpiresAt: new Date(Date.now() + REVISION_LEASE_MS) } });
  if (!changed.count) throw new RevisionWebhookError(409, "LEASE_LOST", "This delivery is no longer owned by this worker.");
}
export async function releaseRevisionClaim(claim: RevisionClaim, failureCode: string) {
  const boundedCode = /^[A-Z_]{1,60}$/.test(failureCode) ? failureCode : "PROCESSING_FAILED";
  await elearningDb.revisionWebhookIdempotency.updateMany({ where: { id: claim.id, bodyHash: claim.bodyHash, status: "PROCESSING", claimToken: claim.token }, data: { leaseExpiresAt: new Date(0), lastFailureCode: boundedCode } });
}
/** The callback may perform DB persistence only. Embeddings/judgments must be prepared beforehand. */
export async function commitRevisionDelivery(claim: RevisionClaim, persist: (tx: Prisma.TransactionClient) => Promise<RevisionResponse>): Promise<string> {
  return elearningDb.$transaction(async tx => {
    // This CAS locks the receipt row before any question/card write. A takeover cannot interleave.
    const fenced = await tx.revisionWebhookIdempotency.updateMany({ where: { id: claim.id, bodyHash: claim.bodyHash, teachingEventId: claim.teachingEventId, claimToken: claim.token, status: "PROCESSING", leaseExpiresAt: { gt: new Date() } }, data: { leaseExpiresAt: new Date(Date.now() + REVISION_LEASE_MS) } });
    if (!fenced.count) throw new RevisionWebhookError(409, "LEASE_LOST", "The delivery claim expired or was replaced. No records were committed by this worker.");
    const response = await persist(tx);
    if (response.status !== "processed" || response.teaching_event_id !== claim.teachingEventId || !Array.isArray(response.results) || !response.results.length) throw new Error("Invalid completed revision response");
    const responsePayload = JSON.stringify(response);
    const completed = await tx.revisionWebhookIdempotency.updateMany({ where: { id: claim.id, claimToken: claim.token, status: "PROCESSING" }, data: { status: "COMPLETED", responsePayload, completedAt: new Date(), claimToken: null, leaseExpiresAt: null, lastFailureCode: null } });
    if (!completed.count) throw new Error("Revision claim completion failed");
    return responsePayload;
  }, { maxWait: 5000, timeout: 15000 });
}
