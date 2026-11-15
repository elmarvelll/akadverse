import { after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { setProductivityAccount, rpc } from "@/features/productivity/client";
import { SlotConflictError } from "@/features/productivity/schedule/domain";
import { ProductivityError } from "@/features/productivity/errors";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
beforeEach(() => { globalThis.window = new EventTarget() as unknown as Window & typeof globalThis; setProductivityAccount(""); });
after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; setProductivityAccount(""); });

it("deduplicates simultaneous account reads, settles failures and retries only on a new explicit call", async () => {
  setProductivityAccount("A"); let calls = 0;
  let resolve!: (response: Response) => void;
  globalThis.fetch = async () => { calls++; return new Promise<Response>(done => { resolve = done; }); };
  const results = Promise.allSettled([rpc("context"), rpc("context")]);
  assert.equal(calls, 1);
  resolve(Response.json({ code: "DATABASE_TIMEOUT", error: "Database account read timed out." }, { status: 503 }));
  assert.ok((await results).every(result => result.status === "rejected"));
  await Promise.resolve(); assert.equal(calls, 1);
  const retried = rpc("context"); assert.equal(calls, 2);
  resolve(Response.json({ result: { student: { id: "A" } } }));
  assert.deepEqual(await retried, { student: { id: "A" } });
});

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

it("describes malformed and interrupted responses without losing a save's retry identifier", async () => {
  setProductivityAccount("A"); const ids: string[] = []; let changes = 0;
  window.addEventListener("productivity-layer:tasks-changed", () => changes++);
  const responses = [new Response("<html>Gateway unavailable</html>", { status: 502 }), new Response("{"), Response.json(null), Response.json({ unrelated: true }), Response.json({ result: { id: "saved" } })];
  globalThis.fetch = async (_url, options) => { ids.push(JSON.parse(String(options?.body)).requestId); return responses.shift()!; };
  await assert.rejects(rpc("tasks.create", [{ title: "Read" }]), /create this task.*server is unavailable/);
  for (let index = 0; index < 3; index++) await assert.rejects(rpc("tasks.create", [{ title: "Read" }]), /incomplete or unreadable response/);
  assert.equal(changes, 0);
  assert.deepEqual(await rpc("tasks.create", [{ title: "Read" }]), { id: "saved" });
  assert.equal(new Set(ids).size, 1); assert.equal(changes, 1);
});

it("shows classified server failures with their reference and hides unclassified server details", async () => {
  setProductivityAccount("A");
  globalThis.fetch = async () => Response.json({ code: "DATABASE_SCHEMA_MISSING", error: "Required database tables are missing. Apply migrations.", referenceId: "12345678-1234-1234-1234-123456789abc" }, { status: 503 });
  await assert.rejects(rpc("habits.list"), error => error instanceof ProductivityError && error.code === "DATABASE_SCHEMA_MISSING" && !!error.referenceId && /Apply migrations/.test(error.message));
  // The schema error pauses account A; a new account starts a fresh attempt.
  setProductivityAccount("B");
  globalThis.fetch = async () => Response.json({ error: "postgresql://private:secret@database" }, { status: 500 });
  await assert.rejects(rpc("schedule.load"), error => error instanceof ProductivityError && /load your schedule/.test(error.message) && !error.message.includes("postgresql"));
});

it("explains network failures and permission errors separately from expired sessions", async () => {
  setProductivityAccount("A");
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(rpc("tasks.create", [{}]), /save could not be confirmed.*Retry the same action/);
  await assert.rejects(rpc("tasks.list"), /connection.*Please retry loading/);
  let ended: unknown;
  window.addEventListener("productivity:session-ended", event => { ended = (event as CustomEvent).detail; });
  globalThis.fetch = async () => new Response("Denied", { status: 403 });
  await assert.rejects(rpc("tasks.list"), /student account/);
  assert.ok(ended instanceof ProductivityError && ended.code === "ACCESS_DENIED");
});

it("rejects stale-account responses even while the response body is being decoded", async () => {
  setProductivityAccount("A");
  let finish!: (value: unknown) => void;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }) as Response;
  const read = rpc("tasks.list");
  await Promise.resolve(); setProductivityAccount("B"); finish({ result: [{ title: "A private" }] });
  await assert.rejects(read, /account changed/);
});

it("times out a stalled save with an uncertainty message and keeps its retry identifier", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] }); setProductivityAccount("A");
  const ids: string[] = [];
  globalThis.fetch = async (_url, options) => {
    ids.push(JSON.parse(String(options?.body)).requestId);
    return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  };
  const save = rpc("tasks.create", [{}]);
  context.mock.timers.tick(45000);
  await assert.rejects(save, error => error instanceof ProductivityError && error.code === "REQUEST_TIMEOUT" && /save could not be confirmed/.test(error.message));
  globalThis.fetch = async (_url, options) => { ids.push(JSON.parse(String(options?.body)).requestId); return Response.json({ result: {} }); };
  await rpc("tasks.create", [{}]); assert.equal(ids[0], ids[1]);
});

it("pauses all further workspace requests after a persistent database setup failure", async () => {
  setProductivityAccount("A"); let calls = 0, setupEvents = 0, sessionEvents = 0;
  window.addEventListener("productivity:setup-required", () => setupEvents++);
  window.addEventListener("productivity:session-ended", () => sessionEvents++);
  globalThis.fetch = async () => { calls++; return Response.json({ code: "DATABASE_SCHEMA_MISSING", error: "Required workspace tables are missing." }, { status: 503 }); };
  await assert.rejects(rpc("context"), /tables are missing/);
  for (const operation of ["context", "tasks.list", "schedule.load", "habits.synchronize", "tasks.create"]) await assert.rejects(rpc(operation), /tables are missing/);
  assert.equal(calls, 1); assert.equal(setupEvents, 1); assert.equal(sessionEvents, 0);
  setProductivityAccount("B");
  globalThis.fetch = async () => { calls++; return Response.json({ result: [] }); };
  assert.deepEqual(await rpc("tasks.list"), []); assert.equal(calls, 2);
});

it("does not pause the personal workspace when only the official timetable needs setup", async () => {
  setProductivityAccount("A"); let setupEvents = 0;
  window.addEventListener("productivity:setup-required", () => setupEvents++);
  globalThis.fetch = async () => Response.json({ code: "DATABASE_SCHEMA_MISSING", dependency: "official-timetable", error: "The official timetable database needs setup." }, { status: 503 });
  await assert.rejects(rpc("official.classes", ["2030-01-15"]), /timetable database/);
  globalThis.fetch = async () => Response.json({ result: [] });
  assert.deepEqual(await rpc("tasks.list"), []); assert.equal(setupEvents, 0);
});
