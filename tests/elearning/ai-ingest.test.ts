// Isolated local PostgreSQL integration tests; providers never contact production.
import "../helpers/env";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { elearningDb } from "@/lib/db/elearning";
import { aiService, installFakeProviders, storage } from "../helpers/fake-providers";
import { courseScenario } from "../helpers/elearning-fixtures";
import { requestUpload, confirmUpload, type UploadMeta } from "@/services/e-learning/faculty/materials/upload-material";
import { deleteMaterial } from "@/services/e-learning/faculty/materials/delete-material";
import { retryMaterialIngestion, sendMaterialForIngestion } from "@/services/e-learning/ai-ingest/ingest-material";
import { runAiIngestSweep, retryReviewedTask } from "@/services/e-learning/ai-ingest/worker";
import { POST as callback } from "@/app/api/webhooks/ai-ingest/route";

before(() => installFakeProviders());
beforeEach(async () => {
  storage.reset(); aiService.reset();
  // helpers/env refuses any nonlocal database before this module is loaded.
  await elearningDb.aiIngestTask.deleteMany();
  process.env.AI_SERVICE_URL = "https://ai.akadverse.test/";
  delete process.env.CONCEPT_EXPLAINER_API_URL;
  process.env.AI_SERVICE_API_KEY = "ai-test-key";
  process.env.AI_SERVICE_CALLBACK_SECRET = "cb-test-secret";
  process.env.APP_BASE_URL = "https://akadverse.test";
  process.env.AI_INGEST_ENABLED = "true";
});
after(async () => { await elearningDb.$disconnect(); });
type Scenario = Awaited<ReturnType<typeof courseScenario>>;
const material = (id: string) => elearningDb.courseMaterial.findUniqueOrThrow({ where: { id } });
const task = (id: string) => elearningDb.aiIngestTask.findUniqueOrThrow({ where: { documentId: id } });
async function upload(s: Scenario, overrides: Partial<UploadMeta> = {}) {
  const meta: UploadMeta = { courseOfferingId: s.offering.id, type: "NOTES", title: "Lecture notes", startWeek: 3, endWeek: 5, fileName: "notes.pdf", size: 1200, mimeType: "application/pdf", ...overrides };
  const signed = await requestUpload(s.lecturerId, meta);
  await fetch(signed.uploadUrl, { method: "PUT", body: new Uint8Array(meta.size).fill(1) });
  return confirmUpload(s.lecturerId, { ...meta, path: signed.path });
}
const notify = (body: unknown, secret = "cb-test-secret") => callback(new Request("https://akadverse.test/api/webhooks/ai-ingest", {
  method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
}));

describe("durable AI ingestion", () => {
  it("atomically queues notes, maps academic metadata, signs URLs and preserves the original", async () => {
    const s = await courseScenario(); const m = await upload(s);
    assert.equal((await task(m.id)).state, "READY");
    assert.equal(aiService.requests.length, 0);
    await sendMaterialForIngestion(m.id); await sendMaterialForIngestion(m.id);
    assert.equal(await elearningDb.aiIngestTask.count({ where: { documentId: m.id } }), 1);
    await Promise.all([runAiIngestSweep(), runAiIngestSweep()]);
    assert.equal(aiService.requests.length, 1, "concurrent claims only submit once");
    const request = aiService.requests[0];
    assert.equal(request.auth, "Bearer ai-test-key");
    const body = request.body as { metadata: Record<string, unknown>; file_url: string; callback_url: string };
    assert.deepEqual(body.metadata, { course_code: s.course.code, course_title: "Test Course", course_offering_id: s.offering.id, academic_session: s.ctx.session!.name, semester: "First", start_week: 3, end_week: 5, weeks: [3, 4, 5], material_type: "NOTES", title: "Lecture notes", document_id: m.id });
    assert.match(body.file_url, /object\/sign\//);
    assert.equal(body.callback_url, "https://akadverse.test/api/webhooks/ai-ingest");
    assert.equal((await material(m.id)).aiIngestStatus, "PENDING", "202 is queue admission only");
    assert.equal((await task(m.id)).state, "ACCEPTED");
    assert.ok(storage.objects.has(`course-materials/${m.storagePath}`));
  });
  it("excludes assignments and quizzes and keeps unsupported ZIP uploads accessible", async () => {
    const s = await courseScenario();
    for (const type of ["ASSIGNMENT", "QUIZ"]) {
      const m = await upload(s, { type });
      assert.equal(await elearningDb.aiIngestTask.count({ where: { documentId: m.id } }), 0);
      assert.equal(await sendMaterialForIngestion(m.id), null);
    }
    const zip = await upload(s, { fileName: "notes.zip", mimeType: "application/zip" });
    assert.equal(zip.aiIngestStatus, "UNSUPPORTED_FORMAT");
    assert.ok(storage.objects.has(`course-materials/${zip.storagePath}`));
    await runAiIngestSweep(); assert.equal(aiService.requests.length, 0);
  });
  it("retains ambiguous 5xx and network outcomes without resubmitting", async () => {
    const s = await courseScenario();
    for (const response of [{ status: 500 }, "network"] as const) {
      const m = await upload(s); aiService.responses.push(response);
      await runAiIngestSweep();
      assert.equal((await task(m.id)).state, "ATTENTION");
      assert.equal((await material(m.id)).aiIngestStatus, "FAILED");
      await assert.rejects(retryReviewedTask((await task(m.id)).id), /reconciliation/);
    }
    const n = aiService.requests.length; await runAiIngestSweep(); assert.equal(aiService.requests.length, n);
  });
  it("authenticates callbacks, rejects zero embeddings and keeps terminal results idempotent", async () => {
    const m = await upload(await courseScenario()); await runAiIngestSweep();
    assert.equal((await notify({ document_id: m.id, status: "ingested", chunk_count: 42 }, "wrong")).status, 401);
    assert.equal((await notify({ document_id: m.id, status: "ingested", chunk_count: 0 })).status, 400);
    assert.equal((await notify({ document_id: m.id, status: "ingested", chunk_count: 42 })).status, 200);
    await notify({ document_id: m.id, status: "failed", error: "https://secret/?token=secret" });
    assert.equal((await material(m.id)).aiIngestStatus, "INGESTED");
    assert.equal((await material(m.id)).aiChunkCount, 42);
    assert.deepEqual(await (await notify({ document_id: "unknown", status: "ingested", chunk_count: 1 })).json(), { ok: true, ignored: "unknown document_id" });
  });
  it("ignores callbacks for unrelated and never-submitted materials", async () => {
    const m = await upload(await courseScenario());
    assert.equal((await (await notify({ document_id: m.id, status: "ingested", chunk_count: 1 })).json()).ignored, "unknown document_id");
    assert.equal((await material(m.id)).aiIngestStatus, "PENDING");
  });
  it("expires worker claims to reconciliation, never duplicate POSTs", async () => {
    const m = await upload(await courseScenario());
    await elearningDb.aiIngestTask.update({ where: { documentId: m.id }, data: { state: "CLAIMED", leaseUntil: new Date(0) } });
    await runAiIngestSweep(); assert.equal((await task(m.id)).state, "ATTENTION"); assert.equal(aiService.requests.length, 0);
  });
  it("retries deletion durably after original removal and accepts 404", async () => {
    const s = await courseScenario(); const m = await upload(s); await runAiIngestSweep();
    await notify({ document_id: m.id, status: "ingested", chunk_count: 1 });
    await deleteMaterial(s.lecturerId, m.id);
    assert.equal(await elearningDb.courseMaterial.findUnique({ where: { id: m.id } }), null);
    assert.equal((await task(m.id)).materialId, null);
    assert.ok(!storage.objects.has(`course-materials/${m.storagePath}`));
    aiService.responses.push({ status: 503 }); await runAiIngestSweep();
    assert.equal((await task(m.id)).state, "RETRY");
    await elearningDb.aiIngestTask.update({ where: { documentId: m.id }, data: { nextAttemptAt: new Date(0) } });
    aiService.responses.push({ status: 404 }); await runAiIngestSweep();
    assert.equal((await task(m.id)).state, "DONE");
    assert.equal((await (await notify({ document_id: m.id, status: "ingested", chunk_count: 1 })).json()).ignored, "unknown document_id");
  });
  it("cancels pending ingestion on deletion", async () => {
    const s = await courseScenario(); const m = await upload(s); await deleteMaterial(s.lecturerId, m.id); await runAiIngestSweep();
    assert.ok(aiService.requests.every((r) => r.method === "DELETE"));
  });
  it("keeps upload permission checks and prevents unsafe lecturer resubmission", async () => {
    const s = await courseScenario(); const m = await upload(s);
    await assert.rejects(retryMaterialIngestion(s.otherLecturerId, m.id), { status: 403 });
    await assert.rejects(retryMaterialIngestion(s.lecturerId, m.id), { status: 409 });
  });
  it("pauses processing until explicitly enabled", async () => {
    const m = await upload(await courseScenario()); process.env.AI_INGEST_ENABLED = "false";
    assert.equal((await runAiIngestSweep()).processed, 0); assert.equal((await task(m.id)).state, "READY");
  });
});
