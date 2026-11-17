import "../helpers/env";
import { before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
let reads: { name: string; query: Record<string, unknown> }[] = [];
let release: () => void;
let gate: Promise<void>;
let owned = true;
async function read(name: string, query: Record<string, unknown>, value: unknown) { reads.push({ name, query }); await gate; return value; }
mock.module("@/lib/prisma", { namedExports: { prisma: {
  productivityPreferences: { findUnique: (q: Record<string, unknown>) => read("preferences", q, { timezone: "Africa/Lagos" }) },
  productivityEvent: { findMany: (q: Record<string, unknown>) => read("events", q, []) },
  productivityCategory: { findMany: (q: Record<string, unknown>) => read("categories", q, []) },
  productivityHabit: { findMany: (q: Record<string, unknown>) => read("habits", q, []) },
  $transaction: () => { throw Error("Read-only history must not take a write lock"); },
} } });
mock.module("@/services/productivity-layer/auth", { namedExports: { requireProductivityActor: async () => ({}) } });
mock.module("@/services/productivity-layer/academics", { namedExports: { officialClasses: async () => [] } });
mock.module("@/lib/db/elearning", { namedExports: { elearningDb: {
  chatConversation: { findFirst: async () => owned ? { id: "conversation", userId: "student", sessionId: "session", clientKey: "test", pendingUntil: null } : null },
  chatMessage: { findMany: (q: Record<string, unknown>) => read("messages", q, []) },
  stewartAttachment: { findMany: (q: Record<string, unknown>) => read("attachments", q, []) },
} } });
let workspaceView: typeof import("@/services/productivity-layer/views").workspaceView;
let assertTurn: typeof import("@/services/productivity-layer/assistant/store").assertTurn;
let getConversation: typeof import("@/services/e-learning/student/stewart/conversations").getConversation;
before(async () => {
  ({ workspaceView } = await import("@/services/productivity-layer/views"));
  ({ assertTurn } = await import("@/services/productivity-layer/assistant/store"));
  ({ getConversation } = await import("@/services/e-learning/student/stewart/conversations"));
});
beforeEach(() => { reads = []; owned = true; gate = new Promise(resolve => { release = resolve; }); });
it("starts all four event-history reads together without a write transaction", async () => {
  const result = workspaceView({ id: "student", firstName: "A", lastName: "Student", email: "a@example.test", role: "student" }, { section: "schedule", history: true, page: 2, categoryId: "category" });
  assert.deepEqual(reads.map(r => r.name), ["preferences", "events", "categories", "habits"]);
  for (const { query } of reads) assert.equal((query.where as { ownerId: string }).ownerId, "student");
  const events = reads.find(r => r.name === "events")!.query;
  assert.equal(events.take, 101); assert.equal(events.skip, 200); assert.equal((events.where as { categoryId: string }).categoryId, "category");
  release(); const snapshot = await result; assert.equal(snapshot.student.timezone, "Africa/Lagos"); assert.equal(snapshot.hasMore, false);
});
it("starts both PIP turn-fencing reads before either settles and still rejects expired/missing turns", async () => {
  const scope = { sub: "student", cid: "conversation", turn: "turn" };
  let expired = false, missing = false;
  const tx = {
    productivityAIConversation: { findFirst: (q: Record<string, unknown>) => read("turn-conversation", q, { activeTurnId: scope.turn, leaseExpiresAt: new Date(Date.now() + (expired ? -1000 : 10000)) }) },
    productivityAIMessage: { findFirst: (q: Record<string, unknown>) => read("turn-message", q, missing ? null : { id: scope.turn }) },
  } as unknown as Prisma.TransactionClient;
  const pending = assertTurn(tx, scope); assert.equal(reads.length, 2);
  assert.equal((reads[1].query.where as { ownerId: string }).ownerId, scope.sub);
  assert.equal((reads[1].query.where as { conversationId: string }).conversationId, scope.cid);
  release(); await pending;
  expired = true; await assert.rejects(assertTurn(tx, scope), /turn has ended/);
  expired = false; missing = true; await assert.rejects(assertTurn(tx, scope), /no longer active/);
});
it("overlaps Stewart message and attachment history only after ownership succeeds", async () => {
  const pending = getConversation("student", "conversation");
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(reads.map(r => r.name), ["messages", "attachments"]);
  assert.equal((reads[1].query.where as { userId: string }).userId, "student");
  assert.equal((reads[1].query.where as { sessionId: string }).sessionId, "session");
  release(); assert.deepEqual((await pending).messages, []);
  reads = []; owned = false;
  await assert.rejects(getConversation("other", "conversation"), /isn't available/);
  assert.equal(reads.length, 0);
});
it("Stewart timing preserves results and failures without logging content", async () => {
  const { stewartTiming } = await import("@/services/e-learning/student/stewart/timing");
  const log = mock.method(console, "info", () => {});
  try {
    assert.equal(await stewartTiming("provider", "opaque-reference", async () => "private answer"), "private answer");
    const failure = Error("private provider URL and token");
    await assert.rejects(stewartTiming("provider", "opaque-reference", async () => { throw failure; }), error => error === failure);
    const calls = log.mock.calls;
    assert.equal(calls[0].arguments[1].completed, true);
    assert.equal(calls[1].arguments[1].completed, false);
    assert.ok(!JSON.stringify(calls).includes("private"));
  } finally { log.mock.restore(); }
});
