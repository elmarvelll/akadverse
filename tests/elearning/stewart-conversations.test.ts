import "../helpers/env";
import { signInAs } from "../helpers/session";
import { after, before, beforeEach, it, mock } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { elearningDb } from "@/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { contextualQuestion } from "@/services/e-learning/student/stewart/chat";
import { conversationTitle } from "@/services/e-learning/student/stewart/conversation-title";
let academicContext: CurrentAcademicContext | null = null;
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => academicContext } });
let collection: typeof import("@/app/api/e-learning/stewart/conversations/route");
let detail: typeof import("@/app/api/e-learning/stewart/conversations/[id]/route");
let messages: typeof import("@/app/api/e-learning/stewart/conversations/[id]/messages/route");
let upload: typeof import("@/app/api/e-learning/stewart/attachments/route").POST;
let scenario: Awaited<ReturnType<typeof courseScenario>>;
const originalFetch = globalThis.fetch;
let calls: { path: string; body: Record<string, unknown> }[];
let fail = false;
let gate: Promise<void> | undefined;
let uploadedIds: string[];
before(async () => {
  collection = await import("@/app/api/e-learning/stewart/conversations/route");
  detail = await import("@/app/api/e-learning/stewart/conversations/[id]/route");
  messages = await import("@/app/api/e-learning/stewart/conversations/[id]/messages/route");
  ({ POST: upload } = await import("@/app/api/e-learning/stewart/attachments/route"));
});
beforeEach(async () => {
  scenario = await courseScenario(); academicContext = scenario.ctx;
  signInAs({ id: scenario.studentId, email: "student@example.test" }); calls = []; fail = false; gate = undefined; uploadedIds = [];
  process.env.CONCEPT_EXPLAINER_API_URL = "https://concept.example.test"; process.env.AI_SERVICE_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    if (path === "/attachments") {
      const file = (init!.body as FormData).get("file") as File; const id = randomUUID(); uploadedIds.push(id);
      return Response.json({ attachment_id: id, filename: file.name, mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 3600000).toISOString() });
    }
    if (init?.method === "DELETE") { uploadedIds = uploadedIds.filter((id) => !path.endsWith(id)); return new Response(null, { status: 204 }); }
    const body = init?.body instanceof FormData ? { question: init.body.get("question") } : JSON.parse(init!.body as string);
    calls.push({ path, body }); if (gate) await gate;
    if (fail) return Response.json({}, { status: 503 });
    return Response.json({ answer: "## Understanding Intra-group Conflict\n\nA saved **explanation**.", sources: [{ source_type: "ai_generated", title: "Example", document_id: null, material_type: "AI_GENERATED" }], retrieval_info: { chunks_available: 2 } });
  };
});
after(async () => { globalThis.fetch = originalFetch; await elearningDb.$disconnect(); });
const json = (url: string, body: unknown, method = "POST") => new Request(`https://app.test${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function create(extra = {}) { return collection.POST(json("/conversations", { courseId: scenario.course.id, weekNumber: 3, clientKey: randomUUID(), message: "pls explain intra group conflict", requestId: randomUUID(), ...extra })); }
async function created(extra = {}) { const res = await create(extra); assert.equal(res.status, 201, JSON.stringify(await res.clone().json())); return (await res.json()).conversation; }
function send(id: string, requestId = randomUUID(), content = "pls explain intra group conflict", extra = {}) { return messages.POST(json(`/conversations/${id}/messages`, { requestId, content, ...extra }), params(id)); }
function get(id: string, before?: string) { return detail.GET(new Request(`https://app.test/conversations/${id}${before ? `?before=${before}` : ""}`), params(id)); }
function remove(id: string) { return detail.DELETE(new Request(`https://app.test/conversations/${id}`, { method: "DELETE" }), params(id)); }
it("creates an owned conversation with its first user message, no greeting record, and an idempotent creation key", async () => {
  const clientKey = randomUUID(), requestId = randomUUID();
  const a = await created({ clientKey, requestId, userId: "forged-user" }); const b = await created({ clientKey, requestId }); assert.equal(a.id, b.id);
  const stored = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: a.id }, include: { messages: true } });
  assert.equal(stored.userId, scenario.studentId); assert.equal(stored.messages.length, 1); assert.equal(stored.messages[0].role, "USER"); assert.equal(stored.messages[0].content, "pls explain intra group conflict");
  assert.equal(stored.messages[0].status, "FAILED"); assert.ok(!stored.title.includes("New Chat"));
});
it("persists both roles, full source metadata and a generated title, and reloads them chronologically", async () => {
  const requestId = randomUUID(); const c = await created({ requestId });
  const response = await send(c.id, requestId); assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.conversation.title, "Understanding Intra-group Conflict");
  const loaded = await (await get(c.id)).json(); assert.equal(loaded.messages.length, 2);
  assert.deepEqual(loaded.messages.map((m: { role: string }) => m.role), ["USER", "ASSISTANT"]);
  assert.equal(loaded.messages[1].metadata.sources[0].source_type, "ai_generated");
  assert.equal(loaded.messages[1].metadata.retrieval_info.chunks_available, 2);
  assert.equal(loaded.messages[1].content, result.reply);
  const list = await collection.GET(new Request("https://app.test/conversations")); assert.equal((await list.json()).conversations[0].id, c.id);
});
it("continues older conversations with their own stable session and bounded, server-loaded history", async () => {
  const c = await created(); assert.equal((await send(c.id)).status, 200);
  const next = await send(c.id, randomUUID(), "How does this affect the team?"); assert.equal(next.status, 200);
  assert.equal(calls.length, 2); assert.equal(calls[0].body.session_id, calls[1].body.session_id);
  assert.ok(String(calls[1].body.question).includes("Previous conversation"));
  assert.ok(String(calls[1].body.question).includes("A saved **explanation**."));
  assert.ok(String(calls[1].body.question).endsWith("How does this affect the team?"));
  assert.equal(calls[1].body.messages, undefined); assert.equal(calls[1].body.history, undefined);
  assert.ok(String(calls[1].body.question).length <= 4000);
  assert.equal((await (await get(c.id)).json()).messages.length, 5, "a distinct first request leaves the seeded unanswered message intact");
  assert.equal((await (await get(c.id)).json()).conversation.title, "Understanding Intra-group Conflict");
});
it("gives multiple independent conversations distinct sessions and isolated histories", async () => {
  const first = await created(); const second = await created({ message: "Explain voltage" });
  assert.equal((await send(first.id)).status, 200); assert.equal((await send(second.id, randomUUID(), "Explain voltage")).status, 200);
  assert.notEqual(calls[0].body.session_id, calls[1].body.session_id);
  assert.equal(calls[1].body.question, "Explain voltage");
  assert.notEqual(first.id, second.id);
});
it("retains a failed user message and retries once without duplicate user or assistant records", async () => {
  const requestId = randomUUID(); const c = await created({ requestId }); fail = true;
  assert.equal((await send(c.id, requestId)).status, 503);
  let rows = await elearningDb.chatMessage.findMany({ where: { conversationId: c.id } }); assert.equal(rows.length, 1); assert.equal(rows[0].status, "FAILED");
  fail = false; assert.equal((await send(c.id, requestId)).status, 200); assert.equal((await send(c.id, requestId)).status, 200);
  rows = await elearningDb.chatMessage.findMany({ where: { conversationId: c.id } }); assert.equal(rows.length, 2); assert.ok(rows.every((m) => m.status === "COMPLETE"));
  assert.equal(calls.length, 2, "completed retry is served from the saved response");
  assert.equal((await send(c.id, requestId, "A different question")).status, 409);
  assert.equal((await send(c.id, requestId, "pls explain intra group conflict", { grounded: true })).status, 409);
});
it("enforces ownership for list, read, send, cursor and delete even when the browser supplies a forged userId", async () => {
  const c = await created(); const other = await scenario.makeStudent("APPROVED"); signInAs({ id: other, email: "other@example.test" });
  assert.equal((await get(c.id)).status, 404); assert.equal((await send(c.id)).status, 404); assert.equal((await remove(c.id)).status, 404);
  const list = await (await collection.GET(new Request("https://app.test/conversations"))).json(); assert.equal(list.conversations.length, 0);
  assert.equal((await collection.GET(new Request(`https://app.test/conversations?before=${c.id}`))).status, 404);
  assert.equal(calls.length, 0);
});
it("rejects unauthenticated access and new conversations without academic authorization", async () => {
  signInAs(null); assert.equal((await create()).status, 401); assert.equal((await collection.GET(new Request("https://app.test/conversations"))).status, 401); assert.equal((await get("unknown")).status, 401);
  const unregistered = await scenario.makeStudent(null); signInAs({ id: unregistered, email: "other@example.test" }); assert.equal((await create()).status, 404);
});
it("serializes a conversation, blocks deletion during generation, and leaves independent requests isolated", async () => {
  const requestId = randomUUID(); const c = await created({ requestId }); let finish!: () => void; gate = new Promise<void>((resolve) => { finish = resolve; });
  const active = send(c.id, requestId);
  for (let i = 0; i < 100 && !calls.length; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  try { assert.equal((await send(c.id, requestId)).status, 409); assert.equal((await send(c.id, randomUUID(), "Another question")).status, 409); assert.equal((await remove(c.id)).status, 409); }
  finally { finish(); }
  assert.equal((await active).status, 200); assert.equal(calls.length, 1);
});
it("deletes owned history with a cascading message FK and cleans remote attachment references", async () => {
  const requestId = randomUUID(); const c = await created({ requestId });
  const form = new FormData(); form.set("file", new File(["Recursion stops at the base case."], "notes.txt", { type: "text/plain" })); form.set("courseId", scenario.course.id); form.set("weekNumber", "3"); form.set("conversationId", c.id);
  const result = await upload(new Request("https://app.test/attachments", { method: "POST", body: form })); assert.equal(result.status, 200);
  const attachment = (await result.json()).attachment;
  assert.equal((await send(c.id, requestId, "pls explain intra group conflict", { attachment_ids: [attachment.attachment_id] })).status, 200);
  assert.equal((await remove(c.id)).status, 200); assert.equal((await get(c.id)).status, 404);
  assert.equal(await elearningDb.chatMessage.count({ where: { conversationId: c.id } }), 0); assert.equal(uploadedIds.length, 0);
});
it("does not accept another conversation's attachments even for the same student", async () => {
  const a = await created(); const b = await created();
  const row = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: a.id } });
  const attachmentId = randomUUID(); await elearningDb.stewartAttachment.create({ data: { userId: scenario.studentId, sessionId: row.sessionId, uploadKey: randomUUID(), attachmentId, filename: "a.txt", mimeType: "text/plain", sizeBytes: 1, status: "uploaded", expiresAt: new Date(Date.now() + 10000) } });
  assert.equal((await send(b.id, randomUUID(), "Explain", { attachment_ids: [attachmentId] })).status, 403); assert.equal(calls.length, 0);
});
it("paginates conversation summaries and messages without mixing owners or loading every message", async () => {
  const a = await created(); const b = await created();
  const first = await (await collection.GET(new Request("https://app.test/conversations?limit=1"))).json(); assert.equal(first.conversations.length, 1); assert.equal(first.conversations[0].messages, undefined);
  const second = await (await collection.GET(new Request(`https://app.test/conversations?limit=1&before=${first.nextCursor}`))).json(); assert.equal(second.conversations.length, 1); assert.notEqual(second.conversations[0].id, first.conversations[0].id);
  const base = Date.now(); await elearningDb.chatMessage.createMany({ data: Array.from({ length: 65 }, (_, i) => ({ id: `history-${a.id}-${i.toString().padStart(3, "0")}`, conversationId: a.id, role: "ASSISTANT" as const, requestId: randomUUID(), content: `Saved ${i}`, createdAt: new Date(base + i) })) });
  const recent = await (await get(a.id)).json(); assert.equal(recent.messages.length, 50); assert.ok(recent.nextCursor);
  const older = await (await get(a.id, recent.nextCursor)).json(); assert.equal(older.messages.length, 16);
  assert.ok(older.messages.every((m: { conversationId: string }) => m.conversationId === a.id));
  assert.equal((await get(b.id, recent.messages[0].id)).status, 400);
});
it("bounds history without truncating the current question or introducing undocumented fields", () => {
  const history = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "stewart" as const : "student" as const, text: `Turn ${i} ` + "x".repeat(5000) }));
  assert.ok(contextualQuestion("Current question", history).length <= 4000);
  assert.ok(!contextualQuestion("Current question", history).includes("Turn 0 "));
  assert.equal(contextualQuestion("x".repeat(4000), history), "x".repeat(4000));
  assert.equal(conversationTitle("pls explain intra group conflict", "### Understanding Intra-group Conflict"), "Understanding Intra-group Conflict");
  assert.equal(conversationTitle("pls explain intra group conflict", "A plain answer."), "Intra group conflict");
  assert.equal(conversationTitle("pls explain intra group conflict", "## Concept\n\nConflict.\n\n### Example 1\n\nA team."), "Intra group conflict");
});
it("generates the subject title once, without an extra AI request, and updates activity timestamps", async () => {
  const requestId = randomUUID(); const c = await created({ requestId });
  await send(c.id, requestId);
  const first = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: c.id } });
  globalThis.fetch = async (_url, init) => { calls.push({ path: "/explain", body: JSON.parse(init!.body as string) }); return Response.json({ answer: "## A Completely Different Heading\n\nFollow-up answer.", sources: [] }); };
  assert.equal((await send(c.id, randomUUID(), "A follow-up question")).status, 200);
  const next = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(next.title, first.title); assert.equal(next.titleGenerated, true); assert.ok(next.updatedAt > first.updatedAt); assert.equal(calls.length, 2);
});
it("rejects stale generation completions and stale lease release after another request takes over", async () => {
  const { reserveMessage, completeMessage, failMessage } = await import("@/services/e-learning/student/stewart/conversations");
  const requestId = randomUUID(); const c = await created({ requestId });
  const first = await reserveMessage(scenario.studentId, c.id, requestId, "pls explain intra group conflict", { grounded: false }); assert.equal(first.cached, false); if (first.cached) return;
  await elearningDb.chatConversation.update({ where: { id: c.id }, data: { pendingUntil: new Date(Date.now() - 1) } });
  const nextId = randomUUID(); const second = await reserveMessage(scenario.studentId, c.id, nextId, "A newer question", { grounded: false }); assert.equal(second.cached, false); if (second.cached) return;
  await assert.rejects(completeMessage(scenario.studentId, c.id, requestId, first.token, "old", "Old answer", {}));
  await failMessage(scenario.studentId, c.id, requestId, first.token);
  assert.equal((await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: c.id } })).pendingToken, second.token);
  await completeMessage(scenario.studentId, c.id, nextId, second.token, "A newer question", "Current answer", {});
  assert.equal(await elearningDb.chatMessage.count({ where: { conversationId: c.id, role: "ASSISTANT" } }), 1);
});
it("keeps expired references visible after refresh and metadata cleanup, instead of sending without them", async () => {
  const c = await created(); const row = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: c.id } });
  const attachmentId = randomUUID();
  await elearningDb.stewartAttachment.create({ data: { userId: scenario.studentId, sessionId: row.sessionId, uploadKey: randomUUID(), attachmentId, filename: "old.txt", mimeType: "text/plain", sizeBytes: 3, status: "uploaded", expiresAt: new Date(Date.now() - 3 * 86400000) } });
  const { storeAttachment } = await import("@/services/e-learning/student/stewart/attachment-store");
  await storeAttachment(scenario.studentId, row.sessionId, new File(["Fresh supporting notes."], "fresh.txt", { type: "text/plain" }), c.id);
  const response = await (await get(c.id)).json(); assert.ok(response.attachments.some((a: { attachment_id: string }) => a.attachment_id === attachmentId));
  assert.equal((await send(c.id, randomUUID(), "Explain", { attachment_ids: [attachmentId] })).status, 422); assert.equal(calls.length, 0);
});
it("restores rejected remote references as requiring reattachment, with their original expiry metadata", async () => {
  const c = await created(); const row = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: c.id } });
  const attachmentId = randomUUID(); const expiresAt = new Date(Date.now() + 3600000);
  await elearningDb.stewartAttachment.create({ data: { userId: scenario.studentId, sessionId: row.sessionId, uploadKey: randomUUID(), attachmentId, filename: "unreadable.png", mimeType: "image/png", sizeBytes: 1, status: "failed", expiresAt } });
  const response = await (await get(c.id)).json(); assert.equal(response.attachments[0].requires_reattach, true); assert.equal(response.attachments[0].expires_at, expiresAt.toISOString());
});
