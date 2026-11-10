import test from "node:test";
import assert from "node:assert/strict";
import { mergedDuration, percentages, scheduleAnalytics, taskAnalytics } from "../src/features/analytics/calculations.ts";
import { dayBounds, instantInRange, loadAcademicRange, localInstant, presetRange, rangeDays } from "../src/features/analytics/periods.ts";
import { emptyDataset, localNow, type Dataset, type HistoryEntry, type OfficialClass, type PersonalEvent, type Slot } from "../src/features/schedule/domain.ts";
import { emptyTasks, type Task } from "../src/features/tasks/domain.ts";
import { TaskService } from "../src/features/tasks/service.ts";
import { developmentIdentity } from "../src/features/schedule/adapters.ts";

const owner = "development-student", timezone = "Africa/Lagos";
const range = { start: "2030-11-04", end: "2030-11-06" };
const at = "2030-11-04T12:00:00.000Z";
const slot = (start = "16:00", end = "17:00", date = range.start, zone = timezone): Slot => ({ date, start, end, timezone: zone });
function event(id: string, planned = slot(), scheduleId?: string): PersonalEvent {
  return { id, ownerId: owner, title: id, description: "", slot: planned, originalSlot: planned, subScheduleId: scheduleId, priority: "medium", source: { kind: "personal" }, status: "pending", mustComplete: false, createdAt: at, updatedAt: at, history: [{ id: id + ":created", kind: "created", at, planned, mustComplete: false }] };
}
function dataset(events: PersonalEvent[] = []): Dataset {
  return { ...emptyDataset(), events, schedules: [ ["exercise", "Exercise", false], ["spiritual", "Spirituality", false], ["academic", "Academics", true] ].map(([id, name, academic]) => ({ id: id as string, name: name as string, academic: academic as boolean, description: "", ownerId: owner, createdAt: at, updatedAt: at })) };
}
function lecture(overrides: Partial<OfficialClass> = {}): OfficialClass {
  return { id: "official:one", sourceId: "source:one", registrationId: "registered:one", courseCode: "CSC 201", courseName: "Data Structures", lecturer: "Lecturer", venue: "Room", semester: "Test", classGroup: "A", slot: slot("09:00", "10:30"), state: "scheduled", registrationState: "registered", ...overrides };
}
function task(id: string, overrides: Partial<Task> = {}): Task {
  return { id, ownerId: owner, title: id, priority: "medium", source: { kind: "ordinary" }, status: "pending", createdAt: at, updatedAt: at, history: [], ...overrides };
}

test("merged intervals handle overlap, containment, adjacency and duplicate representations without mutation", () => {
  const intervals = [{ start: 0, end: 20 }, { start: 10, end: 30 }, { start: 5, end: 15 }, { start: 30, end: 40 }, { start: 0, end: 20 }, { start: 60, end: 70 }];
  const before = structuredClone(intervals);
  assert.equal(mergedDuration(intervals), 50); assert.deepEqual(intervals, before);
});
test("area totals merge within areas while daily occupied time merges across areas and official duplicates", () => {
  const a = event("a", slot("16:00", "18:00"), "exercise"), b = event("b", slot("17:00", "19:00"), "exercise"), c = event("c", slot("17:00", "20:00"), "spiritual");
  const data = dataset([a, b, c, a]), official = lecture();
  const before = structuredClone(data);
  const result = scheduleAnalytics(data, [official, { ...official, id: "another-representation" }], owner, range, timezone);
  assert.equal(result.areas.find(row => row.key === "exercise")!.hours, 3);
  assert.equal(result.areas.find(row => row.key === "exercise")!.entries, 2);
  assert.equal(result.areas.find(row => row.key === "spiritual")!.hours, 3);
  assert.equal(result.areas.find(row => row.key === "academic")!.hours, 1.5);
  assert.equal(result.totalHours, 5.5);
  assert.deepEqual(result.daily.map(row => row.hours), [5.5, 0, 0]);
  assert.deepEqual(data, before);
});
test("shared habit events count once, unassigned records have one area, archived/cancelled/dropped/other-owner entries are excluded", () => {
  const habit = { ...event("habit-one"), source: { kind: "habit" as const, habitId: "reading", occurrenceId: "monday" } };
  const records = dataset([habit, { ...habit, id: "alias" }, { ...event("archived"), archivedAt: at }, { ...event("other"), ownerId: "other" }]);
  const result = scheduleAnalytics(records, [lecture({ state: "cancelled" }), lecture({ id: "two", sourceId: "two", registrationState: "dropped" })], owner, range, timezone);
  assert.equal(result.totalHours, 1); assert.equal(result.areas.length, 1);
  assert.equal(result.areas[0].label, "Unassigned"); assert.equal(result.areas[0].entries, 1);
});
test("overnight and cross-zone intervals clip to the selected period and split at student local midnight", () => {
  const records = dataset([event("before", slot("23:00", "01:00", "2030-11-03")), event("cross-zone", slot("22:30", "23:30", range.start, "UTC")), event("end", slot("23:00", "02:00", range.end))]);
  const result = scheduleAnalytics(records, [], owner, range, timezone);
  assert.deepEqual(result.daily.map(row => row.hours), [1.5, 0.5, 1]);
  assert.equal(result.totalHours, 3);
});
test("local day boundaries handle DST, missing wall times and ambiguous times explicitly", () => {
  const spring = dayBounds("2030-03-10", "America/New_York"), autumn = dayBounds("2030-11-03", "America/New_York");
  assert.equal((spring.end - spring.start) / 3600000, 23);
  assert.equal((autumn.end - autumn.start) / 3600000, 25);
  assert.equal(localInstant("2030-03-10", "02:30", "America/New_York"), undefined);
  assert.equal(new Date(localInstant("2030-11-03", "01:30", "America/New_York")!).toISOString(), "2030-11-03T05:30:00.000Z");
});
test("action membership uses local timestamp boundaries, not UTC dates", () => {
  const single = { start: range.start, end: range.start };
  assert.equal(instantInRange("2030-11-03T23:00:00.000Z", single, timezone), true);
  assert.equal(instantInRange("2030-11-04T22:59:59.999Z", single, timezone), true);
  assert.equal(instantInRange("2030-11-04T23:00:00.000Z", single, timezone), false);
});
test("missed actions distinguish attempts from events and only missed-flow personal moves count as rescheduling", () => {
  const e = event("missed", slot("16:00", "17:00", "2030-11-01"), "exercise");
  const next = slot("16:00", "17:00", range.start);
  const history: HistoryEntry[] = [
    { id: "m1", kind: "missed", at, planned: e.slot, mustComplete: false },
    { id: "r1", kind: "rescheduled", at, planned: e.slot, next, mustComplete: false },
    { id: "m2", kind: "missed", at, planned: next, mustComplete: false },
    { id: "r2", kind: "rescheduled", at, planned: next, next: slot("18:00", "19:00"), mustComplete: false },
    { id: "edit", kind: "edited", at, planned: e.slot, next, mustComplete: false },
  ];
  e.history = [...history, history[0]];
  const result = scheduleAnalytics(dataset([e, e]), [lecture()], owner, range, timezone);
  assert.equal(result.missedAttempts, 2); assert.equal(result.missedEvents, 1); assert.equal(result.rescheduledEvents, 1);
  assert.deepEqual(result.attemptsByArea[0], { key: "exercise", label: "Exercise", attempts: 2, missedEvents: 1, rescheduledEvents: 1 });
});
test("incomplete/orphan attempt history reports partial data without inventing actions", () => {
  const e = event("legacy"); e.status = "requires-replanning";
  e.history = [{ id: "orphan", kind: "rescheduled", at, planned: e.slot, next: slot("18:00", "19:00"), mustComplete: false }, { id: "missing-at", kind: "missed", at: "", planned: e.slot, mustComplete: false }];
  const result = scheduleAnalytics(dataset([e]), [], owner, range, timezone);
  assert.equal(result.missedAttempts, 0); assert.equal(result.rescheduledEvents, 0); assert.ok(result.warnings.length);
});
test("task status uses creation dates/current outcomes while trend uses completion dates, with zero days", () => {
  const earlier = task("earlier", { createdAt: "2030-10-01T12:00:00Z", status: "completed", completedAt: at });
  const now = task("now", { status: "completed", completedAt: "2030-12-01T12:00:00Z" });
  const pending = task("pending");
  const habit = task("habit", { source: { kind: "habit", habitId: "read", occurrenceId: "one", habitName: "Read", scheduledDate: range.start }, status: "missed" });
  const result = taskAnalytics([earlier, now, pending, habit, { ...habit, id: "alias" }, pending, task("deleted", { deletedAt: at }), task("other", { ownerId: "other" })], owner, range, timezone, new Date("2031-01-01T00:00:00Z"));
  assert.equal(result.createdTotal, 3); assert.deepEqual(result.statuses.map(row => row.count), [1, 0, 1, 1]);
  assert.equal(result.completedTotal, 1); assert.deepEqual(result.daily.map(row => row.count), [1, 0, 0]);
  assert.equal(result.eligibleTotal, 0);
});
test("deadline categories reconcile by deadline date and handle equality, date-only end, undated/future and missing completion timestamps", () => {
  const deadline = localInstant(range.start, "18:00", timezone)!;
  const common = { createdAt: "2030-10-01T00:00:00Z", dueDate: range.start, dueTime: "18:00" };
  const records = [
    task("ontime", { ...common, status: "completed", completedAt: new Date(deadline).toISOString() }),
    task("late", { ...common, status: "completed", completedAt: new Date(deadline + 1).toISOString() }),
    task("miss", { ...common, status: "missed", missedAt: "2031-01-01T00:00:00Z" }),
    task("overdue", common),
    task("unknown", { ...common, status: "completed" }),
    task("undated", { status: "completed", completedAt: at }),
    task("future", { dueDate: range.end, dueTime: "23:00" }),
    task("date-only", { dueDate: range.start, status: "completed", completedAt: new Date(dayBounds(range.start, timezone).end - 1).toISOString() }),
  ];
  const before = structuredClone(records);
  const result = taskAnalytics(records, owner, range, timezone, new Date("2030-11-06T12:00:00Z"));
  assert.equal(result.eligibleTotal, 6); assert.deepEqual(result.deadline.map(row => row.count), [2, 1, 1, 1, 1]);
  assert.equal(result.deadline.reduce((sum, row) => sum + row.count, 0), result.eligibleTotal);
  assert.ok(Math.abs(result.deadline.reduce((sum, row) => sum + row.percent, 0) - 100) < 0.00001);
  assert.ok(result.warnings.some(warning => warning.includes("completion timestamp")));
  assert.deepEqual(records, before);
});
test("date-only deadlines are not passed until the local day ends", () => {
  const pending = task("date-only", { dueDate: range.start });
  const before = taskAnalytics([pending], owner, range, timezone, new Date("2030-11-04T22:59:59.998Z"));
  const after = taskAnalytics([pending], owner, range, timezone, new Date("2030-11-04T23:00:00.000Z"));
  assert.equal(before.eligibleTotal, 0); assert.equal(after.deadline.find(row => row.key === "overdue")!.count, 1);
  assert.equal(pending.status, "pending");
});
test("zero periods include zero days and safe zero-denominator percentages", () => {
  const schedule = scheduleAnalytics(dataset(), [], owner, range, timezone);
  assert.equal(schedule.totalHours, 0); assert.equal(schedule.daily.length, 3); assert.equal(schedule.areas.length, 0);
  const tasks = taskAnalytics([], owner, range, timezone, new Date(at));
  assert.equal(tasks.createdTotal, 0); assert.equal(tasks.eligibleTotal, 0); assert.equal(tasks.daily.length, 3);
  assert.ok(tasks.statuses.every(row => row.percent === 0));
  const thirds = percentages(["a", "b", "c"].map(key => ({ key, label: key, count: 1 })));
  assert.deepEqual(thirds.map(row => row.percent), [33.4, 33.3, 33.3]);
  assert.equal(Math.round(thirds.reduce((sum, row) => sum + row.percent, 0) * 10), 1000);
});
test("period presets use Monday/local month and reject invalid or excessive custom ranges", () => {
  assert.deepEqual(presetRange("week", timezone, new Date(at)), { start: "2030-11-04", end: "2030-11-10" });
  assert.deepEqual(presetRange("month", timezone, new Date(at)), { start: "2030-11-01", end: "2030-11-30" });
  assert.throws(() => rangeDays({ start: range.end, end: range.start }), /end on or after/);
  assert.throws(() => rangeDays({ start: "2030-02-30", end: range.end }), /valid dates/);
  assert.throws(() => rangeDays({ start: "2030-01-01", end: "2031-12-31" }), /366/);
});
test("academic retrieval is bounded and reports partial failures including midnight-boundary coverage", async () => {
  let active = 0, maximum = 0;
  const requested: string[] = [];
  const result = await loadAcademicRange(range, async date => {
    requested.push(date); active++; maximum = Math.max(maximum, active); await Promise.resolve(); active--;
    if (date === "2030-11-05") throw new Error("Unavailable");
    return [lecture({ slot: slot("09:00", "10:00", date), sourceId: date })];
  });
  assert.ok(maximum <= 4); assert.deepEqual(result.failedDates, ["2030-11-05"]);
  assert.ok(requested.includes("2030-11-03")); assert.equal(result.rows.length, 3);
});
test("repeated real completion calls count one success without changing persistence during analytics", async () => {
  let persisted = emptyTasks();
  const service = new TaskService({ async load() { return structuredClone(persisted); }, async save(data) { persisted = structuredClone(data); } }, developmentIdentity);
  const created = await service.createTask({ title: "One success", priority: "medium" });
  await service.completeTask(created.id); await service.completeTask(created.id);
  const date = localNow(timezone).date, before = JSON.stringify(persisted);
  const result = taskAnalytics(persisted.tasks, owner, { start: date, end: date }, timezone, new Date());
  assert.equal(result.completedTotal, 1); assert.equal(result.createdTotal, 1);
  assert.equal(persisted.tasks[0].history.filter(entry => entry.kind === "completed").length, 1);
  assert.equal(JSON.stringify(persisted), before);
});

test("analytics use the same Active/Pending deadline split as task-management tabs", () => {
  const record = task("future", { dueDate: range.start, dueTime: "15:00" });
  const before = taskAnalytics([record], owner, range, timezone, new Date("2030-11-04T13:59:59.999Z"));
  const reached = taskAnalytics([record], owner, range, timezone, new Date("2030-11-04T14:00:00.000Z"));
  assert.equal(before.statuses.find(row => row.key === "active")!.count, 1);
  assert.equal(before.statuses.find(row => row.key === "pending")!.count, 0);
  assert.equal(reached.statuses.find(row => row.key === "active")!.count, 0);
  assert.equal(reached.statuses.find(row => row.key === "pending")!.count, 1);
});
