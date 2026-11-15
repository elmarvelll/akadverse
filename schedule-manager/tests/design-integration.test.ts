import test from "node:test";
import assert from "node:assert/strict";
import { scheduleDates, placeTimetable, type TimetableEntry } from "../src/features/schedule/timetable.ts";
import { selectToday } from "../src/features/today/selectors.ts";
import { emptyDataset, type PersonalEvent } from "../src/features/schedule/domain.ts";
import type { Task } from "../src/features/tasks/domain.ts";
const event = (id: string, start: string, end: string, date = "2030-01-16"): TimetableEntry => ({ id, title: id, slot: { date, start, end, timezone: "Africa/Lagos" }, kind: "personal", category: "Academics" });
test("visible schedule ranges use real dates, Monday weeks and year boundaries", () => {
  assert.deepEqual(scheduleDates("2030-01-16", "day"), ["2030-01-16"]);
  assert.deepEqual(scheduleDates("2027-01-01", "week"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.deepEqual(scheduleDates("invalid", "week"), []);
});
test("timetable assigns independent overlap columns, shares adjacent columns and preserves source records", () => {
  const entries = [event("a", "09:00", "10:00"), event("b", "09:30", "10:30"), event("c", "10:00", "11:00"), event("d", "11:00", "12:00"), event("e", "09:00", "11:00", "2030-01-17")];
  const snapshot = structuredClone(entries), rows = placeTimetable(entries);
  assert.equal(rows.find(row => row.id === "a")!.columns, 2);
  assert.equal(rows.find(row => row.id === "b")!.column, 1);
  assert.equal(rows.find(row => row.id === "c")!.column, 0);
  assert.equal(rows.find(row => row.id === "d")!.columns, 1);
  assert.equal(rows.find(row => row.id === "e")!.columns, 1);
  assert.deepEqual(entries, snapshot);
  assert.equal(placeTimetable([...entries, entries[0]]).length, entries.length);
});
test("Today reads actual owner-scoped commitments without treating priority or elapsed time as an outcome", () => {
  const student = { id: "student", name: "Student", timezone: "Africa/Lagos", development: true };
  const task = (id: string, dueDate?: string): Task => ({ id, ownerId: student.id, title: id, source: { kind: "ordinary" }, priority: "high", dueDate, dueTime: dueDate ? "18:00" : undefined, status: "pending", createdAt: "2030-01-01T00:00:00Z", updatedAt: "2030-01-01T00:00:00Z", history: [] });
  const tasks = [task("undated"), task("yesterday", "2030-01-14"), task("today", "2030-01-15"), task("future", "2030-01-16"), { ...task("other"), ownerId: "other" }];
  const data = emptyDataset();
  const activity: PersonalEvent = { id: "high-priority-event", ownerId: student.id, title: "High priority", description: "", slot: { date: "2030-01-15", start: "18:00", end: "19:00", timezone: student.timezone }, originalSlot: { date: "2030-01-15", start: "18:00", end: "19:00", timezone: student.timezone }, priority: "high", mustComplete: false, status: "pending", source: { kind: "personal" }, createdAt: "2030-01-01T00:00:00Z", updatedAt: "2030-01-01T00:00:00Z", history: [] };
  data.events.push(activity, { ...activity, id: "explicit-focus", mustComplete: true, focusDate: "2030-01-15" });
  const snapshot = JSON.stringify({ tasks, data });
  const model = selectToday({ tasks, data, habits: [], occurrences: [], classes: [], student, instant: new Date("2030-01-15T17:00:00Z") });
  assert.deepEqual(model.openTasks.map(task => task.id), ["undated", "yesterday", "today"]);
  assert.equal(model.openTasks.find(task => task.id === "today")!.viewStatus, "pending");
  assert.equal(model.openTasks.find(task => task.id === "today")!.status, "pending");
  assert.deepEqual(model.focus.map(event => event.id), ["explicit-focus"]);
  assert.equal(model.completedTasks, 0);
  assert.equal(JSON.stringify({ tasks, data }), snapshot);
});

