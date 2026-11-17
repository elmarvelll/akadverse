import { it } from "node:test";
import assert from "node:assert/strict";
import { sequentialPoll } from "@/lib/sequential-poll";
it("slow recovery reads never overlap and cancellation prevents rescheduling", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0, finish!: () => void;
  const stop = sequentialPoll(() => { calls++; return new Promise<void>(resolve => { finish = resolve; }); }, 2500);
  context.mock.timers.tick(2500); assert.equal(calls, 1);
  context.mock.timers.tick(30000); assert.equal(calls, 1);
  finish(); await Promise.resolve(); await Promise.resolve();
  context.mock.timers.tick(2500); assert.equal(calls, 2);
  stop(); finish(); await Promise.resolve(); await Promise.resolve();
  context.mock.timers.tick(30000); assert.equal(calls, 2);
});
it("a failed recovery read is retried at the next interval and can be stopped", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] }); let calls = 0;
  const stop = sequentialPoll(async () => { calls++; throw Error("offline"); }, 2500);
  context.mock.timers.tick(2500); await Promise.resolve(); await Promise.resolve();
  context.mock.timers.tick(2500); assert.equal(calls, 2);
  stop(); await Promise.resolve(); context.mock.timers.tick(10000); assert.equal(calls, 2);
});
