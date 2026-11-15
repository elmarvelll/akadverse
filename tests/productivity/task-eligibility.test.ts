import { it } from "node:test";
import assert from "node:assert/strict";
import { taskAnalytics } from "../../src/features/productivity/analytics/calculations";
import { isTaskListEligible, taskViewStatus, type Task } from "../../src/features/productivity/tasks/domain";
import { queryTasks, taskStatusCounts } from "../../src/features/productivity/tasks/queries";
import { todoTasks } from "../../src/features/productivity/tasks/todo";
import type { Habit } from "../../src/features/productivity/habits/domain";
import { selectToday } from "../../src/features/productivity/today/selectors";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskAnalyticsView, ScheduleAnalyticsView } from "../../src/features/productivity/analytics/AnalyticsView";
import { scheduleAnalytics } from "../../src/features/productivity/analytics/calculations";

const zone = "Africa/Lagos", range = { start: "2030-01-01", end: "2030-01-31" }, now = new Date("2030-01-15T10:00:00Z");
function occurrence(date: string, overrides: Partial<Task> = {}): Task {
  return { id: date, ownerId: "student", title: "Daily task", priority: "medium", status: "pending", source: { kind: "habit", habitId: "habit", occurrenceId: `habit:${date}`, habitName: "Daily", scheduledDate: date }, dueDate: date, dueTime: "12:00", createdAt: "2029-12-01T00:00:00Z", updatedAt: "2030-01-01T00:00:00Z", history: [], ...overrides };
}
const habit: Habit = { id: "habit", ownerId: "student", timezone: zone, createdDate: range.start, createdAt: "2030-01-01T00:00:00Z", revisions: [{ name: "Daily", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "12:00", effectiveDate: range.start, at: "2030-01-01T00:00:00Z", archived: false }] };
const month = () => Array.from({ length: 31 }, (_, index) => occurrence(`2030-01-${String(index + 1).padStart(2, "0")}`));
it("31 generated occurrences contribute exactly one current task across lists, counts, charts and Today", () => {
  const tasks = month(), before = structuredClone(tasks);
  const counts = taskStatusCounts(tasks, zone, now), analytics = taskAnalytics(tasks, "student", range, zone, now);
  assert.deepEqual(counts, { active: 1, pending: 0, completed: 0, missed: 0 });
  assert.equal(queryTasks(tasks, { timezone: zone, instant: now }).length, 1);
  assert.deepEqual(analytics.workload, counts); assert.equal(analytics.statuses.find(row => row.key === "active")?.count, 1);
  assert.equal(analytics.createdTotal, 1, "habit cohort uses scheduled date, not its generation timestamp outside the range");
  assert.equal(todoTasks(tasks, [habit], zone, now).length, 1);
  const today = selectToday({ tasks, habits: [habit], data: { version: 1, schedules: [], events: [] }, occurrences: [], classes: [], student: { id: "student", name: "Test", timezone: zone, development: false }, instant: now });
  assert.equal(today.openTasks.length, 1); assert.deepEqual(tasks, before, "future plans must not be deleted or changed");
});
it("deadline arrival changes today's task to Pending, never Missed; untimed habits stay Active today", () => {
  const tasks = month(), deadline = new Date("2030-01-15T11:00:00Z");
  assert.deepEqual(taskStatusCounts(tasks, zone, deadline), { active: 0, pending: 1, completed: 0, missed: 0 });
  assert.equal(taskViewStatus(tasks[14], zone, deadline), "pending");
  assert.equal(taskStatusCounts([occurrence("2030-01-15", { dueTime: undefined })], zone, new Date("2030-01-15T22:59:00Z")).active, 1);
});
it("midnight and timezone changes select the correct scheduled date without using creation date", () => {
  const tasks = month(), midnight = new Date("2030-01-15T23:00:00Z");
  assert.equal(queryTasks(tasks, { timezone: zone, instant: midnight })[0].id, "2030-01-16");
  assert.equal(queryTasks(tasks, { timezone: "America/New_York", instant: midnight, status: "pending" })[0].id, "2030-01-15");
  assert.equal(isTaskListEligible(tasks[14], zone, midnight), false);
});
it("completion/correction update current counts while keeping historical completions, misses and elapsed deadlines", () => {
  const tasks = month(); tasks[14] = { ...tasks[14], status: "completed", completedAt: now.toISOString() };
  tasks[3] = { ...tasks[3], status: "missed", missedAt: "2030-01-04T15:00:00Z" };
  let result = taskAnalytics(tasks, "student", range, zone, now);
  assert.equal(result.workload.active, 0); assert.equal(result.completedTotal, 1); assert.equal(result.workload.missed, 1);
  assert.equal(queryTasks(tasks, { status: "missed", timezone: zone, instant: now })[0].id, "2030-01-04");
  assert.ok(result.deadline.find(row => row.key === "overdue")!.count > 0, "past unresolved occurrences retain historical elapsed-deadline analytics");
  tasks[14] = occurrence("2030-01-15"); result = taskAnalytics(tasks, "student", range, zone, now);
  assert.equal(result.workload.active, 1); assert.equal(result.completedTotal, 0);
});
it("ordinary future deadlines stay Active; withdrawn/deleted habit projections are excluded", () => {
  const future = occurrence("2030-01-31", { id: "ordinary", source: { kind: "ordinary" } });
  const tasks = [future, occurrence("2030-01-15", { habitWithdrawn: true }), occurrence("2030-01-15", { deletedAt: now.toISOString() })];
  assert.equal(taskStatusCounts(tasks, zone, now).active, 1); assert.equal(taskAnalytics(tasks, "student", range, zone, now).workload.active, 1);
});
it("selected weekdays, archived settings and owner checks preserve the existing To-do scope", () => {
  const weekday = new Date("2030-01-15T12:00:00Z").getUTCDay();
  const unscheduled = { ...habit, revisions: [{ ...habit.revisions[0], frequency: "weekdays" as const, weekdays: [(weekday + 1) % 7] }] };
  assert.equal(todoTasks([occurrence("2030-01-15")], [unscheduled], zone, now).length, 0);
  assert.equal(todoTasks([occurrence("2030-01-15")], [{ ...habit, revisions: [{ ...habit.revisions[0], archived: true }] }], zone, now).length, 0);
  assert.equal(taskAnalytics(month(), "another-student", range, zone, now).workload.active, 0);
});
it("keeps analytics values and chart legends visible while calculation prose is collapsed", () => {
  const result = taskAnalytics(month(), "student", range, zone, now);
  const taskMarkup = renderToStaticMarkup(createElement(TaskAnalyticsView, { result }));
  assert.match(taskMarkup, /Current workload/); assert.match(taskMarkup, /Active tasks<\/dt><dd>1/);
  assert.match(taskMarkup, /role="img"/); assert.match(taskMarkup, /Tasks completed by day/);
  assert.match(taskMarkup, /<details><summary>How it/); assert.doesNotMatch(taskMarkup, /<details open/);
  const empty = scheduleAnalytics({ version: 1, schedules: [], events: [] }, [], "student", range, zone);
  const scheduleMarkup = renderToStaticMarkup(createElement(ScheduleAnalyticsView, { result: empty }));
  assert.match(scheduleMarkup, /No planned time in this period/); assert.match(scheduleMarkup, /planned hours/);
  assert.match(scheduleMarkup, /<details><summary>How it/);
});
