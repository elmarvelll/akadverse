import test from "node:test";
import assert from "node:assert/strict";
import { todoTasks } from "../src/features/tasks/todo.ts";
import { queryTasks, taskStatusCounts } from "../src/features/tasks/queries.ts";
import { type Task, type TaskStatus } from "../src/features/tasks/domain.ts";
import { type Habit } from "../src/features/habits/domain.ts";
import { HabitService } from "../src/features/habits/service.ts";
import { BrowserHabitRepository } from "../src/features/habits/storage.ts";
import { BrowserTaskRepository } from "../src/features/tasks/storage.ts";
import { BrowserScheduleRepository } from "../src/features/schedule/storage.ts";
import { TaskService } from "../src/features/tasks/service.ts";
import { developmentIdentity, sampleAcademics } from "../src/features/schedule/adapters.ts";

const habit: Habit = { id: "daily", ownerId: "student", timezone: "Africa/Lagos", createdDate: "2030-01-01", createdAt: "2030-01-01T00:00:00Z", revisions: [{ name: "Wash clothes", description: "", type: "task", frequency: "daily", weekdays: [], time: "18:00", priority: "medium", effectiveDate: "2030-01-01", at: "2030-01-01T00:00:00Z", archived: false }] };
function task(date: string, status: TaskStatus = "pending", id = date): Task {
  return { id, ownerId: "student", title: "Wash clothes", priority: "medium", source: { kind: "habit", habitId: habit.id, occurrenceId: `${habit.id}:${date}`, habitName: habit.revisions[0].name, scheduledDate: date }, dueDate: date, dueTime: "18:00", status, createdAt: "2029-12-31T20:00:00Z", updatedAt: "2030-01-31T20:00:00Z", history: [], ...(status === "completed" ? { completedAt: "2030-01-01T00:00:00Z" } : {}), ...(status === "missed" ? { missedAt: "2030-01-31T20:00:00Z" } : {}) };
}
test("daily habit actions show only today while outcome tabs retain scheduled-date history", () => {
  for (const status of ["pending", "completed", "missed"] as const) {
    const records = Array.from({ length: 31 }, (_, index) => task(`2030-01-${String(index + 1).padStart(2, "0")}`, status));
    const before = JSON.stringify(records), instant = new Date("2030-01-15T12:00:00Z");
    const visible = todoTasks(records, [habit], "Africa/Lagos", instant);
    assert.deepEqual(visible.map(item => item.id), status === "pending" ? ["2030-01-15"] : records.map(item => item.id));
    const counts = taskStatusCounts(visible, "Africa/Lagos", instant);
    assert.equal(Object.values(counts).reduce((a, b) => a + b), status === "pending" ? 1 : 31);
    for (const tab of ["active", "pending", "completed", "missed"] as const) assert.equal(queryTasks(visible, { status: tab, timezone: "Africa/Lagos", instant }).length, counts[tab]);
    assert.equal(JSON.stringify(records), before);
  }
});
test("selected weekdays respect historical revisions, archive dates, event types, owners and original date deduplication", () => {
  const mwf: Habit = { ...habit, revisions: [{ ...habit.revisions[0], frequency: "weekdays", weekdays: [1, 3, 5] }, { ...habit.revisions[0], type: "event", end: "19:00", effectiveDate: "2030-01-19" }] };
  // January 14–18 is Monday–Friday; Saturday's later type change cannot rewrite it.
  for (let day = 14; day <= 19; day++) {
    const date = `2030-01-${day}`, item = task(date);
    const visible = todoTasks([item, { ...item, id: "duplicate", source: { ...item.source, occurrenceId: "legacy-alias" } as Task["source"] }], [mwf], "Africa/Lagos", new Date(date + "T12:00:00Z"));
    assert.equal(visible.length, [14, 16, 18].includes(day) ? 1 : 0);
  }
  assert.equal(todoTasks([task("2030-01-14")], [{ ...mwf, ownerId: "other" }], "Africa/Lagos", new Date("2030-01-14T12:00:00Z")).length, 0);
  assert.equal(todoTasks([task("2030-01-14")], [{ ...habit, revisions: [{ ...habit.revisions[0], archived: true }] }], "Africa/Lagos", new Date("2030-01-14T12:00:00Z")).length, 0);
});
test("deadline equality, missing times, local midnight, resume and timezone changes only change the display scope", () => {
  const records = [task("2030-01-15"), task("2030-01-16")];
  const before = JSON.stringify(records);
  for (const [instant, expected] of [["2030-01-15T16:59:00Z", "active"], ["2030-01-15T17:00:00Z", "pending"]] as const) {
    const now = new Date(instant), visible = todoTasks(records, [habit], "Africa/Lagos", now);
    assert.equal(taskStatusCounts(visible, "Africa/Lagos", now)[expected], 1);
    assert.equal(visible[0].status, "pending");
  }
  assert.equal(todoTasks(records, [habit], "Africa/Lagos", new Date("2030-01-15T22:59:59Z"))[0].id, "2030-01-15");
  const midnight = new Date("2030-01-15T23:00:00Z");
  assert.equal(todoTasks(records, [habit], "Africa/Lagos", midnight)[0].id, "2030-01-16");
  assert.equal(todoTasks(records, [habit], "America/New_York", midnight)[0].id, "2030-01-15");
  assert.equal(todoTasks(records, [habit], "Africa/Lagos", new Date("2030-01-20T12:00:00Z")).length, 0);
  const untimed = { ...records[0], dueTime: undefined };
  assert.equal(taskStatusCounts(todoTasks([untimed], [habit], "Africa/Lagos", new Date("2030-01-15T22:59:00Z")), "Africa/Lagos", new Date("2030-01-15T22:59:00Z")).active, 1);
  assert.equal(JSON.stringify(records), before);
});
test("ordinary tasks retain every date/status; missing rules and withdrawn habit occurrences are hidden", () => {
  const ordinary = [task("2029-12-01"), task("2030-02-01", "completed"), task("2030-02-02", "missed")].map(item => ({ ...item, source: { kind: "ordinary" as const } }));
  const now = new Date("2030-01-15T12:00:00Z");
  assert.deepEqual(todoTasks(ordinary, [], "Africa/Lagos", now), ordinary);
  assert.equal(todoTasks([task("2030-01-15")], [], "Africa/Lagos", now).length, 0);
  assert.equal(todoTasks([{ ...task("2030-01-15"), habitWithdrawn: true }], [habit], "Africa/Lagos", now).length, 0);
});
test("real shared records retain tracker history and synchronize outcomes after reload with no duplicate generation", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  let now = new Date("2030-01-15T12:00:00Z");
  const tasks = () => new TaskService(new BrowserTaskRepository(() => storage), developmentIdentity, () => now);
  const tracker = () => new HabitService(new BrowserHabitRepository(() => storage), tasks(), new BrowserScheduleRepository(() => storage), developmentIdentity, sampleAcademics, () => now);
  const rules = await tracker().save({ ...habit.revisions[0] });
  const range = { start: "2030-01-15", end: "2030-01-31" };
  await tracker().synchronize(range);
  let records = await tasks().listTasks(), visible = todoTasks(records, [rules], "Africa/Lagos", now);
  assert.equal(visible.length, 1); await tasks().completeTask(visible[0].id);
  assert.equal((await tracker().synchronize(range))[0].task!.status, "completed");
  now = new Date("2030-01-16T17:00:00Z");
  await tracker().record(rules.id, "2030-01-16", "missed");
  records = await tasks().listTasks(); visible = todoTasks(records, [rules], "Africa/Lagos", now);
  assert.equal(visible.length, 2); assert.equal(visible.find(item => item.dueDate === "2030-01-16")!.status, "missed");
  const snapshot = JSON.stringify(records);
  await tracker().synchronize(range);
  assert.equal(JSON.stringify(await tasks().listTasks()), snapshot);
  assert.equal(records.length, 17);
  assert.equal(records.find(item => item.dueDate === "2030-01-15")!.status, "completed");
  assert.equal((await tracker().synchronize(range)).length, 17);
});
