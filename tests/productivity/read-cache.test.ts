import { it } from "node:test";
import assert from "node:assert/strict";
import { ProductivityReadCache } from "@/features/productivity/read-cache";
import { workspaceLocation } from "@/features/productivity/workspace/navigation";

it("deduplicates pending reads, reuses fresh values and retains stale content after refresh failure", async () => {
  let now = 0, calls = 0;
  const cache = new ProductivityReadCache("student-a", () => now);
  let resolve!: (value: number) => void;
  const load = () => { calls++; return new Promise<number>(done => { resolve = done; }); };
  const a = cache.read("today", load, ["today"]), b = cache.read("today", load, ["today"]);
  assert.equal(calls, 1); resolve(12);
  assert.deepEqual(await Promise.all([a, b]), [12, 12]);
  assert.equal(await cache.read("today", load, ["today"]), 12);
  now = 60001;
  assert.equal(cache.peek("today"), 12);
  await assert.rejects(cache.read("today", async () => { throw Error("offline"); }, ["today"]), /offline/);
  assert.equal(cache.peek("today"), 12);
});

it("invalidates affected views and prevents an older in-flight result from resurrecting stale data", async () => {
  const cache = new ProductivityReadCache("student-a");
  cache.seed("schedule", "kept", ["schedule"]);
  let resolve!: (value: string) => void, calls = 0;
  const pending = cache.read("tasks", () => ++calls === 1 ? new Promise<string>(done => { resolve = done; }) : Promise.resolve("saved"), ["tasks"]);
  cache.invalidate(["tasks", "today"]); resolve("old");
  assert.equal(await pending, "saved"); assert.equal(calls, 2);
  assert.equal(await cache.read("schedule", async () => "unexpected", ["schedule"]), "kept");
  cache.clear(); assert.equal(cache.peek("tasks"), undefined);
  assert.equal(new ProductivityReadCache("student-b").peek("schedule"), undefined);
});

it("defaults to Today while preserving established explicit section and item links", () => {
  assert.deepEqual(workspaceLocation(""), { section: "today" });
  assert.deepEqual(workspaceLocation("#today"), { section: "today" });
  assert.deepEqual(workspaceLocation("#tasks?task=task-1"), { section: "tasks", taskId: "task-1" });
  assert.deepEqual(workspaceLocation("#schedule?event=event-1&date=2026-11-14"), { section: "schedule", eventId: "event-1", scheduleDate: "2026-11-14" });
  assert.equal(workspaceLocation("#habits?habit=h-1&date=2026-11-14&edit=1").editHabit, true);
});
