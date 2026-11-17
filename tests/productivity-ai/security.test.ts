import "../helpers/env";
import { it, before } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { signDelegation, verifyDelegation, checkServiceSecret, assistantServiceUrl } from "@/services/productivity-layer/assistant/security";
import { validateTool } from "@/services/productivity-layer/assistant/schema";
import { needsConfirmation } from "@/services/productivity-layer/assistant/tools";
let privateKey: string;
before(() => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  privateKey = pair.privateKey; process.env.PRODUCTIVITY_AI_JWT_PRIVATE_KEY = privateKey; process.env.PRODUCTIVITY_AI_JWT_PUBLIC_KEY = pair.publicKey; process.env.PRODUCTIVITY_AI_SERVICE_TOKEN = "test-only-service-secret-with-at-least-32-characters";
});
it("verifies purpose-specific RS256 delegation and rejects tampering and audience confusion", () => {
  const token = signDelegation("student-A", "conversation-A", "turn-A", "akadverse-productivity-backend");
  const claims = verifyDelegation(token); assert.equal(claims.sub, "student-A"); assert.equal(claims.cid, "conversation-A"); assert.equal(claims.turn, "turn-A");
  assert.throws(() => verifyDelegation(token, "akadverse-productivity-ai"));
  const parts = token.split("."); const altered = { ...claims, sub: "student-B" };
  assert.throws(() => verifyDelegation(`${parts[0]}.${Buffer.from(JSON.stringify(altered)).toString("base64url")}.${parts[2]}`));
  const expired = Buffer.from(JSON.stringify({ ...claims, exp: 1 })).toString("base64url"), data = `${parts[0]}.${expired}`;
  assert.throws(() => verifyDelegation(`${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`));
  assert.throws(() => verifyDelegation('eyJhbGciOiJub25lIn0.e30.'));
});
it("requires dedicated service authentication and rejects noncanonical/unsecured service destinations", () => {
  checkServiceSecret(process.env.PRODUCTIVITY_AI_SERVICE_TOKEN!); assert.throws(() => checkServiceSecret(null)); assert.throws(() => checkServiceSecret("wrong"));
  process.env.PRODUCTIVITY_AI_SERVICE_URL = "http://127.0.0.1:8000"; assert.equal(assistantServiceUrl().origin, "http://127.0.0.1:8000");
  for (const value of ["http://example.com", "https://example.com/elsewhere", "https://user:password@example.com", "https://example.com?redirect=1"]) { process.env.PRODUCTIVITY_AI_SERVICE_URL = value; assert.throws(() => assistantServiceUrl()); }
});
it("rejects invented tools, identity injection, unknown nested keys, and malformed field types", () => {
  validateTool("create_task", { input: { title: "Read", priority: "high" } });
  for (const args of [{ input: { title: "Read", priority: "high", ownerId: "B" } }, { input: { title: 4, priority: "high" } }, { input: { title: "Read", priority: "urgent" } }, { input: { title: "Read", priority: "high" }, userId: "B" }]) assert.throws(() => validateTool("create_task", args));
  assert.throws(() => validateTool("run_sql", { sql: "select 1" }));
  assert.throws(() => validateTool("get_context", JSON.parse('{"__proto__":{}}')));
});
it("keeps destructive edits and conflict overrides behind backend confirmation", () => {
  for (const name of ["delete_task", "update_task", "archive_event", "archive_habit", "record_habit", "set_timezone", "miss_event"]) assert.equal(needsConfirmation(name, {}), true);
  assert.equal(needsConfirmation("create_task", {}), false);
  assert.equal(needsConfirmation("save_event", { scheduling: { allowConflicts: true } }), true);
  assert.equal(needsConfirmation("save_habit", { habit_id: "existing" }), true);
});

it("requires confirmation for every Buddy System write", () => {
  for (const name of ["create_buddy_group", "create_buddy_request", "apply_buddy", "accept_buddy_application", "decline_buddy_application", "close_buddy_listing"]) assert.equal(needsConfirmation(name, {}), true);
});
