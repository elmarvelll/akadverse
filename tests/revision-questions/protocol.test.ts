import "../helpers/env";
import { it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { authenticateRevisionRequest, MAX_REVISION_BODY_BYTES } from "@/services/e-learning/revision-questions/security";
import { parseRevisionPayload, serializeRevisionResponse, type RevisionPayload } from "@/services/e-learning/revision-questions/contract";
import { RevisionWebhookError } from "@/services/e-learning/revision-questions/errors";
import { canonicalQuestion } from "@/services/e-learning/revision-questions/policy";
import { POST } from "@/app/api/webhooks/tutor/questions/route";
const NOW = Date.parse("2026-11-15T10:42:00.000Z"), SECRET = "test-revision-signing-secret";
export function fixture(): RevisionPayload {
  return { event_id: randomUUID(), teaching_event_id: "teach_original", student_id: "student-original", occurred_at: new Date(NOW).toISOString(), context: { subject: "Algebra", curriculum: "WAEC", level: "SS2", topic: "Quadratics", concept_id: "concept-discriminant", concept_title: "Discriminants", language: "en" }, taught_summary: "A negative discriminant means no real roots.", questions: [{ client_ref: "q1", type: "mcq", stem: "What does a negative discriminant mean?", options: [{ key: "A", text: "Two real roots" }, { key: "B", text: "No real roots" }], correct_answer: "B", explanation: "A square root of a negative value is not real.", difficulty_estimate: 0.4, bloom_level: "understand", tags: ["discriminant"] }] };
}
function request(raw: string | Uint8Array = JSON.stringify(fixture()), changes: Record<string, string | null> = {}) {
  const bytes = typeof raw === "string" ? Buffer.from(raw) : Buffer.from(raw);
  const headers = new Headers({ "Content-Type": "application/json", "X-Akadverse-Signature": createHmac("sha256", SECRET).update(bytes).digest("hex"), "X-Akadverse-Timestamp": new Date(NOW).toISOString(), "Idempotency-Key": "teach_teach_original" });
  for (const [name, value] of Object.entries(changes)) { if (value === null) headers.delete(name); else headers.set(name, value); }
  return new Request("https://app.test/api/webhooks/tutor/questions", { method: "POST", headers, body: bytes });
}
beforeEach(() => { process.env.AI_WEBHOOK_SECRET = SECRET; process.env.REVISION_QUESTIONS_ENABLED = "false"; });
const isStatus = (status: number) => (error: unknown) => error instanceof RevisionWebhookError && error.status === status;
it("authenticates exact raw bytes and preserves the body hash independently of JSON key order", async () => {
  const raw = JSON.stringify(fixture()); const authenticated = await authenticateRevisionRequest(request(raw), SECRET, NOW);
  assert.equal(authenticated.raw.toString(), raw); assert.equal(authenticated.bodyHash.length, 64);
  const altered = raw.replace('"questions":', '"questions" :');
  const oldSignature = createHmac("sha256", SECRET).update(raw).digest("hex");
  await assert.rejects(authenticateRevisionRequest(request(altered, { "X-Akadverse-Signature": oldSignature }), SECRET, NOW), isStatus(401));
});
for (const [label, signature] of [["missing", null], ["malformed", "zz"], ["wrong", "0".repeat(64)], ["unequal length", "a".repeat(62)]] as const) it(`rejects ${label} signature`, async () => {
  await assert.rejects(authenticateRevisionRequest(request(undefined, { "X-Akadverse-Signature": signature }), SECRET, NOW), isStatus(401));
});
for (const [label, timestamp] of [["expired", new Date(NOW - 300001).toISOString()], ["future", new Date(NOW + 30001).toISOString()], ["invalid date", "2026-02-30T10:42:00Z"], ["missing", null]] as const) it(`rejects ${label} timestamp`, async () => {
  await assert.rejects(authenticateRevisionRequest(request(undefined, { "X-Akadverse-Timestamp": timestamp }), SECRET, NOW), isStatus(401));
});
it("bounds streamed bytes despite a forged Content-Length and rejects wrong media type", async () => {
  await assert.rejects(authenticateRevisionRequest(request("x".repeat(MAX_REVISION_BODY_BYTES + 1), { "Content-Length": "1" }), SECRET, NOW), isStatus(413));
  await assert.rejects(authenticateRevisionRequest(request(undefined, { "Content-Type": "text/plain" }), SECRET, NOW), isStatus(415));
});
it("fails closed when its dedicated secret is missing", async () => {
  process.env.AI_WEBHOOK_SECRET = ""; await assert.rejects(authenticateRevisionRequest(request()), isStatus(503));
});
it("accepts valid MCQ, short answer and true/false questions", () => {
  for (const type of ["mcq", "short_answer", "true_false"] as const) {
    const payload = fixture(); payload.questions[0].type = type;
    if (type !== "mcq") { delete payload.questions[0].options; payload.questions[0].correct_answer = type === "true_false" ? true : "No real roots"; }
    assert.equal(parseRevisionPayload(Buffer.from(JSON.stringify(payload)), "teach_teach_original").questions[0].type, type);
  }
});
for (const [name, mutate] of Object.entries<(p: Record<string, unknown>) => void>({
  "missing student": p => { delete p.student_id; },
  "invalid event UUID": p => { p.event_id = "not-a-uuid"; },
  "invalid type": p => { (p.questions as Record<string, unknown>[])[0].type = "essay"; },
  "invalid Bloom": p => { (p.questions as Record<string, unknown>[])[0].bloom_level = "evaluate"; },
  "invalid difficulty": p => { (p.questions as Record<string, unknown>[])[0].difficulty_estimate = 1.1; },
  "invalid answer": p => { (p.questions as Record<string, unknown>[])[0].correct_answer = "X"; },
  "duplicate references": p => { (p.questions as unknown[]).push((p.questions as unknown[])[0]); },
  "missing explanation": p => { delete (p.questions as Record<string, unknown>[])[0].explanation; },
  "duplicate options": p => { const q = (p.questions as Record<string, unknown>[])[0]; q.options = [{ key: "A", text: "One" }, { key: "A", text: "Two" }]; },
  "unknown field": p => { p.admin_override = true; },
  "too many questions": p => { p.questions = Array.from({ length: 6 }, (_, i) => ({ ...(p.questions as object[])[0], client_ref: String(i) })); },
})) it(`rejects ${name}`, () => {
  const payload = fixture() as unknown as Record<string, unknown>; mutate(payload);
  assert.throws(() => parseRevisionPayload(Buffer.from(JSON.stringify(payload)), "teach_teach_original"), isStatus(400));
});
it("binds the key to teaching_event_id, never event_id, and rejects invalid UTF-8/JSON", () => {
  const payload = fixture();
  assert.throws(() => parseRevisionPayload(Buffer.from(JSON.stringify(payload)), `teach_${payload.event_id}`), isStatus(400));
  assert.throws(() => parseRevisionPayload(Buffer.from([0xff]), "teach_teach_original"), isStatus(400));
  assert.throws(() => parseRevisionPayload(Buffer.from("{"), "teach_teach_original"), isStatus(400));
});
it("requires a complete ordered result mapping and IDs only for persisted results", () => {
  const payload = fixture();
  const response = serializeRevisionResponse(payload, [{ client_ref: "q1", question_id: "canonical-1", student_card_id: "card-1", outcome: "reused_existing" }]);
  assert.equal(JSON.parse(response).results[0].question_id, "canonical-1");
  assert.throws(() => serializeRevisionResponse(payload, []));
  assert.throws(() => serializeRevisionResponse(payload, [{ client_ref: "q1", question_id: null, student_card_id: null, outcome: "created" }]));
});
it("never reports successful processing while canonical learning dependencies are missing", async () => {
  const payload = fixture(); payload.occurred_at = new Date().toISOString();
  const response = await POST(request(JSON.stringify(payload), { "X-Akadverse-Timestamp": new Date().toISOString() }));
  assert.equal(response.status, 503); assert.equal(response.headers.get("retry-after"), "60");
  const result = await response.json(); assert.equal(result.error.code, "REVISION_DISABLED"); assert.ok(!JSON.stringify(result).includes(SECRET));
});

it("preserves mathematical case and code indentation while making MCQ label shuffling canonical", () => {
  const payload = fixture(), q = payload.questions[0];
  const original = canonicalQuestion(payload, q, "Understand the discriminant");
  const shuffled = { ...q, options: [{ key: "X", text: "No real roots" }, { key: "Y", text: "Two real roots" }], correct_answer: "X" };
  assert.equal(canonicalQuestion(payload, shuffled, "Understand the discriminant"), original);
  assert.notEqual(canonicalQuestion(payload, { ...q, stem: "Compute X + x" }, "Objective"), canonicalQuestion(payload, { ...q, stem: "Compute x + x" }, "Objective"));
  assert.notEqual(canonicalQuestion(payload, { ...q, stem: "if x:\n  a()\nb()" }, "Objective"), canonicalQuestion(payload, { ...q, stem: "if x:\n  a()\n  b()" }, "Objective"));
});

it("logs exact byte diagnostics and effective secret length on mismatch without leaking the key or payload", async () => {
  const logger = mock.method(console, "log", () => {});
  try {
    const raw = '{"a":1,"b":"é"}';
    process.env.AI_WEBHOOK_SECRET = SECRET + "\n";
    const wrongSignature = "a".repeat(64);
    await assert.rejects(authenticateRevisionRequest(request(raw, { "X-Akadverse-Signature": wrongSignature }), undefined, NOW, "test-correlation"), isStatus(401));
    assert.equal(logger.mock.callCount(), 1);
    const [label, diagnostic] = logger.mock.calls[0].arguments as unknown as [string, Record<string, unknown>];
    assert.equal(label, "[revision-questions] sig_debug");
    assert.equal(diagnostic.correlationId, "test-correlation");
    assert.equal(diagnostic.signatureReceived, wrongSignature);
    assert.equal(diagnostic.signatureComputed, createHmac("sha256", SECRET).update(Buffer.from(raw)).digest("hex"));
    assert.equal(diagnostic.bodySha256, createHash("sha256").update(Buffer.from(raw)).digest("hex"));
    assert.equal(diagnostic.bodyLength, Buffer.byteLength(raw));
    assert.equal(diagnostic.configuredSecretByteLength, Buffer.byteLength(SECRET) + 1);
    assert.equal(diagnostic.effectiveSecretByteLength, Buffer.byteLength(SECRET));
    assert.equal(diagnostic.configuredSecretHasOuterWhitespace, true);
    assert.equal(diagnostic.configuredSecretHasControlCharacters, true);
    assert.equal(diagnostic.timestampReceived, new Date(NOW).toISOString());
    assert.equal(diagnostic.idempotencyKeyReceived, "teach_teach_original");
    assert.equal(diagnostic.reason, "hmac_mismatch");
    assert.ok(!JSON.stringify(diagnostic).includes(SECRET));
    assert.ok(!JSON.stringify(diagnostic).includes('"a":1'));
  } finally { logger.mock.restore(); }
});
it("reports malformed headers without consuming or parsing the body", async () => {
  const logger = mock.method(console, "log", () => {});
  try {
    const req = request("not JSON", { "X-Akadverse-Signature": "sha256=" + "a".repeat(64) });
    await assert.rejects(authenticateRevisionRequest(req, SECRET, NOW, "header-correlation"), isStatus(401));
    assert.equal(req.bodyUsed, false);
    const diagnostic = logger.mock.calls[0].arguments[1] as unknown as Record<string, unknown>;
    assert.equal(diagnostic.reason, "invalid_auth_headers"); assert.equal(diagnostic.signatureComputed, null); assert.equal(diagnostic.bodyLength, null);
  } finally { logger.mock.restore(); }
});
it("does not log signed request diagnostics when authentication succeeds", async () => {
  const logger = mock.method(console, "log", () => {});
  try { await authenticateRevisionRequest(request(), SECRET, NOW); assert.equal(logger.mock.callCount(), 0); }
  finally { logger.mock.restore(); }
});
it("uses the response correlation ID in the receiver's signature diagnostic", async () => {
  const logger = mock.method(console, "log", () => {});
  try {
    const response = await POST(request('{"a":1,"b":2}', { "X-Akadverse-Signature": "a".repeat(64), "X-Akadverse-Timestamp": new Date().toISOString() }));
    assert.equal(response.status, 401);
    const body = await response.json();
    const diagnostic = logger.mock.calls[0].arguments[1] as unknown as Record<string, unknown>;
    assert.equal(diagnostic.correlationId, body.error.correlation_id);
    assert.equal(diagnostic.reason, "hmac_mismatch");
  } finally { logger.mock.restore(); }
});
