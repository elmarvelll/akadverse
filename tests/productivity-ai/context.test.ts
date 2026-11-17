import { before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
let queries: { kind: string; query: Record<string, unknown> }[] = [];
let release: () => void;
let gate: Promise<void>;
let timezone = "Africa/Lagos";
async function read(kind: string, query: Record<string, unknown>, result: unknown) {
  queries.push({ kind, query }); await gate; return result;
}
mock.module("@/lib/prisma", { namedExports: { prisma: {
  productivityAIMessage: { findMany: (q: Record<string, unknown>) => read("messages", q, [{ id: "latest", sequence: 2 }, { id: "earlier", sequence: 1 }]) },
  productivityAIToolExecution: { findMany: (q: Record<string, unknown>) => read("executions", q, [{ id: "execution-1", result: { long: "x".repeat(7000) } }]) },
  productivityAIPendingAction: { findMany: (q: Record<string, unknown>) => read("pending", q, [{ id: "proposal-1", preview: { tool: "delete_task", arguments: { task_id: "task-1" }, current: { privateSnapshot: true } }, expiresAt: new Date(Date.now() + 10000) }]) },
  productivityPreferences: { findUnique: (q: Record<string, unknown>) => read("preference", q, { timezone }) },
} } });
let assistantContext: typeof import("@/services/productivity-layer/assistant/context").assistantContext;
before(async () => { ({ assistantContext } = await import("@/services/productivity-layer/assistant/context")); });
beforeEach(() => { queries = []; timezone = "Africa/Lagos"; gate = new Promise(resolve => { release = resolve; }); });
const scope = { sub: "student-A", cid: "conversation-A", turn: "turn-A" };
const actor = { id: "student-A", firstName: "Ada", lastName: "Student", email: "test@example.test", role: "student" as const };
it("loads exactly four bounded owner-scoped datasets concurrently, preserving chronological messages", async () => {
  const loading = assistantContext(scope, actor);
  assert.equal(queries.length, 4, "all reads start before any completes");
  release();
  const context = await loading;
  assert.deepEqual(context.messages.map(row => row.id), ["earlier", "latest"]);
  for (const { kind, query } of queries) {
    assert.equal((query.where as Record<string, unknown>).ownerId, scope.sub);
    if (kind !== "preference") assert.equal((query.where as Record<string, unknown>).conversationId, scope.cid);
    if (kind === "messages") assert.equal(query.take, 24);
    if (kind === "executions") assert.equal(query.take, 10);
    if (kind === "pending") assert.ok((query.where as Record<string, unknown>).expiresAt);
  }
  assert.equal(context.account.student.timezone, "Africa/Lagos");
  assert.ok(context.account.localNow.date);
  assert.equal((context.executions[0].result as { omitted?: boolean }).omitted, true);
  assert.equal("current" in context.pending[0].preview, false);
});
it("does not cache account preferences or reuse another account's scope", async () => {
  timezone = "America/New_York"; release();
  const context = await assistantContext({ sub: "student-B", cid: "conversation-B", turn: "turn-B" }, { ...actor, id: "student-B" });
  assert.equal(context.account.student.id, "student-B");
  assert.equal(context.account.student.timezone, "America/New_York");
  assert.ok(queries.every(({ query }) => (query.where as Record<string, unknown>).ownerId === "student-B"));
});
