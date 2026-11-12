import { after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { setProductivityAccount, rpc } from "@/features/productivity/client";
import { SlotConflictError } from "@/features/productivity/schedule/domain";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
beforeEach(() => { globalThis.window = new EventTarget() as unknown as Window & typeof globalThis; setProductivityAccount(""); });
after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; setProductivityAccount(""); });

it("rejects in-flight data from the previous account and sends the new identity guard", async () => {
  setProductivityAccount("A");
  let resolve!: (response: Response) => void;
  globalThis.fetch = async () => new Promise<Response>(done => { resolve = done; });
  const oldRead = rpc("tasks.list"); setProductivityAccount("B");
  resolve(Response.json({ result: [{ title: "A private" }] }));
  await assert.rejects(oldRead, /account changed/);
  globalThis.fetch = async (_url, options) => {
    assert.equal((options?.headers as Record<string, string>)["X-Productivity-User"], "B");
    assert.equal(options?.cache, "no-store");
    return Response.json({ result: [{ title: "B private" }] });
  };
  assert.deepEqual(await rpc("tasks.list"), [{ title: "B private" }]);
});
it("retains mutation identifiers after a lost response and clears them when switching accounts", async () => {
  setProductivityAccount("A"); const identifiers: string[] = [];
  globalThis.fetch = async (_url, options) => { identifiers.push(JSON.parse(String(options?.body)).requestId); throw new TypeError("network"); };
  await assert.rejects(rpc("tasks.create", [{ title: "Read" }]));
  await assert.rejects(rpc("tasks.create", [{ title: "Read" }]));
  assert.equal(identifiers[0], identifiers[1]);
  setProductivityAccount("B"); await assert.rejects(rpc("tasks.create", [{ title: "Read" }]));
  assert.notEqual(identifiers[1], identifiers[2]);
});
it("does not announce success after failed saves and hides the workspace on session expiry", async () => {
  setProductivityAccount("A"); let success = 0, ended = 0;
  window.addEventListener("productivity-layer:tasks-changed", () => success++);
  window.addEventListener("productivity:session-ended", () => ended++);
  globalThis.fetch = async () => Response.json({ error: "failed" }, { status: 500 });
  await assert.rejects(rpc("tasks.create", [{}])); assert.equal(success, 0);
  globalThis.fetch = async () => Response.json({ error: "expired" }, { status: 401 });
  await assert.rejects(rpc("tasks.list")); assert.equal(ended, 1); assert.equal(success, 0);
});
it("preserves explicit clash confirmation and avoids refresh loops during occurrence synchronization", async () => {
  setProductivityAccount("A"); let changes = 0;
  window.addEventListener("productivity-layer:habits-changed", () => changes++);
  globalThis.fetch = async () => Response.json({ result: [] });
  await rpc("habits.synchronize", [{ start: "2030-01-15", end: "2030-01-15" }]); assert.equal(changes, 0);
  globalThis.fetch = async () => Response.json({ code: "SLOT_CONFLICT", conflicts: [{ id: "owned", title: "Read", slot: { date: "2030-01-15", start: "13:00", end: "14:00", timezone: "Africa/Lagos" } }] }, { status: 409 });
  await assert.rejects(rpc("schedule.save", [{}]), error => error instanceof SlotConflictError && error.conflicts.length === 1);
});
