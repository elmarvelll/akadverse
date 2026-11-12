// Real AkadVerse routes + isolated local PostgreSQL; upstream HTTP is a recording fake.
import "../helpers/env";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { signInAs } from "../helpers/session";
import { courseScenario } from "../helpers/elearning-fixtures";
import { elearningDb } from "@/lib/db/elearning";
import { pdf, docx, pptx } from "../helpers/office-files";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
let academicContext: CurrentAcademicContext | null = null;
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => academicContext } });
let upload: typeof import("@/app/api/e-learning/stewart/attachments/route").POST;
let remove: typeof import("@/app/api/e-learning/stewart/attachments/route").DELETE;
let chat: typeof import("@/app/api/e-learning/stewart/chat/route").POST;
let scenario: Awaited<ReturnType<typeof courseScenario>>;
const originalFetch = globalThis.fetch;
const upstream = new Map<string, { file: File; expires: string }>();
let requests: { path: string; init?: RequestInit }[] = [];
let uploadFailure = 0;
let explainFailure = 0;
let deleteStatus = 204;
let explainGate: Promise<void> | undefined;
before(async () => {
  ({ POST: upload, DELETE: remove } = await import("@/app/api/e-learning/stewart/attachments/route"));
  ({ POST: chat } = await import("@/app/api/e-learning/stewart/chat/route"));
});
beforeEach(async () => {
  scenario = await courseScenario(); academicContext = scenario.ctx;
  signInAs({ id: scenario.studentId, email: "student@example.test" });
  requests = []; upstream.clear(); uploadFailure = 0; explainFailure = 0; deleteStatus = 204; explainGate = undefined;
  process.env.CONCEPT_EXPLAINER_API_URL = "https://concept.example.test";
  process.env.AI_SERVICE_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    requests.push({ path, init });
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    assert.equal(init?.redirect, "error");
    if (path === "/attachments") {
      if (uploadFailure) { const code = uploadFailure; uploadFailure = 0; return Response.json({ detail: "PRIVATE provider detail /tmp/key" }, { status: code }); }
      assert.ok(init?.body instanceof FormData);
      assert.deepEqual([...init.body.keys()], ["file"]);
      assert.equal(new Headers(init.headers).get("content-type"), null, "fetch must generate multipart boundary");
      const file = init.body.get("file") as File;
      const id = randomUUID(); const expires = new Date(Date.now() + 6 * 3600000).toISOString();
      upstream.set(id, { file, expires });
      return Response.json({ attachment_id: id, filename: file.name, mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(), expires_at: expires });
    }
    if (path.startsWith("/attachments/") && init?.method === "DELETE") return new Response(null, { status: deleteStatus });
    if (path === "/explain") {
      if (explainGate) await explainGate;
      if (explainFailure) return Response.json({ detail: "PRIVATE expired file details" }, { status: explainFailure });
      const body = JSON.parse(init?.body as string);
      const sources = (body.attachment_ids ?? []).map((id: string) => ({ title: upstream.get(id)?.file.name ?? "attachment", filename: upstream.get(id)?.file.name ?? "attachment", document_id: null, attachment_id: id, source_type: "attachment", material_type: "ATTACHMENT", chunk_preview: upstream.get(id)?.file.type.startsWith("image/") ? `[image: ${upstream.get(id)!.file.name}]` : "base case stops recursion" }));
      sources.push({ title: "Worked example", document_id: null, source_type: "ai_generated", material_type: "AI_GENERATED", chunk_preview: "[AI-GENERATED EXAMPLE]" });
      return Response.json({ answer: "Grounded answer", sources, retrieval_info: { chunks_available: 3, attachment_chunks_available: 2, attachment_images_count: 1 } });
    }
    throw new Error(`Unexpected upstream request ${path}`);
  };
});
after(async () => { globalThis.fetch = originalFetch; await elearningDb.$disconnect(); });
function context() { return { courseId: scenario.course.id, weekNumber: 3, documentId: null }; }
function file(name = "notes.txt", content: BlobPart | Uint8Array = "Recursion ends at the base case.") { return new File([content instanceof Uint8Array ? new Uint8Array(content) : content], name, { type: "application/octet-stream" }); }
function sendUpload(value = file(), extra: Record<string, string> = {}) {
  const form = new FormData(); form.set("file", value); form.set("courseId", scenario.course.id); form.set("weekNumber", "3");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return upload(new Request("https://app.test/attachments", { method: "POST", body: form }));
}
async function uploaded(value = file()) { const res = await sendUpload(value); assert.equal(res.status, 200, JSON.stringify(await res.clone().json())); return (await res.json()).attachment; }
function sendChat(ids: string[] = [], extra = {}) { return chat(new Request("https://app.test/chat", { method: "POST", body: JSON.stringify({ ...context(), messages: [{ role: "student", text: "Explain this equation and the base case." }], attachment_ids: ids, ...extra }) })); }
function sendRemove(id: string) { return remove(new Request("https://app.test/attachments", { method: "DELETE", body: JSON.stringify({ ...context(), attachment_id: id }) })); }
it("forwards each PDF, DOCX, PPTX, TXT and Markdown binary with canonical MIME", async () => {
  for (const value of [file("a.pdf", pdf()), file("a.docx", docx(["Notes"])), file("a.pptx", pptx([{ text: ["Notes"] }])), file(), file("notes.md", "# Notes")]) {
    const attachment = await uploaded(value);
    const stored = upstream.get(attachment.attachment_id)!;
    assert.deepEqual(Buffer.from(await stored.file.arrayBuffer()), Buffer.from(await value.arrayBuffer()));
    assert.notEqual(stored.file.type, "application/octet-stream");
    assert.equal(attachment.status, "uploaded");
    const res = await sendChat([attachment.attachment_id]); assert.equal(res.status, 200);
    const response = await res.json(); assert.equal(response.sources[0].attachment_id, attachment.attachment_id);
    assert.equal(response.sources[0].document_id, null);
  }
});
it("submits screenshot plus PDF plus TXT through the same explain request and preserves sources/counters", async () => {
  const png = await sharp({ create: { width: 60, height: 30, channels: 3, background: "white" } }).png().toBuffer();
  const attachments = await Promise.all([uploaded(file("equation.pdf", pdf())), uploaded(file()), uploaded(file("Screenshot-equation.png", png))]);
  const ids = attachments.map((a) => a.attachment_id);
  const first = await sendChat(ids); assert.equal(first.status, 200);
  const response = await first.json(); assert.equal(response.sources.length, 4);
  assert.equal(response.sources[2].chunk_preview, "[image: Screenshot-equation.png]");
  assert.equal(response.sources[3].source_type, "ai_generated");
  assert.equal(response.retrieval_info.attachment_images_count, 1);
  const payload = JSON.parse(requests.at(-1)!.init!.body as string);
  assert.deepEqual(payload.attachment_ids, ids);
  assert.equal(payload.course_offering_id, scenario.offering.id); assert.equal(payload.week, 3);
  assert.equal(payload.session_id, response.session_id);
  assert.ok(!JSON.stringify(payload).includes("base64"));
  const next = await (await sendChat(ids)).json(); assert.equal(next.session_id, response.session_id);
});
it("preserves text-only chat, sends a stable scoped session and never calls GET before explain", async () => {
  const first = await (await sendChat()).json(); const second = await (await sendChat()).json();
  assert.equal(first.session_id, second.session_id);
  assert.equal(JSON.parse(requests[0].init!.body as string).attachment_ids, undefined);
  assert.ok(requests.every((r) => r.path === "/explain"));
});
it("rejects unauthenticated, unregistered, unavailable document and invalid file requests before upstream", async () => {
  signInAs(null); assert.equal((await sendUpload()).status, 401); assert.equal((await sendChat()).status, 401);
  const other = await scenario.makeStudent(null); signInAs({ id: other, email: "other@example.test" }); assert.equal((await sendUpload()).status, 404);
  signInAs({ id: scenario.studentId, email: "student@example.test" });
  assert.equal((await sendUpload(file(), { documentId: "foreign-document" })).status, 404);
  for (const value of [file("a.exe"), file("a.doc"), file("a.txt", ""), file("a.png"), file("a.pdf"), file("a.txt", new Uint8Array(4 * 1024 * 1024 + 1))]) assert.ok([413, 422].includes((await sendUpload(value)).status));
  assert.equal(requests.length, 0);
});
it("retains partial upload successes and retries only failed files, deduplicating confirmed and ambiguous browser retries", async () => {
  const a = await uploaded(file("a.txt")); uploadFailure = 503;
  assert.equal((await sendUpload(file("b.txt"))).status, 503);
  const c = await uploaded(file("c.txt")); const b = await uploaded(file("b.txt"));
  const aAgain = await uploaded(file("a.txt")); assert.equal(aAgain.attachment_id, a.attachment_id);
  assert.equal(requests.filter((r) => r.path === "/attachments").length, 4);
  assert.equal((await sendChat([a.attachment_id, b.attachment_id, c.attachment_id])).status, 200);
});
it("enforces eight slots even with concurrent uploads and rejects a ninth and duplicate explain IDs", async () => {
  const results = await Promise.all(Array.from({ length: 9 }, (_, i) => sendUpload(file(`${i}.txt`))));
  assert.equal(results.filter((r) => r.status === 200).length, 8); assert.equal(results.filter((r) => r.status === 422).length, 1);
  const ids = [...upstream.keys()]; assert.equal((await sendChat(ids)).status, 200);
  assert.equal((await sendChat([...ids, randomUUID()])).status, 422);
  assert.equal((await sendChat([ids[0], ids[0]])).status, 422);
});
it("rejects cross-student and cross-conversation IDs before explain or deletion", async () => {
  const attachment = await uploaded(); const before = requests.length;
  const other = await scenario.makeStudent("APPROVED"); signInAs({ id: other, email: "other@example.test" });
  assert.equal((await sendChat([attachment.attachment_id])).status, 403);
  assert.equal((await sendRemove(attachment.attachment_id)).status, 403);
  assert.equal(requests.length, before);
});
it("rejects locally expired and unknown IDs and safely maps remote 422 to reattachment", async () => {
  const attachment = await uploaded();
  await elearningDb.stewartAttachment.update({ where: { attachmentId: attachment.attachment_id }, data: { expiresAt: new Date(Date.now() - 1) } });
  let res = await sendChat([attachment.attachment_id]); assert.equal(res.status, 422); assert.equal((await res.json()).code, "ATTACHMENT_EXPIRED");
  assert.equal((await sendChat([randomUUID()])).status, 422); assert.equal(requests.length, 1);
  const fresh = await uploaded(); assert.notEqual(fresh.attachment_id, attachment.attachment_id);
  explainFailure = 422; res = await sendChat([fresh.attachment_id]); assert.equal(res.status, 422);
  const body = await res.json(); assert.equal(body.code, "ATTACHMENT_REATTACH_REQUIRED"); assert.ok(!JSON.stringify(body).includes("PRIVATE"));
  const again = await uploaded(); assert.notEqual(again.attachment_id, fresh.attachment_id);
});
it("sanitizes upload failures, retains files on explain failure and safely deletes with 204 or 404", async () => {
  for (const status of [413, 422, 401, 503]) {
    uploadFailure = status; const res = await sendUpload(); assert.equal(res.status, [413, 422].includes(status) ? status : 503);
    assert.ok(!JSON.stringify(await res.json()).includes("PRIVATE"));
  }
  const a = await uploaded(); explainFailure = 503; assert.equal((await sendChat([a.attachment_id])).status, 503);
  assert.equal((await elearningDb.stewartAttachment.findUnique({ where: { attachmentId: a.attachment_id } }))!.status, "uploaded");
  for (const status of [204, 404]) {
    const attachment = status === 204 ? a : await uploaded(file("other.txt")); deleteStatus = status;
    assert.equal((await sendRemove(attachment.attachment_id)).status, 200);
    assert.equal((await sendChat([attachment.attachment_id])).status, 422);
  }
});
it("prevents deletion during an active explanation and releases leases afterward", async () => {
  const a = await uploaded(); let finish!: () => void;
  explainGate = new Promise<void>((resolve) => { finish = resolve; });
  const pending = sendChat([a.attachment_id]);
  for (let i = 0; i < 100 && !requests.some((r) => r.path === "/explain"); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  try { assert.equal((await sendRemove(a.attachment_id)).status, 409); }
  finally { finish(); }
  assert.equal((await pending).status, 200); assert.equal((await sendRemove(a.attachment_id)).status, 200);
});
it("rejects a valid same-student attachment in a different week conversation", async () => {
  const a = await uploaded(); const before = requests.length;
  const res = await sendChat([a.attachment_id], { weekNumber: 2 });
  assert.equal(res.status, 403); assert.equal(requests.length, before);
});
it("does not publish malformed upload metadata and compensates known remote IDs on mismatch", async () => {
  const upstreamFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const res = await upstreamFetch(url, init);
    if (new URL(String(url)).pathname === "/attachments") {
      const body = await res.json(); return Response.json({ ...body, size_bytes: body.size_bytes + 1 });
    }
    return res;
  };
  const response = await sendUpload(); assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(await response.json()).includes("mismatch"));
  assert.ok(requests.some((r) => r.path.startsWith("/attachments/") && r.init?.method === "DELETE"));
  assert.equal(await elearningDb.stewartAttachment.count({ where: { userId: scenario.studentId, status: "uploaded" } }), 0);
});
it("retrieves attachment metadata through the existing adapter only when requested", async () => {
  const { requestAttachmentMetadata } = await import("@/services/e-learning/ai-ingest/client");
  const a = await uploaded(); const upstreamFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "GET") {
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer test-key");
      assert.equal(new URL(String(url)).pathname, `/attachments/${a.attachment_id}`);
      return Response.json(a);
    }
    return upstreamFetch(url, init);
  };
  assert.equal((await requestAttachmentMetadata(a.attachment_id)).attachment_id, a.attachment_id);
});
