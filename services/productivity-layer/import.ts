import { createHash } from "node:crypto";
import { badRequest } from "@/lib/service-error";
import { parseTaskDataset } from "@/features/productivity/tasks/storage";
import { parseHabits } from "@/features/productivity/habits/storage";
import { parseDataset } from "@/features/productivity/schedule/storage";
import { localNow, type Student } from "@/features/productivity/schedule/domain";
import { eventOutcome } from "@/features/productivity/habits/domain";
import { object } from "./validation";
import { validateGraph } from "./repository";
import type { ProductivityData } from "./types";

export function importLocalData(target: ProductivityData, value: unknown, confirmed: boolean, student: Student) {
  if (!confirmed) throw badRequest("Confirm importing these records into your signed-in account.");
  const input = object(value);
  const source: ProductivityData = {
    tasks: parseTaskDataset(JSON.stringify(input.tasks ?? { version: 2, tasks: [] })),
    habits: parseHabits(JSON.stringify(input.habits ?? { version: 1, habits: [] })),
    schedule: parseDataset(JSON.stringify(input.schedule ?? { version: 1, events: [], schedules: [] })),
  };
  const records = [...source.tasks.tasks, ...source.habits.habits, ...source.schedule.events, ...source.schedule.schedules];
  if (records.length > 10000) throw badRequest("Import at most 10,000 records at a time.");
  const owners = new Set(records.map(r => r.ownerId));
  if (owners.size > 1) throw badRequest("This export contains multiple local identities. Export one identity for review first.");
  if (owners.size) validateGraph(source, [...owners][0]);
  const local = localNow(student.timezone);
  for (const task of source.tasks.tasks) if (task.source.kind === "habit" && task.status !== "pending" && task.source.scheduledDate > local.date) throw badRequest("Future recorded outcomes require review before import.");
  for (const event of source.schedule.events) if (event.source.kind === "habit" && eventOutcome(event) !== "unrecorded" && event.originalSlot.date > local.date) throw badRequest("Future recorded outcomes require review before import.");
  // Namespaced, deterministic IDs preserve the graph and make changed exports
  // safe to re-import without overwriting records subsequently edited online.
  const id = (kind: string, sourceId: string) => "import:" + createHash("sha256").update(JSON.stringify([student.id, kind, sourceId])).digest("hex");
  for (const habit of source.habits.habits) { habit.id = id("habit", habit.id); habit.ownerId = student.id; }
  for (const category of source.schedule.schedules) { category.id = id("category", category.id); category.ownerId = student.id; }
  for (const task of source.tasks.tasks) {
    task.id = id("task", task.id); task.ownerId = student.id;
    if (task.source.kind === "habit") { task.source.habitId = id("habit", task.source.habitId); task.source.occurrenceId = `${task.source.habitId}:${task.source.scheduledDate}`; }
  }
  for (const event of source.schedule.events) {
    event.id = id("event", event.id); event.ownerId = student.id;
    if (event.subScheduleId) event.subScheduleId = id("category", event.subScheduleId);
    if (event.source.kind === "habit") { event.source.habitId = id("habit", event.source.habitId); event.source.occurrenceId = `${event.source.habitId}:${event.originalSlot.date}`; }
    if (event.source.kind === "task") event.source.taskId = id("task", event.source.taskId);
  }
  const counts = { tasks: 0, habits: 0, events: 0, categories: 0, skipped: 0 };
  function append<T extends { id: string }>(to: T[], from: T[], kind: "tasks" | "habits" | "events" | "categories") {
    const ids = new Set(to.map(r => r.id));
    for (const row of from) { if (ids.has(row.id)) counts.skipped++; else { to.push(row); ids.add(row.id); counts[kind]++; } }
  }
  append(target.habits.habits, source.habits.habits, "habits");
  append(target.schedule.schedules, source.schedule.schedules, "categories");
  append(target.tasks.tasks, source.tasks.tasks, "tasks");
  append(target.schedule.events, source.schedule.events, "events");
  validateGraph(target, student.id);
  return counts;
}
