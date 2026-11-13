import { before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { badRequest, forbidden, unauthorized } from "@/lib/service-error";
import { ProductivityError, productivityErrorMessage } from "@/features/productivity/errors";
import { publicProductivityError, OfficialTimetableError } from "@/services/productivity-layer/errors";
import { SlotConflictError } from "@/features/productivity/schedule/domain";
import { loadAcademicRange } from "@/features/productivity/analytics/periods";
import { validateTaskInput } from "@/features/productivity/tasks/domain";
import { validateHabit } from "@/features/productivity/habits/domain";
import { eventInput, timezone } from "@/services/productivity-layer/validation";

const sensitive = "postgresql://private:password@private-host/private-database?token=secret";
let operationError: unknown;
mock.module("@/services/productivity-layer/operations", { namedExports: { executeProductivity: async () => { if (operationError) throw operationError; return []; } } });
let post: typeof import("@/app/api/productivity/route").POST;
before(async () => { ({ POST: post } = await import("@/app/api/productivity/route")); });
beforeEach(() => { operationError = undefined; });
const request = (body = JSON.stringify({ operation: "tasks.list", args: [] }), headers = {}) => new Request("http://localhost/api/productivity", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
const known = (code: string) => new Prisma.PrismaClientKnownRequestError(sensitive, { code, clientVersion: "test", meta: { query: sensitive } });

it("classifies database failures without exposing credentials, query details or hostnames", () => {
  for (const [code, expected] of Object.entries({ P2021: "DATABASE_SCHEMA_MISSING", P2022: "DATABASE_SCHEMA_MISSING", P1000: "DATABASE_ACCESS_DENIED", P1010: "DATABASE_ACCESS_DENIED", P1001: "DATABASE_UNAVAILABLE", P1002: "DATABASE_UNAVAILABLE", P1017: "DATABASE_UNAVAILABLE", P1003: "DATABASE_NOT_FOUND", P1008: "DATABASE_TIMEOUT", P2024: "DATABASE_TIMEOUT", P2028: "DATABASE_TIMEOUT", P2002: "DUPLICATE_RECORD", P2003: "RELATED_RECORD_MISSING", P2025: "RELATED_RECORD_MISSING", P2034: "CONCURRENT_UPDATE" })) {
    const result = publicProductivityError(known(code));
    assert.equal(result.code, expected);
    assert.ok(!JSON.stringify(result).includes(sensitive));
    assert.ok(result.status >= 400);
  }
  const initialization = publicProductivityError(new Prisma.PrismaClientInitializationError(sensitive, "test"));
  assert.equal(initialization.code, "DATABASE_CONFIGURATION");
  assert.ok(!initialization.error.includes(sensitive));
  const otherRuntime = Object.assign(new Error(sensitive), { name: "PrismaClientKnownRequestError", code: "P2021" });
  assert.equal(publicProductivityError(otherRuntime).code, "DATABASE_SCHEMA_MISSING");
});

it("keeps intentional validation and slot-conflict details while sanitizing unexpected thrown values", () => {
  assert.match(publicProductivityError(new ProductivityError("Enter a task title.")).error, /task title/);
  const conflict = new SlotConflictError([{ id: "own-event", title: "Reading", slot: { date: "2030-01-15", start: "13:00", end: "14:00", timezone: "Africa/Lagos" } }]);
  assert.equal(publicProductivityError(conflict).code, "SLOT_CONFLICT");
  assert.equal(publicProductivityError(conflict).conflicts?.length, 1);
  for (const value of [new Error(sensitive), new TypeError(sensitive), sensitive, undefined, null]) {
    assert.equal(publicProductivityError(value).code, "UNEXPECTED_ERROR");
    assert.ok(!productivityErrorMessage(value).includes(sensitive));
  }
});

it("returns actionable API errors with references and bounded diagnostic logs", async () => {
  const logs: unknown[][] = [];
  const spy = mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  try {
    operationError = known("P2021");
    const response = await post(request());
    const body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.code, "DATABASE_SCHEMA_MISSING");
    assert.match(body.error, /migrations/); assert.match(body.referenceId, /^[a-f0-9-]{36}$/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.ok(!JSON.stringify(body).includes(sensitive)); assert.ok(!JSON.stringify(logs).includes(sensitive));
    assert.equal((logs[0][1] as { referenceId: string }).referenceId, body.referenceId);
  } finally { spy.mock.restore(); }
});

it("separates invalid requests, sign-in failures and permission failures", async () => {
  assert.equal((await post(request("{"))).status, 400);
  assert.equal((await post(request("x".repeat(2 * 1024 * 1024 + 1)))).status, 400);
  assert.equal((await post(request(undefined, { Origin: "https://other.example" }))).status, 403);
  for (const [error, code, status] of [[badRequest("Choose a date."), "INVALID_INPUT", 400], [unauthorized("Sign in again."), "SIGN_IN_REQUIRED", 401], [forbidden("Use a student account."), "ACCESS_DENIED", 403]] as const) {
    operationError = error;
    const response = await post(request());
    assert.equal(response.status, status); assert.equal((await response.json()).code, code);
  }
});

it("preserves Next.js control-flow signals instead of masking them as application errors", async () => {
  try { redirect("/login"); } catch (error) { operationError = error; }
  assert.ok(operationError);
  await assert.rejects(post(request()), error => error === operationError);
});

it("retains the timetable failure reason when only part of an analytics range loads", async () => {
  const safe = publicProductivityError(new OfficialTimetableError(known("P1001")));
  assert.equal(safe.dependency, "official-timetable");
  assert.match(safe.error, /official timetable/i); assert.match(safe.error, /reach the database/);
  const result = await loadAcademicRange({ start: "2030-01-15", end: "2030-01-16" }, async day => {
    if (day === "2030-01-15") throw new ProductivityError(safe.error, safe.code);
    return [];
  });
  assert.deepEqual(result.failedDates, ["2030-01-15"]); assert.deepEqual(result.errors, [safe.error]);
});

it("identifies the specific invalid field instead of reporting generic settings errors", () => {
  assert.throws(() => validateTaskInput({ title: "Read", priority: "medium", dueTime: "13:00" }), /date before/);
  assert.throws(() => validateTaskInput({ title: "Read", priority: "medium", dueDate: "2030-01-15", dueTime: "27:00" }), /time.*00:00.*23:59/);
  assert.throws(() => validateHabit({ name: "Read", description: "x".repeat(10001) } as never, "Africa/Lagos"), /description.*10,000/);
  assert.throws(() => eventInput({ title: "", description: "Notes" }), /Event title/);
  assert.throws(() => timezone("invalid-zone"), /Timezone.*Africa\/Lagos/);
});
