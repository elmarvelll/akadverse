import "../helpers/env";
import { afterEach, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { ServiceError } from "../../src/lib/service-error";
const background: (() => Promise<void>)[] = [], calls: unknown[][] = [];
let authenticated = true;
mock.module("next/server", { namedExports: { after: (work: () => Promise<void>) => background.push(work) } });
mock.module("@/app/api/e-learning/stewart/shared", { namedExports: {
  requireStewartStudent: async () => { if (!authenticated) throw new ServiceError(401, "Sign in."); return "owned-student"; },
  boundedStewartRequest: async (request: Request, max: number) => { assert.equal(max, 16384); if (Number(request.headers.get("content-length")) > max) throw new ServiceError(413, "Too large."); return request; },
} });
let route: typeof import("../../src/app/api/e-learning/learning/route");
before(async () => {
  const real = await import("../../services/e-learning/learning-ai/lessons");
  mock.module("@/services/e-learning/learning-ai/lessons", { namedExports: { ...real,
    startLesson: async (...args: unknown[]) => { calls.push(args); return { status: "PREPARING" }; },
    lessonView: async (...args: unknown[]) => { calls.push(args); return { id: "owned-run", busy: false }; },
    queueLessonCommand: async (...args: unknown[]) => { calls.push(args); return { actionId: "queued" }; },
    acknowledgeDelivery: async (...args: unknown[]) => { calls.push(args); return { delivered: true }; },
  } });
  mock.module("@/services/e-learning/learning-ai/worker", { namedExports: { runLearningSweep: async (...args: unknown[]) => { calls.push(args); return {}; } } });
  route = await import("../../src/app/api/e-learning/learning/route");
});
afterEach(() => { calls.length = 0; background.length = 0; authenticated = true; delete process.env.AI_V2_ENABLED; });
function post(value: unknown, extra: Record<string, string> = {}) { return new Request("https://akadverse.test/api/e-learning/learning", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://akadverse.test", ...extra }, body: JSON.stringify(value) }); }
test("flags off reject without invoking lesson state", async () => { delete process.env.AI_V2_ENABLED; assert.equal((await route.POST(post({ action: "start" }))).status, 503); assert.equal(calls.length, 0); });
test("unauthenticated requests cannot enqueue work", async () => { process.env.AI_V2_ENABLED = "true"; authenticated = false; assert.equal((await route.POST(post({ action: "start" }))).status, 401); assert.equal(calls.length, 0); });
test("cross-origin or non-JSON commands cannot enqueue work", async () => { process.env.AI_V2_ENABLED = "true"; assert.equal((await route.POST(post({ action: "start" }, { Origin: "https://foreign.test" }))).status, 403); assert.equal((await route.POST(post({}, { "Content-Type": "text/plain" }))).status, 415); assert.equal(calls.length, 0); });
test("oversized and non-object requests are rejected before state changes", async () => { process.env.AI_V2_ENABLED = "true"; assert.equal((await route.POST(post({}, { "Content-Length": "20000" }))).status, 413); assert.equal((await route.POST(post([]))).status, 400); assert.equal(calls.length, 0); });
test("queued preparation uses authenticated identity and private no-store response", async () => {
  process.env.AI_V2_ENABLED = "true";
  const response = await route.POST(post({ action: "start", studentId: "attacker-supplied", courseId: "course" }));
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /private, no-store/);
  assert.equal(calls[0][0], "owned-student"); assert.equal(background.length, 1);
  await background[0](); assert.deepEqual(calls[1], ["owned-student"]);
});
test("GET and delivery use owned service paths rather than browser identity", async () => {
  process.env.AI_V2_ENABLED = "true";
  assert.equal((await route.GET(new Request("https://akadverse.test/api/e-learning/learning?run=owned-run"))).status, 200);
  assert.deepEqual(calls[0], ["owned-student", "owned-run"]);
  assert.equal((await route.POST(post({ action: "deliver", runId: "owned-run", actionId: "action", studentId: "other" }))).status, 200);
  assert.deepEqual(calls[1], ["owned-student", "owned-run", "action"]);
});
