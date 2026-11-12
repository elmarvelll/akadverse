import "../helpers/env";
import { signInAs } from "../helpers/session";
import { after, before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { elearningDb } from "@/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

let context: CurrentAcademicContext | null = null;
mock.module("@/services/e-learning/shared/academic-calendar", {
  namedExports: { getCurrentAcademicContext: async () => context },
});
let POST: typeof import("@/app/api/e-learning/stewart/chat/route").POST;
before(async () => { ({ POST } = await import("@/app/api/e-learning/stewart/chat/route")); });
let scenario: Awaited<ReturnType<typeof courseScenario>>;
const originalFetch = globalThis.fetch;
let requests: { path: string; init?: RequestInit }[];
beforeEach(async () => {
  scenario = await courseScenario(); context = scenario.ctx;
  signInAs({ id: scenario.studentId, email: "student@example.test" });
  requests = [];
  process.env.CONCEPT_EXPLAINER_API_URL = "https://concept.example.test";
  process.env.AI_SERVICE_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    requests.push({ path: String(url), init });
    return Response.json({ answer: "Course answer", sources: [] });
  };
});
after(async () => { globalThis.fetch = originalFetch; await elearningDb.$disconnect(); });
function send(extra: Record<string, unknown> = {}) {
  return POST(new Request("https://app.test/api/e-learning/stewart/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: scenario.course.id, weekNumber: 3, messages: [{ role: "student", text: "Explain Fourier transforms" }], ...extra }) }));
}
it("uses the authorized database offering and week rather than browser offering IDs", async () => {
  const res = await send({ course_offering_id: "forged", courseOfferingId: "forged" });
  assert.equal(res.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "https://concept.example.test/explain");
  assert.deepEqual(JSON.parse(requests[0].init!.body as string), { question: "Explain Fourier transforms", course_offering_id: scenario.offering.id, week: 3, session_id: (await res.clone().json()).session_id });
  assert.equal(new Headers(requests[0].init!.headers).get("authorization"), "Bearer test-key");
  const response = await res.json();
  assert.equal(typeof response.session_id, "string");
  assert.deepEqual({ ...response, session_id: undefined }, { reply: "Course answer", truncated: false, sources: [], session_id: undefined });
});
it("rejects unauthenticated requests before sending anything upstream", async () => {
  signInAs(null);
  assert.equal((await send()).status, 401);
  assert.equal(requests.length, 0);
});
it("rejects a course without approved student registration", async () => {
  const unregistered = await scenario.makeStudent(null);
  signInAs({ id: unregistered, email: "other@example.test" });
  assert.equal((await send()).status, 404);
  assert.equal(requests.length, 0);
});
it("rejects invalid weeks and malformed modes without defaulting to week one", async () => {
  for (const weekNumber of [0, -1, 999, "invalid", 1.5]) assert.equal((await send({ weekNumber })).status, 400);
  assert.equal((await send({ grounded: "true" })).status, 400);
  assert.equal(requests.length, 0);
});
it("sends multipart grounding, retains safe links and calls only the selected endpoint", async () => {
  globalThis.fetch = async (url, init) => {
    requests.push({ path: String(url), init });
    return Response.json({ concept: "Concept", simple_explanation: "Simple", analogy: "Analogy", example: "Example", worked_problem: "Worked", sources: [{ title: "Source", url: "https://example.com/source" }, { title: "Unsafe", url: "javascript:alert(1)" }] });
  };
  const res = await send({ grounded: true });
  assert.equal(res.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "https://concept.example.test/explain-with-grounding");
  assert.ok(requests[0].init!.body instanceof FormData);
  assert.equal(requests[0].init!.body.get("question"), "Explain Fourier transforms");
  const response = await res.json();
  assert.match(response.reply, /^## Concept\n\nConcept/);
  assert.deepEqual(response.sources, [{ title: "Source", url: "https://example.com/source" }]);
});
it("does not silently fall back after grounding errors or malformed responses", async () => {
  for (const status of [401, 503, 200]) {
    requests = [];
    globalThis.fetch = async (url, init) => { requests.push({ path: String(url), init }); return Response.json({}, { status }); };
    const res = await send({ grounded: true });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /Grounded explanation/);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].path.endsWith("/explain-with-grounding"));
  }
});
it("filters out lecturer source IDs from other courses", async () => {
  globalThis.fetch = async () => Response.json({ answer: "Course answer", sources: [{ document_id: "foreign-material", title: "Unrelated material" }] });
  assert.deepEqual((await (await send()).json()).sources, []);
});
it("rejects overlong questions before calling the service", async () => {
  assert.equal((await send({ messages: [{ role: "student", text: "x".repeat(4001) }] })).status, 400);
  assert.equal(requests.length, 0);
});
it("answers chat without querying the Core database for lecturer display names", async () => {
  const { prisma } = await import("@/lib/prisma");
  const original = prisma.user.findMany;
  let calls = 0;
  prisma.user.findMany = (async () => { calls++; throw Object.assign(new Error("Core database unavailable"), { code: "P1001" }); }) as unknown as typeof original;
  try {
    assert.equal((await send()).status, 200);
    assert.equal(calls, 0);
    assert.equal(requests.length, 1);
  } finally { prisma.user.findMany = original; }
});
it("returns 503 and never calls AI when the academic database is unavailable", async () => {
  const original = elearningDb.studentProfile.findUnique;
  elearningDb.studentProfile.findUnique = (async () => { throw Object.assign(new Error("Database unreachable"), { code: "P1001" }); }) as unknown as typeof original;
  try {
    const response = await send();
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /academic database/);
    assert.equal(requests.length, 0);
  } finally { elearningDb.studentProfile.findUnique = original; }
});
it("returns 503 for document access when its academic lookup cannot connect", async () => {
  const { GET } = await import("@/app/api/e-learning/documents/[id]/access/route");
  const original = elearningDb.courseMaterial.findUnique;
  elearningDb.courseMaterial.findUnique = (async () => { throw Object.assign(new Error("Database unreachable"), { code: "P1001" }); }) as unknown as typeof original;
  try {
    const response = await GET(new Request("https://app.test/api/e-learning/documents/test/access?inline=1"), { params: Promise.resolve({ id: "test" }) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /academic database/);
  } finally { elearningDb.courseMaterial.findUnique = original; }
});

it("preserves ordinary microservice Markdown without changing answer content", async () => {
  const answer = "## Definition\n\nA **clear** explanation.\n\n$$V=IR$$\n\n[AI-GENERATED EXAMPLE]\nA study group disagrees.";
  globalThis.fetch = async () => Response.json({ answer, sources: [], retrieval_info: { chunks_available: 1 } });
  const response = await (await send()).json();
  assert.equal(response.reply, answer);
  assert.deepEqual(response.retrieval_info, { chunks_available: 1 });
  assert.equal(typeof response.session_id, "string");
});
it("does not assemble identical grounding examples twice, while preserving distinct examples", async () => {
  for (const worked of ["A group disagrees about its deadline.", "A group disagrees about its budget."]) {
    globalThis.fetch = async () => Response.json({ concept: "Conflict", simple_explanation: "Explanation", analogy: "Analogy", example: "A group disagrees about its deadline.", worked_problem: worked, sources: [] });
    const res = await send({ grounded: true }); assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.reply.split("A group disagrees about its deadline.").length - 1, 1);
    if (worked.includes("budget")) assert.match(body.reply, /budget/);
  }
});
