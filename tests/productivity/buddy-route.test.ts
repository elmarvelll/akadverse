import "../helpers/env";
import { before, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/lib/service-error";
let denied = 0, calls = 0;
let browseFailure: Error | undefined;
mock.module("@/services/productivity-layer/auth", { namedExports: { requireProductivityUser: async () => { if (denied) throw new ServiceError(denied, "Denied"); return { id: "student" }; } } });
mock.module("@/services/productivity-layer/buddy-system/service", { namedExports: {
  browseBuddy: async () => { calls++; if (browseFailure) throw browseFailure; return { items: [], hasMore: false }; },
  buddyDetail: async () => { calls++; return { id: "listing" }; },
  createBuddy: async () => { calls++; return { id: "listing" }; },
  mutateBuddy: async () => { calls++; return { message: "Saved" }; },
} });
let route: typeof import("@/app/api/productivity/buddy/route");
before(async () => { route = await import("@/app/api/productivity/buddy/route"); });
it("requires student authorization before all Buddy reads and writes", async () => {
  for (const status of [401, 403]) for (const method of ["GET", "POST", "PATCH"] as const) {
    denied = status; calls = 0;
    const response = await route[method](new Request("https://akadverse.test/api/productivity/buddy", { method, ...(method !== "GET" ? { body: "{}" } : {}) }));
    assert.equal(response.status, status); assert.equal(calls, 0); assert.match(response.headers.get("Cache-Control")!, /no-store/);
  }
  denied = 0;
});
it("rejects cross-origin mutations, invalid JSON, and oversized bodies before service calls", async () => {
  for (const input of [{ origin: "https://evil.test", body: "{}", status: 403 }, { origin: "https://akadverse.test", body: "invalid", status: 400 }, { origin: "https://akadverse.test", body: "x".repeat(17000), status: 400 }]) {
    calls = 0;
    const response = await route.POST(new Request("https://akadverse.test/api/productivity/buddy", { method: "POST", headers: { Origin: input.origin, "Content-Type": "application/json" }, body: input.body }));
    assert.equal(response.status, input.status); assert.equal(calls, 0);
  }
});
it("marks authenticated responses private and routes reads and creation correctly", async () => {
  calls = 0;
  assert.equal((await route.GET(new Request("https://akadverse.test/api/productivity/buddy"))).status, 200);
  assert.equal((await route.GET(new Request("https://akadverse.test/api/productivity/buddy?id=listing"))).status, 200);
  const created = await route.POST(new Request("https://akadverse.test/api/productivity/buddy", { method: "POST", headers: { Origin: "https://akadverse.test", "Content-Type": "application/json" }, body: "{}" }));
  assert.equal(created.status, 201); assert.match(created.headers.get("Cache-Control")!, /private/); assert.equal(calls, 3);
});

it("reports missing Buddy schema with a safe setup error and traceable reference", async () => {
  const log = mock.method(console, "error", () => {});
  browseFailure = new Prisma.PrismaClientKnownRequestError("private database details must not escape", { code: "P2021", clientVersion: "6.19.3", meta: { table: "public.BuddyListing" } });
  try {
    const response = await route.GET(new Request("https://akadverse.test/api/productivity/buddy"));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.code, "DATABASE_SCHEMA_MISSING");
    assert.match(body.error, /migrations/);
    assert.match(body.referenceId, /^[a-f0-9-]{36}$/);
    assert.ok(!JSON.stringify(body).includes("private database details"));
    const logged = log.mock.calls[0].arguments[1];
    assert.equal(logged.referenceId, body.referenceId);
    assert.equal(logged.prismaCode, "P2021");
    assert.ok(!JSON.stringify(log.mock.calls).includes("private database details"));
  } finally { browseFailure = undefined; log.mock.restore(); }
});
