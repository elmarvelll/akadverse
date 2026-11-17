import { it } from "node:test";
import assert from "node:assert/strict";
import { TaskService } from "@/features/productivity/tasks/service";
import { emptyTasks, validateTaskInput, type TaskDataset, type TaskInput } from "@/features/productivity/tasks/domain";
import { parseTaskDataset } from "@/features/productivity/tasks/storage";
import { taskTimetableEntries, placeTimetable } from "@/features/productivity/schedule/timetable";
const student = { id: "owner-A", name: "Test", timezone: "Africa/Lagos", development: false };
const allocated: TaskInput = { title: "Study EIE 342", priority: "high", dueDate: "2030-01-16", scheduledSlot: { date: "2030-01-15", start: "09:00", end: "10:30", timezone: "Africa/Lagos" } };
it("projects the same authoritative task through edit, completion and deletion without duplicate events", async () => {
  let data: TaskDataset = emptyTasks();
  const service = new TaskService({ load: async () => structuredClone(data), save: async value => { data = parseTaskDataset(JSON.stringify(value)); } }, { getCurrentStudent: async () => student });
  const task = await service.createTask(allocated);
  assert.equal(task.dueDate, "2030-01-16");
  let entries = taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-15"]);
  assert.equal(entries.length, 1); assert.equal(entries[0].id, `task:${task.id}`);
  assert.equal(placeTimetable(entries)[0].endMinute - placeTimetable(entries)[0].startMinute, 90);
  await service.updateTask(task.id, { ...allocated, scheduledSlot: { ...allocated.scheduledSlot!, date: "2030-01-16", start: "11:00", end: "12:00" } });
  assert.equal(taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-15"]).length, 0);
  assert.equal(taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-16"])[0].slot.start, "11:00");
  assert.equal(data.tasks[0].history[1].snapshot.scheduledSlot?.start, "09:00");
  await service.completeTask(task.id);
  entries = taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-16"]);
  assert.equal(entries[0].outcome, "completed");
  await service.deleteTask(task.id);
  assert.equal(taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-16"]).length, 0);
  assert.equal(data.tasks.length, 1, "soft deletion preserves the source audit");
});
it("keeps deadline-only work outside the time grid, excludes another owner, and preserves overnight timezone geometry", async () => {
  let data = emptyTasks();
  const service = new TaskService({ load: async () => structuredClone(data), save: async value => { data = value; } }, { getCurrentStudent: async () => student });
  await service.createTask({ title: "Deadline only", priority: "low", dueDate: "2030-01-15", dueTime: "10:00" });
  await service.createTask({ ...allocated, scheduledSlot: { ...allocated.scheduledSlot!, start: "23:00", end: "01:00" } });
  assert.equal(taskTimetableEntries(data.tasks, "other-owner", student.timezone, ["2030-01-15"]).length, 0);
  const entries = taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-15", "2030-01-16"]);
  const segments = placeTimetable(entries);
  assert.equal(entries.length, 1); assert.deepEqual(segments.map(row => row.displayDate), ["2030-01-15", "2030-01-16"]);
  assert.equal(taskTimetableEntries(data.tasks, student.id, "UTC", ["2030-01-15"])[0].slot.start, "22:00");
});
it("rejects malformed, zero-length and nonexistent local task allocations", () => {
  for (const slot of [{ ...allocated.scheduledSlot!, end: "09:00" }, { ...allocated.scheduledSlot!, date: "2030-02-30" }, { ...allocated.scheduledSlot!, timezone: "Invalid/Zone" }, { date: "2030-01-15", start: "09:00", end: "10:00" }, { date: "2026-03-08", start: "02:30", end: "03:30", timezone: "America/New_York" }]) {
    assert.throws(() => validateTaskInput({ ...allocated, scheduledSlot: slot as TaskInput["scheduledSlot"] }));
  }
});
it("lays overlapping tasks side by side without overwriting either source", async () => {
  let data = emptyTasks();
  const service = new TaskService({ load: async () => structuredClone(data), save: async value => { data = value; } }, { getCurrentStudent: async () => student });
  await service.createTask(allocated); await service.createTask({ ...allocated, title: "Assignment", scheduledSlot: { ...allocated.scheduledSlot!, start: "10:00", end: "11:00" } });
  const placed = placeTimetable(taskTimetableEntries(data.tasks, student.id, student.timezone, ["2030-01-15"]));
  assert.equal(placed.length, 2); assert.equal(placed[0].columns, 2); assert.notEqual(placed[0].column, placed[1].column);
});

it("checks task commitments during manual and smart event scheduling without copying tasks into event storage", async () => {
  const { ScheduleService, emptyDataset, SlotConflictError } = await import("@/features/productivity/schedule/domain");
  let data = emptyDataset();
  const service = new ScheduleService({ load: async () => structuredClone(data), save: async value => { data = value; } }, { getCurrentStudent: async () => student }, {
    getClassSessions: async () => [],
    getExtraCommitments: () => [{ id: "task:source-task", title: allocated.title, slot: allocated.scheduledSlot! }],
  }, () => new Date("2030-01-15T06:00:00Z"));
  await service.saveSubSchedule("Study", "");
  const input = { title: "Meeting", description: "Discuss project", priority: "medium" as const, mustComplete: false, subScheduleId: data.schedules[0].id, slot: { ...allocated.scheduledSlot!, start: "10:00", end: "11:00" } };
  await assert.rejects(service.saveEvent(input), error => error instanceof SlotConflictError && error.conflicts[0].id === "task:source-task");
  assert.equal(data.events.length, 0);
  await service.saveEvent(input, undefined, undefined, { mode: "manual", allowConflicts: true });
  assert.equal(data.events.length, 1, "only the real event is saved");
  const { findSmartSlot } = await import("@/features/productivity/schedule/domain");
  const free = findSmartSlot("2030-01-15", student.timezone, { mode: "smart", earliest: "09:00", latest: "12:00", durationMinutes: 30 }, [], [], { date: "2030-01-15", time: "07:00" }, undefined, [{ id: "task:source-task", title: allocated.title, slot: allocated.scheduledSlot! }]);
  assert.equal(free?.start, "10:30");
});

it("Today counts a source task once when a legacy linked event also exists, and hides deleted sources", async () => {
  const { ScheduleService, emptyDataset } = await import("@/features/productivity/schedule/domain");
  const { selectToday } = await import("@/features/productivity/today/selectors");
  let tasks = emptyTasks(), data = emptyDataset();
  const taskService = new TaskService({ load: async () => structuredClone(tasks), save: async value => { tasks = value; } }, { getCurrentStudent: async () => student });
  const task = await taskService.createTask(allocated);
  const calendar = new ScheduleService({ load: async () => structuredClone(data), save: async value => { data = value; } }, { getCurrentStudent: async () => student }, { getClassSessions: async () => [] });
  await calendar.saveSubSchedule("Study", "");
  await calendar.saveEvent({ title: "Legacy reading", description: "Imported task plan", priority: "medium", mustComplete: false, subScheduleId: data.schedules[0].id, slot: allocated.scheduledSlot! }, undefined, { kind: "task", taskId: task.id });
  const model = () => selectToday({ tasks: tasks.tasks, data, habits: [], occurrences: [], classes: [], student, instant: new Date("2030-01-15T10:00:00Z") });
  assert.equal(model().events.length, 0);
  assert.equal(model().scheduledTasks.length, 1);
  await taskService.deleteTask(task.id);
  assert.equal(model().events.length + model().scheduledTasks.length, 0);
});
