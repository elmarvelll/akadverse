import "../helpers/env";
import { before, beforeEach, after, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ServiceError } from "@/lib/service-error";
let role = "student", user = "", calls = 0;
const original = globalThis.fetch;
mock.module("@/services/productivity-layer/auth", { namedExports: { requireProductivityUser: async () => { if (!user) throw new ServiceError(401, "Sign in first."); if (role !== "student") throw new ServiceError(403, "Students only."); return { id: user }; } } });
let post: typeof import("@/app/api/speech/token/route").POST;
before(async () => { ({ POST: post } = await import("@/app/api/speech/token/route")); });
beforeEach(() => {
  role = "student"; user = crypto.randomUUID(); calls = 0; process.env.ASSEMBLYAI_API_KEY = "test-permanent-speech-key";
  globalThis.fetch = async (url, init) => { calls++; assert.equal(String(url), "https://token.assemblyai.com/v1/token"); assert.equal(new Headers(init?.headers).get("authorization"), "test-permanent-speech-key"); const data = JSON.parse(String(init?.body)); assert.equal(data.product, "streaming"); assert.equal(data.expires_in_seconds, 15); assert.equal(data.access.tts.enabled, false); return Response.json({ token: "temporary-test-token" }); };
});
after(() => { globalThis.fetch = original; });
const request = (content = "{}", origin = "https://app.test") => new Request("https://app.test/api/speech/token", { method: "POST", headers: { "content-type": "application/json", origin }, body: content });
it("returns a restricted temporary token in the browser envelope without exposing provider credentials", async () => {
  const response = await post(request()); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/);
  const payload = await response.json(); assert.equal(payload.result.token, "temporary-test-token"); assert.equal(payload.result.sampleRate, 16000); assert.ok(!JSON.stringify(payload).includes("test-permanent-speech-key"));
});
it("rejects missing/non-student sessions and cross-origin/client-controlled speech configuration", async () => {
  user = ""; assert.equal((await post(request())).status, 401);
  user = crypto.randomUUID(); role = "faculty"; assert.equal((await post(request())).status, 403); role = "student";
  assert.equal((await post(request("{}", "https://evil.test"))).status, 403);
  assert.equal((await post(request('{"provider":"other"}'))).status, 400);
  assert.equal((await post(request("x".repeat(1100)))).status, 413); assert.equal(calls, 0);
});
it("limits issuance and sanitises provider failures", async () => {
  for (let i = 0; i < 4; i++) assert.equal((await post(request())).status, 200);
  assert.equal((await post(request())).status, 429); assert.equal(calls, 4);
  user = crypto.randomUUID(); globalThis.fetch = async () => Response.json({ error: "private provider response" }, { status: 401 });
  const failed = await post(request()); assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("private provider response"));
});
