import "../helpers/env";
import { before, it, mock } from "node:test";
import assert from "node:assert/strict";
import { unauthorized } from "@/lib/service-error";
let signedIn = false; let calls = 0;
mock.module("@/services/e-learning/shared/auth", { namedExports: {
  requireElearningRole: async (roles: string[]) => { assert.deepEqual(roles, ["student"]); if (!signedIn) throw unauthorized(); return { user: { id: "student" } }; },
  requireStudentProfile: async () => ({}),
} });
mock.module("@/services/e-learning/classroom/stuwart", { namedExports: {
  classroomHistory: async () => { calls++; return { messages: [], lesson: null }; },
  askClassroomStuwart: async () => { calls++; return { answer: "Test answer" }; },
} });
let route: typeof import("@/app/api/e-learning/classroom/[sessionId]/stuwart/route");
before(async () => { route = await import("@/app/api/e-learning/classroom/[sessionId]/stuwart/route"); });
const context = { params: Promise.resolve({ sessionId: "test" }) };
const req = (body: string) => new Request("https://app.test/api/e-learning/classroom/test/stuwart", { method: "POST", body });
it("requires student authentication before reading JSON or loading history", async () => {
  signedIn = false; calls = 0;
  assert.equal((await route.GET(new Request("https://app.test"), context)).status, 401);
  assert.equal((await route.POST(req("not JSON"), context)).status, 401); assert.equal(calls, 0);
});
it("bounds raw bodies, rejects invalid JSON and prevents caching private responses", async () => {
  signedIn = true; calls = 0;
  assert.equal((await route.POST(req("not JSON"), context)).status, 400);
  assert.equal((await route.POST(req("[]"), context)).status, 400);
  assert.equal((await route.POST(req("x".repeat(16001)), context)).status, 413); assert.equal(calls, 0);
  const response = await route.GET(new Request("https://app.test"), context); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
});
