import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLearningAiClient, LearningAiError, type CallRecord, type CallStore } from "../../services/e-learning/learning-ai/client";
import { learningAiFlags } from "../../services/e-learning/learning-ai/flags";
import { responseMetadata } from "../../services/e-learning/learning-ai/capabilities";

function fixture(transport: Parameters<typeof createLearningAiClient>[0]["transport"], env = { AI_V2_ENABLED: "true", ORCHESTRATOR_MODE: "shadow" }) {
  const records = new Map<string, CallRecord & Record<string, unknown>>();
  const store: CallStore = {
    async claim(record) { const old = records.get(record.requestId); if (old) return { claimed: false, record: old }; records.set(record.requestId, { ...record }); return { claimed: true }; },
    async complete(id, data) { Object.assign(records.get(id)!, data); },
  };
  return { records, call: createLearningAiClient({ store, transport, flags: () => learningAiFlags(env) }) };
}
const payload = { allowed_actions: ["RECAP"], current: { concept: { concept_id: "canonical-1" } }, trigger: "RETURN_VISIT" };
const code = (expected: string) => (error: unknown) => error instanceof LearningAiError && error.code === expected;
test("flags fail closed and mode requires the master flag", () => {
  assert.equal(learningAiFlags({}).orchestratorMode, "off");
  assert.equal(learningAiFlags({ ORCHESTRATOR_MODE: "active" }).orchestratorMode, "off");
  assert.equal(learningAiFlags({ AI_V2_ENABLED: "TRUE", HINTS_ENABLED: "yes" }).HINTS_ENABLED, false);
  assert.equal(learningAiFlags({ AI_V2_ENABLED: "true", ORCHESTRATOR_MODE: "typo" }).orchestratorMode, "off");
});
test("disabled and empty-allowlist calls never claim or contact upstream", async () => {
  let calls = 0; const transport = async () => { calls++; return Response.json({}); };
  const disabled = fixture(transport, { AI_V2_ENABLED: "false", ORCHESTRATOR_MODE: "active" });
  await assert.rejects(disabled.call("NEXT_ACTION", payload), code("FEATURE_DISABLED"));
  const enabled = fixture(transport);
  await assert.rejects(enabled.call("NEXT_ACTION", { allowed_actions: [] }), code("EMPTY_ALLOWED_ACTIONS"));
  assert.equal(calls, 0); assert.equal(enabled.records.size + disabled.records.size, 0);
});
test("claims before send, uses deadline and replays without another call; scope/hash conflicts fail", async () => {
  let calls = 0; const id = randomUUID();
  const f = fixture(async (path, body, timeout) => {
    calls++; assert.equal(f.records.get(id)?.status, "PENDING");
    assert.equal(path, "/next-action"); assert.equal(timeout, 10_000);
    assert.equal((body as Record<string, unknown>).request_id, id);
    return Response.json({ request_id: id, status: "ok", decision: { action: "RECAP" }, future_field: 1 });
  });
  const opts = { requestId: id, studentId: "student-a" };
  const first = await f.call("NEXT_ACTION", payload, opts);
  assert.equal(first.metadata.usageReported, false); assert.equal(first.metadata.usage.model_calls, undefined);
  const replay = await f.call("NEXT_ACTION", { ...payload }, opts);
  assert.equal(replay.replayed, true); assert.equal(calls, 1);
  await assert.rejects(f.call("NEXT_ACTION", { ...payload, trigger: "LESSON_STARTED" }, opts), code("REQUEST_ID_CONFLICT"));
  await assert.rejects(f.call("NEXT_ACTION", payload, { ...opts, studentId: "student-b" }), code("REQUEST_ID_CONFLICT"));
  assert.equal(f.records.get(id)?.creditsCharged, 0);
  assert.equal("current" in f.records.get(id)!, false);
});
test("concurrent requests have one owner", async () => {
  let finish!: () => void; const wait = new Promise<void>(resolve => { finish = resolve; });
  let calls = 0; const f = fixture(async () => { calls++; await wait; return Response.json({ status: "ok", decision: {} }); });
  const requestId = randomUUID(); const first = f.call("NEXT_ACTION", payload, { requestId });
  await assert.rejects(f.call("NEXT_ACTION", payload, { requestId }), code("REQUEST_IN_PROGRESS"));
  finish(); await first; assert.equal(calls, 1);
});
test("timeouts are uncertain, sanitized, zero-charge and never blindly repeated", async () => {
  let calls = 0; const f = fixture(async () => { calls++; throw new Error("secret and raw body must never appear"); });
  const requestId = randomUUID();
  await assert.rejects(f.call("NEXT_ACTION", payload, { requestId }), code("UPSTREAM_UNCERTAIN"));
  await assert.rejects(f.call("NEXT_ACTION", payload, { requestId }), code("REQUEST_NOT_REPLAYABLE"));
  assert.equal(calls, 1); assert.equal(f.records.get(requestId)?.status, "UNCERTAIN");
  assert.equal(JSON.stringify([...f.records.values()]).includes("secret"), false);
});
test("4xx and 5xx are not retried or billed; mismatched echoes fail", async () => {
  for (const status of [409, 422, 429, 503]) {
    let count = 0; const f = fixture(async () => { count++; return Response.json({ detail: "private" }, { status }); });
    await assert.rejects(f.call("NEXT_ACTION", payload), code("UPSTREAM_REJECTED"));
    assert.equal(count, 1); assert.equal([...f.records.values()][0].creditsCharged, 0);
  }
  const f = fixture(async () => Response.json({ request_id: "wrong", status: "ok" }));
  await assert.rejects(f.call("NEXT_ACTION", payload), code("REQUEST_ID_MISMATCH"));
});
test("malformed or oversized bodies fail without storing private content", async () => {
  for (const response of [new Response("not-json"), Response.json([1]), new Response("x".repeat(1024 * 1024 + 1))]) {
    const f = fixture(async () => response);
    await assert.rejects(f.call("NEXT_ACTION", payload));
    assert.equal([...f.records.values()][0].responseRef, undefined);
  }
});
test("degraded responses retain real upstream usage but do not imply success", async () => {
  const id = randomUUID(); const f = fixture(async () => Response.json({ status: "degraded", decision: null, usage: { model_calls: 1, input_tokens: 200 }, signals: ["FUTURE_SIGNAL"] }));
  const result = await f.call("NEXT_ACTION", payload, { requestId: id });
  assert.equal(result.metadata.status, "degraded"); assert.equal(f.records.get(id)?.modelCalls, 1);
  assert.equal(f.records.get(id)?.creditsCharged, 0);
});
test("legacy unsafe content is marked degraded, including cached replay", async () => {
  const f = fixture(async () => Response.json({ answer: "No course material has been ingested yet", sources: [] }));
  const requestId = randomUUID();
  assert.equal((await f.call("EXPLAIN", { question: "test" }, { requestId })).metadata.status, "degraded");
  assert.equal((await f.call("EXPLAIN", { question: "test" }, { requestId })).metadata.status, "degraded");
});
test("tolerant usage supports omitted/future fields without inventing tokens", () => {
  const meta = responseMetadata({ usage: { model_calls: 0, input_tokens: -1, output_tokens: 2.2, model: "test", future: 9 }, cached: true, extra: {} });
  assert.equal(meta.usage.model_calls, 0); assert.equal(meta.usage.input_tokens, undefined);
  assert.equal(meta.usage.output_tokens, undefined); assert.equal(meta.cached, true);
  assert.equal(responseMetadata({}).usageReported, false);
});
test("log persistence failure prevents a new upstream call", async () => {
  let calls = 0;
  const call = createLearningAiClient({
    flags: () => learningAiFlags({ AI_V2_ENABLED: "true", ORCHESTRATOR_MODE: "shadow" }),
    store: { async claim() { throw new Error("database unavailable"); }, async complete() {} },
    transport: async () => { calls++; return Response.json({}); },
  });
  await assert.rejects(call("NEXT_ACTION", payload)); assert.equal(calls, 0);
});
test("failure to save a received response leaves the claim fenced against duplicate execution", async () => {
  let saved: CallRecord | undefined; let calls = 0;
  const call = createLearningAiClient({
    flags: () => learningAiFlags({ AI_V2_ENABLED: "true", ORCHESTRATOR_MODE: "shadow" }),
    store: {
      async claim(record) { if (saved) return { claimed: false, record: saved }; saved = record; return { claimed: true }; },
      async complete() { throw new Error("database unavailable"); },
    },
    transport: async () => { calls++; return Response.json({ status: "ok", decision: {} }); },
  });
  const requestId = randomUUID();
  await assert.rejects(call("NEXT_ACTION", payload, { requestId }));
  await assert.rejects(call("NEXT_ACTION", payload, { requestId }), code("REQUEST_IN_PROGRESS"));
  assert.equal(calls, 1);
});
