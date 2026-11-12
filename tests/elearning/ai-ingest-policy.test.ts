import "../helpers/env";
import { afterEach, it } from "node:test";
import assert from "node:assert/strict";
import { eligibility, retryDelay, safeProcessingError } from "@/services/e-learning/ai-ingest/policy";
import { parseIngestCallback } from "@/services/e-learning/ai-ingest/ingest-material";
import { requestIngest, requestDelete, isAiIngestConfigured, type AiIngestPayload } from "@/services/e-learning/ai-ingest/client";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; delete process.env.CONCEPT_EXPLAINER_API_URL; delete process.env.AI_SERVICE_API_KEY; });
it("restricts ingestion to supported notes without changing upload rules", () => {
  assert.equal(eligibility({ type: "NOTES", mimeType: "application/pdf", fileSize: 20 * 1024 * 1024 }), "eligible");
  assert.equal(eligibility({ type: "NOTES", mimeType: "application/pdf", fileSize: 20 * 1024 * 1024 + 1 }), "unsupported");
  assert.equal(eligibility({ type: "NOTES", mimeType: "application/zip", fileSize: 100 }), "unsupported");
  for (const type of ["ASSIGNMENT", "QUIZ"]) assert.equal(eligibility({ type, mimeType: "application/pdf", fileSize: 100 }), "ineligible");
});
it("uses bounded exponential backoff with jitter", () => {
  assert.equal(retryDelay(1, 0), 30_000); assert.equal(retryDelay(2, 1), 120_000);
  assert.equal(retryDelay(100, 1), 3600_000);
});
it("does not persist arbitrary upstream secrets, URLs or stack traces", () => {
  const secret = "https://example.com?token=secret Authorization: Bearer secret";
  assert.ok(!safeProcessingError(secret).includes("secret"));
  assert.match(safeProcessingError("scanned PDF requires OCR"), /OCR/);
});
it("requires positive embedding counts for success and validates callback identity", () => {
  for (const count of [undefined, null, 0, -1, 1.5, 2147483648]) assert.equal(parseIngestCallback({ document_id: "x", status: "ingested", chunk_count: count }), null);
  assert.equal(parseIngestCallback({ document_id: " ", status: "failed" }), null);
  assert.equal(parseIngestCallback({ document_id: "x", status: "processing" }), null);
  assert.equal(parseIngestCallback({ document_id: "x", status: "ingested", chunk_count: 42 })?.chunk_count, 42);
});
it("supports the supplied URL name, authenticates server requests and treats 202 as queued", async () => {
  process.env.CONCEPT_EXPLAINER_API_URL = "https://ai.example.test/"; process.env.AI_SERVICE_API_KEY = "test-key";
  assert.equal(isAiIngestConfigured(), true);
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://ai.example.test/ingest");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    assert.equal(init?.redirect, "error");
    return Response.json({ status: "queued", document_id: "doc" }, { status: 202 });
  };
  assert.deepEqual(await requestIngest({ document_id: "doc" } as AiIngestPayload), { done: null });
});
it("rejects non-contract responses rather than fabricating completion", async () => {
  process.env.CONCEPT_EXPLAINER_API_URL = "https://ai.example.test"; process.env.AI_SERVICE_API_KEY = "test-key";
  for (const [status, body] of [[200, { status: "ingested", chunk_count: 42 }], [202, {}], [202, { status: "queued", document_id: "other" }], [500, {}]] as const) {
    globalThis.fetch = async () => Response.json(body, { status });
    await assert.rejects(requestIngest({ document_id: "doc" } as AiIngestPayload));
  }
});
it("accepts only documented deletion success responses", async () => {
  process.env.CONCEPT_EXPLAINER_API_URL = "https://ai.example.test"; process.env.AI_SERVICE_API_KEY = "test-key";
  for (const status of [204, 404]) { globalThis.fetch = async () => new Response(null, { status }); await requestDelete("doc"); }
  globalThis.fetch = async () => new Response(null, { status: 503 }); await assert.rejects(requestDelete("doc"));
});

it("separates JSON course explanations from multipart grounding and filters unsafe sources", async () => {
  const { requestExplanation } = await import("@/services/e-learning/ai-ingest/client");
  process.env.CONCEPT_EXPLAINER_API_URL = "https://ai.example.test"; process.env.AI_SERVICE_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    if (String(url).endsWith("/explain")) {
      assert.deepEqual(JSON.parse(init?.body as string), { question: "Explain", course_offering_id: "offering", week: 3 });
      return Response.json({ answer: "Answer", sources: [] });
    }
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get("question"), "Explain");
    assert.equal(new Headers(init.headers).get("content-type"), null);
    return Response.json({ concept: "Concept", simple_explanation: "Simple", analogy: "Analogy", example: "Example", worked_problem: "Worked", sources: [{ title: "Unsafe", url: "javascript:alert(1)" }, { title: "Source", url: "https://example.com" }] });
  };
  assert.equal((await requestExplanation("Explain", "offering", 3, false)).text, "Answer");
  const grounded = await requestExplanation("Explain", "offering", 3, true);
  assert.equal(grounded.sources.length, 1);
  assert.match(grounded.text, /## Worked problem/);
});
it("validates status identity, positive chunk counts, configuration and malformed explanations", async () => {
  const { requestDocumentStatus, requestExplanation } = await import("@/services/e-learning/ai-ingest/client");
  process.env.AI_SERVICE_API_KEY = "test-key";
  for (const url of ["javascript:alert(1)", "https://user:password@example.com", "not-a-url"]) {
    process.env.CONCEPT_EXPLAINER_API_URL = url;
    assert.equal(isAiIngestConfigured(), false);
  }
  process.env.CONCEPT_EXPLAINER_API_URL = "https://ai.example.test";
  for (const body of [{ document_id: "other", status: "done", chunk_count: 2 }, { document_id: "doc", status: "done", chunk_count: 0 }, { document_id: "doc", status: "unexpected" }]) {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(requestDocumentStatus("doc"));
  }
  globalThis.fetch = async () => Response.json({ document_id: "doc", status: "processing" });
  assert.equal((await requestDocumentStatus("doc")).status, "processing");
  globalThis.fetch = async () => Response.json({ concept: "incomplete", sources: [] });
  await assert.rejects(requestExplanation("Explain", "offering", 3, true));
  for (const status of [401, 503]) {
    globalThis.fetch = async () => new Response(null, { status });
    await assert.rejects(requestExplanation("Explain", "offering", 3, false));
  }
});
