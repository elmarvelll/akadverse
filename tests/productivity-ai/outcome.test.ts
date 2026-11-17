import { before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { interruptedOutcome } from "@/services/productivity-layer/assistant/outcome";

const scope = { sub: "owner-A", cid: "conversation-A", turn: "turn-A" };
let outcomes: { toolName: string; status: string; result: unknown }[] = [];
let created: Record<string, unknown>[] = [];
let queries: Record<string, unknown>[] = [];
let locked = false;
let expired = true;
let active = true;
const tx = {
  $queryRaw: async () => { locked = true; return []; },
  user: { findUnique: async () => ({ role: "student" }) },
  productivityAIConversation: {
    findFirst: async () => ({ activeTurnId: active ? scope.turn : "different-turn", leaseExpiresAt: new Date(Date.now() + (expired ? -1000 : 60000)) }),
    update: async () => ({}),
  },
  productivityAIMessage: {
    findFirst: async () => ({ sequence: 0, status: "processing" }),
    create: async ({ data }: { data: Record<string, unknown> }) => { created.push(data); return data; },
    update: async () => ({}),
  },
  productivityAIToolExecution: { findMany: async (query: Record<string, unknown>) => {
    assert.ok(locked, "outcomes must be read under the mutation owner lock"); queries.push(query); return outcomes;
  } },
};
mock.module("@/lib/prisma", { namedExports: { prisma: { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) } } });
mock.module("@/services/productivity-layer/auth", { namedExports: { requireProductivityActor: async () => ({}) } });
let finishTurn: typeof import("@/services/productivity-layer/assistant/store").finishTurn;
before(async () => { ({ finishTurn } = await import("@/services/productivity-layer/assistant/store")); });
beforeEach(() => { outcomes = []; created = []; queries = []; locked = false; expired = true; active = true; });
const saved = { toolName: "create_task", status: "completed", result: { saved: true, task: { title: "Read chapter 2" } } };

it("summarizes only confirmed changes and distinguishes partial, unknown and proposed actions", () => {
  const text = interruptedOutcome([saved,
    { toolName: "save_event", status: "unknown", result: { event: { title: "Unconfirmed event" } } },
    { toolName: "delete_task", status: "awaiting_confirmation", result: null },
    { toolName: "save_habit", status: "failed", result: null },
  ])!;
  assert.match(text, /Created task: "Read chapter 2"/);
  assert.match(text, /other requested steps may be incomplete/);
  assert.match(text, /Recheck outcome/);
  assert.match(text, /has not been saved/);
  assert.doesNotMatch(text, /Unconfirmed event|Deleted task|Saved habit/);
  assert.equal(interruptedOutcome([{ toolName: "list_tasks", status: "completed", result: [] }]), undefined);
});

it("uses durable turn outcomes when the provider or transport fails without repeating writes", async () => {
  outcomes = [saved];
  await finishTurn(scope, "Provider timeout", "failed");
  assert.match(String(created[0].content), /Created task: "Read chapter 2"/);
  assert.equal(created[0].status, "failed", "partial completion must not claim the whole request succeeded");
  assert.deepEqual(queries[0].where, { ownerId: scope.sub, conversationId: scope.cid, messageId: scope.turn });
});

it("recovers expired turns but leaves a live worker and a different turn alone", async () => {
  outcomes = [saved]; expired = false;
  await finishTurn(scope, "Interrupted", "interrupted", true);
  assert.equal(created.length, 0); assert.equal(queries.length, 0);
  expired = true;
  await finishTurn(scope, "Interrupted", "interrupted", true);
  assert.match(String(created[0].content), /Read chapter 2/);
  active = false;
  await finishTurn(scope, "Late response", "failed");
  assert.equal(created.length, 1);
});

it("preserves normal replies and failure guidance when there is no confirmed change", async () => {
  await finishTurn(scope, "Database unavailable", "failed");
  assert.equal(created[0].content, "Database unavailable");
  outcomes = [saved];
  await finishTurn(scope, "Your task was created.", "completed");
  assert.equal(created[1].content, "Your task was created.");
});

it("reports completed Buddy writes after an interrupted reply without claiming pending writes succeeded", () => {
  const text = interruptedOutcome([
    { toolName: "create_buddy_group", status: "completed", result: { saved: true, buddy: { id: "listing-1" } } },
    { toolName: "accept_buddy_application", status: "awaiting_confirmation", result: null },
  ])!;
  assert.match(text, /Created buddy group listing/);
  assert.doesNotMatch(text, /Accepted buddy applicant/);
  assert.match(text, /has not been saved/);
});
