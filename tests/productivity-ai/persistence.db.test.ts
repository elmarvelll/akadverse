import "../helpers/env";
import { after, before, it, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../helpers/fixtures";
import { executeProductivityAs } from "@/services/productivity-layer/operations";
import { createConversation, beginTurn, finishTurn, conversationView, deleteConversation } from "@/services/productivity-layer/assistant/store";
import { signDelegation, verifyDelegation } from "@/services/productivity-layer/assistant/security";
import { generateKeyPairSync } from "node:crypto";
import { localNow } from "@/features/productivity/schedule/domain";
import { executeTool, performMutation } from "@/services/productivity-layer/assistant/tools";
import { chat, decide, reconcile, serviceCallback } from "@/services/productivity-layer/assistant/service";
mock.module("@/services/productivity-layer/academics", { namedExports: { officialClasses: async () => [] } });
let a: string, b: string;
before(async () => { a = (await makeUser()).id; b = (await makeUser()).id; });
after(async () => { await prisma.user.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); await prisma.$disconnect(); });
async function start() { const c = await createConversation(a), turn = await beginTurn(a, c.id, randomUUID(), "Create a test task"); return { sub: a, cid: c.id, turn: turn.turn }; }
const input = { input: { title: "Assistant integration task", priority: "medium" } };
async function create(scope: Awaited<ReturnType<typeof start>>, step = 0) {
  const result = await executeTool(scope, step, "create_task", input);
  assert.equal(result.status, "completed");
  const row = await prisma.productivityTask.findFirstOrThrow({ where: { ownerId: a, data: { path: ["title"], equals: input.input.title } }, orderBy: { createdAt: "desc" } });
  const execution = await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { messageId_step: { messageId: scope.turn, step } } });
  const saved = execution.result as { task: { id: string } }; assert.ok(saved.task.id);
  return { id: saved.task.id, execution, row };
}
it("commits task, receipt and actual execution result together and replays a lost response without duplicates", async () => {
  const scope = await start(), before = await prisma.productivityTask.count({ where: { ownerId: a } });
  const task = await create(scope);
  const repeat = await executeTool(scope, 0, "create_task", input); assert.equal(repeat.status, "completed");
  assert.equal(await prisma.productivityTask.count({ where: { ownerId: a } }), before + 1);
  assert.ok(await prisma.productivityRequest.findUnique({ where: { ownerId_key: { ownerId: a, key: task.execution.operationKey } } }));
  await assert.rejects(executeTool(scope, 0, "create_task", { input: { title: "Changed payload", priority: "medium" } }));
  await finishTurn(scope, "Saved");
  const retried = await beginTurn(a, scope.cid, (await prisma.productivityAIMessage.findUniqueOrThrow({ where: { id: scope.turn } })).clientKey, "Create a test task");
  assert.equal(retried.started, false);
});
it("requires an owning browser decision for deletion and consumes confirmation once", async () => {
  const scope = await start(), task = await create(scope);
  const proposal = await executeTool(scope, 1, "delete_task", { task_id: task.id }); assert.equal(proposal.status, "awaiting_confirmation");
  assert.equal((await prisma.productivityTask.findUniqueOrThrow({ where: { id: task.id } })).deletedAt, null);
  const pending = await prisma.productivityAIPendingAction.findUniqueOrThrow({ where: { executionId: (await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { messageId_step: { messageId: scope.turn, step: 1 } } })).id } });
  await assert.rejects(serviceCallback({ ...scope, iss: "test", aud: "test", exp: 9999999999, iat: 0, jti: "test" }, { action: "confirm", pending_id: pending.id }));
  await assert.rejects(decide(b, scope.cid, randomUUID(), pending.id, true));
  await finishTurn(scope, "Please confirm", "awaiting_confirmation");
  const key = randomUUID(); await decide(a, scope.cid, key, pending.id, true);
  assert.ok((await prisma.productivityTask.findUniqueOrThrow({ where: { id: task.id } })).deletedAt);
  await decide(a, scope.cid, key, pending.id, true);
  assert.equal((await prisma.productivityAIPendingAction.findUniqueOrThrow({ where: { id: pending.id } })).status, "confirmed");
});
it("rejects changed targets and expired proposals while retaining the record", async () => {
  for (const stale of [true, false]) {
    const scope = await start(), task = await create(scope);
    await executeTool(scope, 1, "delete_task", { task_id: task.id });
    const execution = await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { messageId_step: { messageId: scope.turn, step: 1 } } });
    const pending = await prisma.productivityAIPendingAction.findUniqueOrThrow({ where: { executionId: execution.id } });
    if (stale) await executeProductivityAs(a, { operation: "tasks.update", args: [task.id, { title: "Changed after preview", priority: "high" }], requestId: randomUUID() });
    else await prisma.productivityAIPendingAction.update({ where: { id: pending.id }, data: { expiresAt: new Date(0) } });
    await finishTurn(scope, "Confirm", "awaiting_confirmation"); await decide(a, scope.cid, randomUUID(), pending.id, true);
    assert.equal((await prisma.productivityTask.findUniqueOrThrow({ where: { id: task.id } })).deletedAt, null);
    assert.equal((await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { id: execution.id } })).status, "failed");
  }
});
it("scopes conversations, callbacks and tools to the signed actor and fences completed turns", async () => {
  const scope = await start();
  await assert.rejects(conversationView(b, scope.cid));
  await assert.rejects(executeTool({ ...scope, sub: b }, 0, "create_task", input));
  await finishTurn(scope, "Done");
  await assert.rejects(executeTool(scope, 0, "create_task", input));
  await prisma.user.update({ where: { id: a }, data: { role: "faculty" } });
  try { await assert.rejects(executeProductivityAs(a, { operation: "tasks.list", args: [] })); }
  finally { await prisma.user.update({ where: { id: a }, data: { role: "student" } }); }
});
it("serialises concurrent conversation turns and recovers an expired worker without executing it", async () => {
  const c = await createConversation(a);
  const results = await Promise.allSettled([beginTurn(a, c.id, randomUUID(), "First"), beginTurn(a, c.id, randomUUID(), "Second")]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  const conversation = await prisma.productivityAIConversation.findUniqueOrThrow({ where: { id: c.id } });
  await prisma.productivityAIConversation.update({ where: { id: c.id }, data: { leaseExpiresAt: new Date(0) } });
  const view = await conversationView(a, c.id); assert.equal(view.messages.at(-1)?.status, "interrupted");
  await assert.rejects(executeTool({ sub: a, cid: c.id, turn: conversation.activeTurnId! }, 0, "create_task", input));
});
it("rolls back the domain mutation and receipt if execution persistence fails", async () => {
  const count = await prisma.productivityTask.count({ where: { ownerId: a } }), requestId = randomUUID();
  await assert.rejects(executeProductivityAs(a, { operation: "tasks.create", args: [input.input], requestId }, { async authorize() {}, async commit() { throw new Error("Simulated execution persistence failure"); } }));
  assert.equal(await prisma.productivityTask.count({ where: { ownerId: a } }), count);
  assert.equal(await prisma.productivityRequest.findUnique({ where: { ownerId_key: { ownerId: a, key: requestId } } }), null);
});
it("reconciles an uncertain response from the original durable receipt", async () => {
  const scope = await start(), task = await create(scope);
  await prisma.productivityAIToolExecution.update({ where: { id: task.execution.id }, data: { status: "unknown" } });
  await finishTurn(scope, "Unknown", "failed");
  await reconcile(a, scope.cid, randomUUID(), task.execution.id);
  assert.equal((await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { id: task.execution.id } })).status, "completed");
});
it("uses existing habit and schedule services through the tool adapter, including confirmation-backed changes", async () => {
  const scope = await start();
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const habitResult = await executeTool(scope, 0, "save_habit", { input: { name: "Assistant daily reading", description: "Read course notes", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "", startDate: date } });
  assert.equal(habitResult.status, "completed");
  const categoryResult = await executeTool(scope, 1, "save_category", { name: `Assistant ${randomUUID().slice(0, 8)}`, description: "Study blocks", academic: true });
  assert.equal(categoryResult.status, "completed");
  const categoryExecution = await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { messageId_step: { messageId: scope.turn, step: 1 } } });
  const categoryId = (categoryExecution.result as { category: { id: string } }).category.id;
  const eventResult = await executeTool(scope, 2, "save_event", { input: { title: "Assistant study block", description: "Review chemistry notes", priority: "high", mustComplete: true, subScheduleId: categoryId, slot: { date, start: "15:00", end: "16:00", timezone: "Africa/Lagos" } } });
  assert.equal(eventResult.status, "completed");
  const eventExecution = await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { messageId_step: { messageId: scope.turn, step: 2 } } });
  const eventId = (eventExecution.result as { event: { id: string } }).event.id;
  const listed = await executeTool(scope, 3, "list_schedule", { start: date, end: date }); assert.equal(listed.status, "completed");
  const proposal = await executeTool(scope, 4, "set_backup", { event_id: eventId, slot: { date, start: "18:00", end: "19:00", timezone: "Africa/Lagos" } }); assert.equal(proposal.status, "awaiting_confirmation");
  const execution = await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { messageId_step: { messageId: scope.turn, step: 4 } } });
  const pending = await prisma.productivityAIPendingAction.findUniqueOrThrow({ where: { executionId: execution.id } });
  await finishTurn(scope, "Confirm backup", "awaiting_confirmation"); await decide(a, scope.cid, randomUUID(), pending.id, true);
  const event = await prisma.productivityEvent.findUniqueOrThrow({ where: { id: eventId } }); assert.equal((event.data as { backup: { start: string } }).backup.start, "18:00");
});

it("deletes owned conversation memory after confirmation while preserving saved work", async () => {
  const scope = await start(), task = await create(scope);
  await assert.rejects(deleteConversation(a, scope.cid, true));
  await finishTurn(scope, "Saved");
  await assert.rejects(deleteConversation(b, scope.cid, true));
  await assert.rejects(deleteConversation(a, scope.cid, false));
  await deleteConversation(a, scope.cid, true);
  assert.equal(await prisma.productivityAIConversation.findUnique({ where: { id: scope.cid } }), null);
  assert.ok(await prisma.productivityTask.findUnique({ where: { id: task.id } }));
  assert.equal(await prisma.productivityAIMessage.count({ where: { conversationId: scope.cid } }), 0);
});

it("bridges a chat turn through signed service callbacks and returns persisted confirmed results", async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.PRODUCTIVITY_AI_JWT_PRIVATE_KEY = pair.privateKey; process.env.PRODUCTIVITY_AI_JWT_PUBLIC_KEY = pair.publicKey;
  process.env.PRODUCTIVITY_AI_SERVICE_URL = "http://127.0.0.1:8000";
  process.env.PRODUCTIVITY_AI_SERVICE_TOKEN = "local-test-service-credential-at-least-32-chars";
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "http://127.0.0.1:8000/api/v1/assistant/chat");
    const headers = new Headers(init?.headers), request = JSON.parse(String(init?.body));
    const delegated = verifyDelegation(headers.get("authorization")!.slice(7), "akadverse-productivity-ai");
    const callback = verifyDelegation(request.callback_token);
    assert.equal(delegated.sub, a); assert.equal(delegated.cid, callback.cid); assert.equal(delegated.turn, callback.turn);
    assert.equal(headers.get("x-productivity-service-token"), process.env.PRODUCTIVITY_AI_SERVICE_TOKEN);
    await serviceCallback(callback, { action: "context" });
    const result = await serviceCallback(callback, { action: "tool", name: "create_task", step: 0, arguments: input }) as { status: string };
    assert.equal(result.status, "completed");
    return Response.json({ message: "The requested task was saved.", status: "completed" });
  };
  try {
    const conversation = await createConversation(a), key = randomUUID();
    const view = await chat(a, conversation.id, key, "Create a reading task");
    assert.equal(view.messages.at(-1)?.content, "The requested task was saved.");
    assert.equal(view.executions[0].status, "completed");
    const retried = await chat(a, conversation.id, key, "Create a reading task");
    assert.equal(retried.messages.length, 2); assert.equal(retried.executions.length, 1);
    assert.ok(signDelegation(a, conversation.id, "unused", "akadverse-productivity-backend"));
  } finally { globalThis.fetch = original; }
});

it("requires confirmation for habit corrections reached through general task tools and rechecks inside the transaction", async () => {
  const scope = await start(), today = localNow("Africa/Lagos").date;
  const habit = await executeProductivityAs(a, { operation: "habits.save", requestId: randomUUID(), args: [{ name: "Correction guard", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "", startDate: today }] }) as { savedOccurrences: { task?: { id: string } }[] };
  const taskId = habit.savedOccurrences.find(row => row.task)?.task?.id; assert.ok(taskId);
  assert.equal((await executeTool(scope, 0, "complete_task", { task_id: taskId })).status, "completed");
  assert.equal((await executeTool(scope, 1, "miss_task", { task_id: taskId })).status, "awaiting_confirmation");
  const execution = await prisma.productivityAIToolExecution.create({ data: { ownerId: a, conversationId: scope.cid, messageId: scope.turn, step: 2, toolName: "miss_task", arguments: { task_id: taskId }, operationKey: `ai:${scope.turn}:2` } });
  const result = await performMutation(scope, execution, { task_id: taskId });
  assert.equal(result.status, "failed");
  assert.equal((await prisma.productivityTask.findUniqueOrThrow({ where: { id: taskId } })).outcome, "completed");
});
