import { it } from "node:test";
import assert from "node:assert/strict";
import { SaveNotifications } from "../../src/features/productivity/notifications";
import { ProductivityError } from "../../src/features/productivity/errors";

function fixture() {
  let now = 0, sequence = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const store = new SaveNotifications({ now: () => now, set: (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; }, clear: id => { timers.delete(id as number); } });
  const tick = (ms: number) => { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); } };
  return { store, tick, timers };
}
it("keeps slow saves pending, then replaces the same notification and dismisses five seconds after confirmation", async () => {
  const { store, tick } = fixture(); let resolve!: (value: number) => void;
  const save = store.run("event", () => new Promise<number>(done => { resolve = done; }), "Event saved.");
  const id = store.snapshot()[0].id;
  tick(17000); assert.equal(store.snapshot()[0].state, "pending");
  resolve(42); assert.equal(await save, 42);
  assert.deepEqual(store.snapshot(), [{ id, state: "success", message: "Event saved." }]);
  tick(4999); assert.equal(store.snapshot().length, 1); tick(1); assert.equal(store.snapshot().length, 0);
});
it("pauses remaining time for hover and focus together; subscriptions and reads never reset it", async () => {
  const { store, tick } = fixture(); await store.run("task", async () => true, "Completed.");
  const id = store.snapshot()[0].id;
  tick(2000); store.pause(id, "hover"); tick(9000); store.pause(id, "focus"); store.resume(id, "hover"); tick(9000);
  assert.equal(store.snapshot().length, 1); store.resume(id, "focus");
  const unsubscribe = store.subscribe(() => {}); store.snapshot(); unsubscribe();
  tick(2999); assert.equal(store.snapshot().length, 1); tick(1); assert.equal(store.snapshot().length, 0);
});
it("retains safe errors without retries, propagates rejection, and allows manual dismissal", async () => {
  const { store, tick, timers } = fixture(); let calls = 0;
  await assert.rejects(store.run("failed", async () => { calls++; throw new ProductivityError("The save timed out. Retry the same action.", "DATABASE_TIMEOUT"); }, "Saved."));
  tick(60000); assert.equal(calls, 1); assert.equal(store.snapshot()[0].state, "error"); assert.equal(timers.size, 0);
  store.dismiss(store.snapshot()[0].id); assert.equal(store.snapshot().length, 0);
  await assert.rejects(store.run("unsafe", async () => { throw new Error("secret database address"); }, "Saved."));
  assert.ok(!store.snapshot()[0].message.includes("secret"));
});
it("deduplicates a pending action but keeps separate actions and explicit retries distinguishable", async () => {
  const { store } = fixture(); let resolve!: () => void, calls = 0;
  const operation = () => { calls++; return new Promise<void>(done => { resolve = done; }); };
  const first = store.run("same", operation, "Saved."); const duplicate = store.run("same", operation, "Saved.");
  assert.equal(first, duplicate); assert.equal(calls, 1); assert.equal(store.snapshot().length, 1);
  await store.run("different", async () => true, "Other saved."); assert.equal(store.snapshot().length, 2);
  resolve(); await first; await store.run("same", async () => true, "Saved again."); assert.equal(store.snapshot().length, 3);
});
it("dismissal and account cleanup cannot resurrect notifications after pending saves settle", async () => {
  const { store, timers } = fixture(); let resolve!: () => void;
  const save = store.run("dismiss", () => new Promise<void>(done => { resolve = done; }), "Saved.");
  store.dismiss(store.snapshot()[0].id); resolve(); await save; assert.equal(store.snapshot().length, 0);
  await store.run("success", async () => true, "Saved."); assert.equal(timers.size, 1);
  const pending = store.run("pending", () => new Promise<void>(done => { resolve = done; }), "Saved.");
  store.clear(); resolve(); await pending; assert.equal(timers.size, 0); assert.equal(store.snapshot().length, 0);
});
it("replaces a failed notification on an explicit retry of the same action", async () => {
  const { store, tick } = fixture();
  await assert.rejects(store.run("retry", async () => { throw new ProductivityError("Retry the same action."); }, "Saved."));
  const id = store.snapshot()[0].id;
  let resolve!: () => void;
  const retried = store.run("retry", () => new Promise<void>(done => { resolve = done; }), "Saved.");
  assert.deepEqual(store.snapshot(), [{ id, state: "pending", message: "Saving…" }]);
  resolve(); await retried; assert.equal(store.snapshot().length, 1); assert.equal(store.snapshot()[0].id, id);
  tick(5000); assert.equal(store.snapshot().length, 0);
});
