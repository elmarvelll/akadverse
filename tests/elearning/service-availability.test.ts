import "../helpers/env";
import { afterEach, it } from "node:test";
import assert from "node:assert/strict";
import { createSignedDownloadUrl } from "@/lib/storage/supabase-storage";
import { isDatabaseUnavailable } from "@/lib/database-availability";
import { ServiceError } from "@/lib/service-error";
import { stewartErrorResponse } from "@/app/api/e-learning/stewart/shared";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
it("retries download-link signing once after a connection failure", async () => {
  let requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests++;
    assert.ok(init?.signal);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    if (requests === 1) throw new TypeError("fetch failed");
    return Response.json({ signedURL: "/object/sign/course-materials/notes.pdf?token=fake" });
  };
  assert.equal(await createSignedDownloadUrl("course-materials", "notes.pdf", null), "https://storage.akadverse.test/storage/v1/object/sign/course-materials/notes.pdf?token=fake");
  assert.equal(requests, 2);
});
it("returns a safe temporary-unavailability error after both signing attempts fail", async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("private signed URL or credential must not leak"); };
  await assert.rejects(createSignedDownloadUrl("course-materials", "notes.pdf", null), (e: unknown) => e instanceof ServiceError && e.status === 503 && !e.message.includes("private"));
  assert.equal(requests, 2);
});
it("does not retry signing when the object is missing or credentials are rejected", async () => {
  for (const status of [404, 401]) {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return Response.json({}, { status }); };
    await assert.rejects(createSignedDownloadUrl("course-materials", "notes.pdf", null), (e: unknown) => e instanceof ServiceError && e.status === (status === 404 ? 404 : 502));
    assert.equal(requests, 1);
  }
});
it("classifies database connectivity failures from both Prisma clients without masking schema/auth errors", () => {
  for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024"]) {
    assert.equal(isDatabaseUnavailable({ code }), true);
    assert.equal(isDatabaseUnavailable({ errorCode: code }), true);
  }
  for (const error of [null, "P1001", {}, { code: "P2021" }, { code: "P2002" }, { code: "P1000" }]) assert.equal(isDatabaseUnavailable(error), false);
});
it("returns 503 for database outages and preserves authorization responses", async () => {
  const response = stewartErrorResponse("chat", { code: "P1001" });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match((await response.json()).error, /temporarily unreachable/);
  assert.equal(stewartErrorResponse("chat", new ServiceError(403, "Forbidden")).status, 403);
});
