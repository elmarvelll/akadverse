import "../helpers/env";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { elearningDb } from "../../src/lib/db/elearning";
import { learningCallStore } from "../../services/e-learning/learning-ai/metering";
import { createLearningAiClient } from "../../services/e-learning/learning-ai/client";
import { learningAiFlags } from "../../services/e-learning/learning-ai/flags";
const ids: string[] = [];
after(async () => { await elearningDb.aiCallLog.deleteMany({ where: { requestId: { in: ids } } }); await elearningDb.$disconnect(); });
test("database unique request ownership and persisted private replay survive client recreation", async () => {
  const requestId = randomUUID(); ids.push(requestId);
  const record = { requestId, operation: "NEXT_ACTION", requestHash: "a".repeat(64), studentId: "test-student", courseId: null, status: "PENDING" };
  const claims = await Promise.all(Array.from({ length: 5 }, () => learningCallStore.claim(record)));
  assert.equal(claims.filter(result => result.claimed).length, 1);
  assert.equal(await elearningDb.aiCallLog.count({ where: { requestId } }), 1);
  const nextId = randomUUID(); ids.push(nextId); let calls = 0;
  const deps = {
    store: learningCallStore,
    flags: () => learningAiFlags({ AI_V2_ENABLED: "true", ORCHESTRATOR_MODE: "shadow" }),
    transport: async () => { calls++; return Response.json({ request_id: nextId, status: "ok", decision: { action: "RECAP" }, usage: { model_calls: 1, input_tokens: 30 } }); },
  };
  const input = { allowed_actions: ["RECAP"] };
  await createLearningAiClient(deps)("NEXT_ACTION", input, { requestId: nextId });
  const replay = await createLearningAiClient(deps)("NEXT_ACTION", input, { requestId: nextId });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);
  const stored = await elearningDb.aiCallLog.findUniqueOrThrow({ where: { requestId: nextId } });
  assert.equal(stored.status, "SUCCEEDED"); assert.equal(stored.inputTokens, 30);
  assert.equal(stored.usageReported, true); assert.equal(stored.creditsCharged, 0);
  assert.ok(stored.completedAt); assert.ok(stored.capabilities);
  const rows = await elearningDb.$queryRaw<Array<{ relrowsecurity: boolean }>>`SELECT relrowsecurity FROM pg_class WHERE oid = '"AiCallLog"'::regclass`;
  assert.equal(rows[0].relrowsecurity, true);
});
