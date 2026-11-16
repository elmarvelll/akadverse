import "../helpers/env";
import { after, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import { reserveRevisionDelivery, commitRevisionDelivery, releaseRevisionClaim, renewRevisionClaim, type RevisionClaim } from "@/services/e-learning/revision-questions/idempotency";
import { RevisionWebhookError } from "@/services/e-learning/revision-questions/errors";
import type { RevisionResponse } from "@/services/e-learning/revision-questions/contract";
const keys: string[] = [], sessions: string[] = [];
function identity() { const teaching = `revision-test-${randomUUID()}`, key = `teach_${teaching}`; keys.push(key); return { teaching, key, event: randomUUID(), hash: createHash("sha256").update(randomUUID()).digest("hex") }; }
const response = (teaching: string): RevisionResponse => ({ teaching_event_id: teaching, status: "processed", results: [{ client_ref: "q1", question_id: "fixture-question", student_card_id: "fixture-card", outcome: "created" }] });
async function claimFor(value = identity()) { const reservation = await reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event); assert.equal(reservation.kind, "claimed"); return { ...value, claim: (reservation as { kind: "claimed"; claim: RevisionClaim }).claim }; }
after(async () => { await elearningDb.revisionWebhookIdempotency.deleteMany({ where: { idempotencyKey: { in: keys } } }); if (sessions.length) await elearningDb.academicSession.deleteMany({ where: { id: { in: sessions } } }); await elearningDb.$disconnect(); });
it("reserves a key atomically and returns PROCESSING rather than running an identical delivery twice", async () => {
  const value = await claimFor(); const second = await reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event);
  assert.deepEqual(second, { kind: "processing", retryAfter: 5 });
  assert.equal(await elearningDb.revisionWebhookIdempotency.count({ where: { idempotencyKey: value.key } }), 1);
});
it("returns byte-for-byte stored response text after completion and rejects a changed raw-body hash", async () => {
  const value = await claimFor(), original = await commitRevisionDelivery(value.claim, async () => response(value.teaching));
  const retried = await reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event); assert.equal(retried.kind, "replay");
  assert.equal((retried as { kind: "replay"; response: string }).response, original);
  await assert.rejects(reserveRevisionDelivery(value.key, "a".repeat(64), value.teaching, value.event), e => e instanceof RevisionWebhookError && e.status === 409);
});
it("allows only one winner under simultaneous identical reservations", async () => {
  const value = identity();
  const results = await Promise.all(Array.from({ length: 10 }, () => reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event)));
  assert.equal(results.filter(row => row.kind === "claimed").length, 1);
  assert.equal(results.filter(row => row.kind === "processing").length, 9);
});
it("rejects one of two simultaneous conflicting bodies without creating a second receipt", async () => {
  const value = identity();
  const results = await Promise.allSettled([reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event), reserveRevisionDelivery(value.key, "b".repeat(64), value.teaching, value.event)]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(results.filter(row => row.status === "rejected").length, 1);
  assert.equal(await elearningDb.revisionWebhookIdempotency.count({ where: { idempotencyKey: value.key } }), 1);
});
it("recovers an abandoned lease and fences the old worker before any persistence callback runs", async () => {
  const value = await claimFor();
  await elearningDb.revisionWebhookIdempotency.update({ where: { id: value.claim.id }, data: { leaseExpiresAt: new Date(0) } });
  const next = await reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event); assert.equal(next.kind, "claimed");
  const newClaim = (next as { kind: "claimed"; claim: RevisionClaim }).claim; assert.notEqual(newClaim.token, value.claim.token);
  let invoked = false;
  await assert.rejects(commitRevisionDelivery(value.claim, async () => { invoked = true; return response(value.teaching); }), e => e instanceof RevisionWebhookError && e.code === "LEASE_LOST");
  assert.equal(invoked, false);
  await releaseRevisionClaim(value.claim, "OLD_WORKER_FAILURE");
  assert.equal((await elearningDb.revisionWebhookIdempotency.findUniqueOrThrow({ where: { id: value.claim.id } })).claimToken, newClaim.token);
  await commitRevisionDelivery(newClaim, async () => response(value.teaching));
});
it("rolls back persistence together with receipt completion when the final transaction fails", async () => {
  const value = await claimFor(), id = randomUUID(); sessions.push(id);
  await assert.rejects(commitRevisionDelivery(value.claim, async tx => { await tx.academicSession.create({ data: { id, name: `revision-fixture-${id}` } }); throw new Error("Simulated final persistence failure"); }));
  assert.equal(await elearningDb.academicSession.findUnique({ where: { id } }), null);
  const row = await elearningDb.revisionWebhookIdempotency.findUniqueOrThrow({ where: { id: value.claim.id } }); assert.equal(row.status, "PROCESSING"); assert.equal(row.responsePayload, null);
  await releaseRevisionClaim(value.claim, "PERSISTENCE_FAILED");
  assert.equal((await reserveRevisionDelivery(value.key, value.hash, value.teaching, value.event)).kind, "claimed");
});
it("renews only a current live lease and never releases a completed receipt", async () => {
  const value = await claimFor(); await renewRevisionClaim(value.claim); await commitRevisionDelivery(value.claim, async () => response(value.teaching));
  await assert.rejects(renewRevisionClaim(value.claim)); await releaseRevisionClaim(value.claim, "LATE_FAILURE");
  assert.equal((await elearningDb.revisionWebhookIdempotency.findUniqueOrThrow({ where: { id: value.claim.id } })).status, "COMPLETED");
});
it("commits one final persistence transaction under simultaneous old-worker finalisation attempts", async () => {
  const value = await claimFor(); let callbacks = 0;
  const results = await Promise.allSettled([1, 2].map(() => commitRevisionDelivery(value.claim, async () => { callbacks++; return response(value.teaching); })));
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1); assert.equal(callbacks, 1);
});
