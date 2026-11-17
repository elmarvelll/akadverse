import { it } from "node:test";
import assert from "node:assert/strict";
import { capacity, canAccept, inviteUrl } from "@/features/productivity/buddy/domain";
import { workspaceLocation } from "@/features/productivity/workspace/navigation";
it("validates supported private invitations and rejects unsafe URLs", () => {
  for (const url of ["https://chat.whatsapp.com/Abc123456789", "https://chat.whatsapp.com/Abc123456789?mode=gi_t", "https://t.me/+abcdef_123", "https://telegram.me/joinchat/abcdef_123"]) assert.ok(inviteUrl(url), url);
  for (const url of ["javascript:alert(1)", "http://t.me/+abcdef", "https://t.me/username", "https://chat.whatsapp.com.evil.test/Abc123456789", "https://evil@t.me/+abcdef", "https://t.me/+abcdef?redirect=evil", "https://chat.whatsapp.com/Abc123456789#evil", "not a URL"]) assert.equal(inviteUrl(url), null, url);
});
it("treats empty capacity as unlimited and enforces positive whole numbers", () => {
  for (const value of [null, undefined, ""]) assert.equal(capacity(value), null);
  assert.equal(capacity("1"), 1); assert.equal(capacity(10), 10);
  for (const value of [0, -1, 1.5, "2.5", "-1", "abc", Infinity, true]) assert.throws(() => capacity(value));
  assert.equal(canAccept("OPEN", 100, null), true); assert.equal(canAccept("OPEN", 2, 2), false);
  for (const status of ["FULL", "CLOSED", "MATCHED"]) assert.equal(canAccept(status, 1, null), false);
});
it("resolves direct Buddy System and listing links using workspace conventions", () => {
  assert.equal(workspaceLocation("#buddy").section, "buddy");
  assert.deepEqual(workspaceLocation("#buddy?listing=test%20id"), { section: "buddy", buddyId: "test id" });
  assert.equal(workspaceLocation("#tasks").section, "tasks");
});
