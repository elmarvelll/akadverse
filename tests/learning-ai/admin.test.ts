import "../helpers/env";
import { afterEach, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { ServiceError } from "../../src/lib/service-error";
let admin = false, busy = false;
const calls: { method: string; data: unknown }[] = [];
const tx = {
  $queryRaw: async () => [],
  learningLessonRun: { findUnique: async () => ({ id: "run", studentId: "student", planId: "plan", currentConceptId: "concept", offeringId: "offering", version: 1, status: "PAUSED", busy }), update: async (data: unknown) => { calls.push({ method: "run", data }); } },
  learningLessonAction: { updateMany: async (data: unknown) => { calls.push({ method: "release", data }); return { count: 1 }; }, create: async (data: unknown) => { calls.push({ method: "audit", data }); } },
  learningMastery: { updateMany: async (data: unknown) => { calls.push({ method: "review", data }); } },
  learningSnapshot: { upsert: async () => {} },
};
mock.module("@/lib/db/elearning", { namedExports: { elearningDb: { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx) } } });
mock.module("@/lib/admin", { namedExports: { requireAdmin: async () => { if (!admin) throw new ServiceError(403, "Admin access required."); return { user: { id: "operator" } }; } } });
let route: typeof import("../../src/app/api/e-learning/admin/learning/route");
before(async () => { route = await import("../../src/app/api/e-learning/admin/learning/route"); });
afterEach(() => { admin = false; busy = false; calls.length = 0; delete process.env.AI_V2_ENABLED; });
const post = (body: unknown, origin = "https://akadverse.test") => new Request("https://akadverse.test/api/e-learning/admin/learning", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
test("students cannot resolve review state or release uncertain capacity", async () => {
  process.env.AI_V2_ENABLED = "true";
  assert.equal((await route.POST(post({ action: "resolve_review", runId: "run", reason: "Try" }))).status, 403); assert.equal(calls.length, 0);
});
test("reconciliation requires a reason, an idle run and provider-stop confirmation", async () => {
  admin = true; process.env.AI_V2_ENABLED = "true";
  assert.equal((await route.POST(post({ action: "reconcile_uncertain", runId: "run", reason: "Checked", actionId: "action" }))).status, 400);
  busy = true;
  assert.equal((await route.POST(post({ action: "resolve_review", runId: "run", reason: "Checked" }))).status, 409);
  assert.equal(calls.length, 0);
});
test("review resolution appends private operator audit without awarding mastery or coverage", async () => {
  admin = true; process.env.AI_V2_ENABLED = "true";
  assert.equal((await route.POST(post({ action: "resolve_review", runId: "run", reason: "Checked source and evaluation" }))).status, 200);
  assert.deepEqual((calls.find(c => c.method === "review")!.data as { data: unknown }).data, { pendingReview: false });
  const audit = (calls.find(c => c.method === "audit")!.data as { data: { privateResult: unknown; result: unknown } }).data;
  assert.equal((audit.privateResult as { operatorId: string }).operatorId, "operator");
  assert.equal(JSON.stringify(audit.result).includes("operator"), false);
});
