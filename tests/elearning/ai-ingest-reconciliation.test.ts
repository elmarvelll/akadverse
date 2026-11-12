import "../helpers/env";
import { afterEach, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { elearningDb } from "@/lib/db/elearning";
import { reconcileAiIngestion } from "@/services/e-learning/ai-ingest/worker";

// Exercise scheduling/conditional writes without contacting a database or provider.
const original = {
  findMany: elearningDb.aiIngestTask.findMany,
  updateMany: elearningDb.aiIngestTask.updateMany,
  materialUpdate: elearningDb.courseMaterial.updateMany,
  transaction: elearningDb.$transaction,
  fetch: globalThis.fetch,
};
let taskWrites: Record<string, unknown>[];
let materialWrites: Record<string, unknown>[];
let selection: Record<string, unknown>;
let claimsWin: boolean;
let completionsWin: boolean;
beforeEach(() => {
  taskWrites = []; materialWrites = []; claimsWin = true; completionsWin = true;
  process.env.CONCEPT_EXPLAINER_API_URL = "https://ai.example.test";
  process.env.AI_SERVICE_API_KEY = "test-key";
  // Prisma's generic delegates are replaced only inside this isolated test process.
  elearningDb.aiIngestTask.findMany = (async (args: unknown) => {
    selection = args as Record<string, unknown>;
    return [{ id: "task", documentId: "doc", materialId: "material", updatedAt: new Date(), submittedAt: new Date() }];
  }) as unknown as typeof original.findMany;
  elearningDb.aiIngestTask.updateMany = (async (args: { data: Record<string, unknown> }) => {
    taskWrites.push(args.data);
    return { count: args.data.claimToken ? Number(claimsWin) : Number(completionsWin) };
  }) as unknown as typeof original.updateMany;
  elearningDb.courseMaterial.updateMany = (async (args: { data: Record<string, unknown> }) => {
    materialWrites.push(args.data); return { count: 1 };
  }) as unknown as typeof original.materialUpdate;
  elearningDb.$transaction = (async (fn: (tx: typeof elearningDb) => unknown) => fn(elearningDb)) as unknown as typeof original.transaction;
});
afterEach(() => {
  elearningDb.aiIngestTask.findMany = original.findMany;
  elearningDb.aiIngestTask.updateMany = original.updateMany;
  elearningDb.courseMaterial.updateMany = original.materialUpdate;
  elearningDb.$transaction = original.transaction;
  globalThis.fetch = original.fetch;
  delete process.env.CONCEPT_EXPLAINER_API_URL;
});
for (const [remote, local] of [["queued", "PENDING"], ["processing", "PENDING"], ["done", "INGESTED"], ["failed", "FAILED"]]) {
  it(`maps ${remote} status to ${local} without posting a callback or resubmitting`, async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://ai.example.test/documents/doc/status");
      assert.equal(init?.method, "GET");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
      return Response.json({ document_id: "doc", status: remote, chunk_count: 42 });
    };
    assert.equal(await reconcileAiIngestion(), 1);
    assert.equal(materialWrites[0].aiIngestStatus, local);
    assert.equal(taskWrites[1].state, ["done", "failed"].includes(remote) ? "DONE" : "ACCEPTED");
  });
}
it("selects only due, submitted, undeleted nonterminal jobs without callback and bounds the batch", async () => {
  globalThis.fetch = async () => Response.json({ document_id: "doc", status: "queued" });
  await reconcileAiIngestion(100);
  assert.equal(selection.take, 20);
  const where = selection.where as Record<string, unknown>;
  assert.equal(where.operation, "INGEST");
  assert.equal(where.callbackAt, null);
  assert.deepEqual(where.state, { in: ["ACCEPTED", "ATTENTION"] });
  assert.deepEqual(where.materialId, { not: null });
  assert.ok(where.nextAttemptAt);
  assert.ok(where.OR);
});
it("does no network work when another cron wins the claim", async () => {
  claimsWin = false;
  globalThis.fetch = async () => { throw new Error("must not call"); };
  assert.equal(await reconcileAiIngestion(), 0);
  assert.equal(taskWrites.length, 1);
});
it("does not overwrite material when callback or deletion wins during a poll", async () => {
  completionsWin = false;
  globalThis.fetch = async () => Response.json({ document_id: "doc", status: "done", chunk_count: 2 });
  await reconcileAiIngestion();
  assert.equal(materialWrites.length, 0);
});
it("treats early 404 as retryable missing state rather than failed ingestion", async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const start = Date.now();
  await reconcileAiIngestion();
  assert.equal(taskWrites[1].state, "ATTENTION");
  assert.ok(+(taskWrites[1].nextAttemptAt as Date) >= start + 5000);
  assert.equal(materialWrites.length, 0);
});
it("releases poll lease and schedules recovery after network failure", async () => {
  globalThis.fetch = async () => { throw new Error("network"); };
  const start = Date.now();
  await reconcileAiIngestion();
  assert.equal(taskWrites[1].claimToken, null);
  assert.equal(taskWrites[1].leaseUntil, null);
  assert.ok(+(taskWrites[1].nextAttemptAt as Date) >= start + 300_000);
  assert.equal(materialWrites.length, 0);
});
it("requires the existing cron secret and refuses missing configuration", async () => {
  const { requireCronSecret } = await import("@/lib/cron-auth");
  const { NextRequest } = await import("next/server");
  const saved = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(requireCronSecret(new NextRequest("https://app.test/api/cron/ai-ingest"))?.status, 500);
    process.env.CRON_SECRET = "cron-test";
    assert.equal(requireCronSecret(new NextRequest("https://app.test/api/cron/ai-ingest"))?.status, 401);
    assert.equal(requireCronSecret(new NextRequest("https://app.test/api/cron/ai-ingest", { headers: { Authorization: "Bearer cron-test" } })), null);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
  }
});
