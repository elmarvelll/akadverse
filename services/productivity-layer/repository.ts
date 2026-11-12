import type { Prisma } from "@prisma/client";
import { badRequest } from "@/lib/service-error";
import { parseTaskDataset } from "@/features/productivity/tasks/storage";
import { parseHabits } from "@/features/productivity/habits/storage";
import { parseDataset } from "@/features/productivity/schedule/storage";
import { eventOutcome } from "@/features/productivity/habits/domain";
import type { ProductivityData } from "./types";

export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export function validateGraph(data: ProductivityData, ownerId: string) {
  parseTaskDataset(JSON.stringify(data.tasks));
  parseHabits(JSON.stringify(data.habits));
  parseDataset(JSON.stringify(data.schedule));
  const habits = new Set(data.habits.habits.map(h => h.id));
  const categories = new Set(data.schedule.schedules.map(c => c.id));
  const tasks = new Set(data.tasks.tasks.map(t => t.id));
  const occurrenceKinds = new Set<string>(), recorded = new Set<string>(), eligible = new Set<string>();
  function occurrence(habitId: string, date: string, kind: string, hasOutcome: boolean, active: boolean) {
    if (!habits.has(habitId)) throw badRequest("The source habit is unavailable.");
    const key = JSON.stringify([habitId, date]);
    if (occurrenceKinds.has(key + kind)) throw badRequest("Duplicate habit occurrence requires review.");
    occurrenceKinds.add(key + kind);
    if (active && eligible.has(key)) throw badRequest("An occurrence cannot have two active projections.");
    if (active) eligible.add(key);
    if (hasOutcome && recorded.has(key)) throw badRequest("An occurrence cannot have two recorded outcomes.");
    if (hasOutcome) recorded.add(key);
  }
  for (const row of [...data.habits.habits, ...data.tasks.tasks, ...data.schedule.events, ...data.schedule.schedules]) {
    if (row.ownerId !== ownerId) throw badRequest("Invalid record ownership.");
  }
  for (const task of data.tasks.tasks) if (task.source.kind === "habit") {
    occurrence(task.source.habitId, task.source.scheduledDate, "task", task.status !== "pending", !task.habitWithdrawn && !task.deletedAt);
  }
  for (const event of data.schedule.events) {
    if (event.subScheduleId && !categories.has(event.subScheduleId)) throw badRequest("The category is unavailable.");
    if (event.source.kind === "task" && !tasks.has(event.source.taskId)) throw badRequest("The linked task is unavailable.");
    if (event.source.kind === "habit") occurrence(event.source.habitId, event.originalSlot.date, "event", eventOutcome(event) !== "unrecorded", !event.archivedAt);
  }
}

export async function loadData(tx: Prisma.TransactionClient, ownerId: string): Promise<ProductivityData> {
  const [tasks, habits, categories, events] = await Promise.all([
    tx.productivityTask.findMany({ where: { ownerId }, orderBy: { id: "asc" } }),
    tx.productivityHabit.findMany({ where: { ownerId }, orderBy: { id: "asc" } }),
    tx.productivityCategory.findMany({ where: { ownerId }, orderBy: { id: "asc" } }),
    tx.productivityEvent.findMany({ where: { ownerId }, orderBy: { id: "asc" } }),
  ]);
  return {
    tasks: parseTaskDataset(JSON.stringify({ version: 2, tasks: tasks.map(r => r.data) })),
    habits: parseHabits(JSON.stringify({ version: 1, habits: habits.map(r => r.data) })),
    schedule: parseDataset(JSON.stringify({ version: 1, schedules: categories.map(r => r.data), events: events.map(r => r.data) })),
  };
}

// Called only inside the user-locked transaction, after running domain services.
// No snapshot replacement endpoint is exposed to the browser.
export async function saveData(tx: Prisma.TransactionClient, ownerId: string, before: ProductivityData, after: ProductivityData) {
  validateGraph(after, ownerId);
  const changed = <T extends { id: string }>(old: T[], rows: T[]) => {
    const originals = new Map(old.map(r => [r.id, JSON.stringify(r)]));
    return rows.filter(r => originals.get(r.id) !== JSON.stringify(r));
  };
  for (const row of changed(before.habits.habits, after.habits.habits)) {
    const data = { data: json(row), createdDate: row.createdDate, createdAt: new Date(row.createdAt) };
    await tx.productivityHabit.upsert({ where: { id_ownerId: { id: row.id, ownerId } }, create: { ...data, id: row.id, ownerId }, update: data });
  }
  for (const row of changed(before.schedule.schedules, after.schedule.schedules)) {
    const data = { data: json(row), normalizedName: row.name.trim().toLowerCase(), createdAt: new Date(row.createdAt) };
    await tx.productivityCategory.upsert({ where: { id_ownerId: { id: row.id, ownerId } }, create: { ...data, id: row.id, ownerId }, update: data });
  }
  const occurrence = async (habitId: string, originalDate: string) => (await tx.productivityOccurrence.upsert({
    where: { habitId_originalDate: { habitId, originalDate } },
    create: { ownerId, habitId, originalDate }, update: {},
  })).id;
  for (const row of changed(before.tasks.tasks, after.tasks.tasks)) {
    const data = { data: json(row), dueDate: row.dueDate ?? null, outcome: row.status === "pending" ? "unrecorded" as const : row.status,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null, createdAt: new Date(row.createdAt),
      occurrenceId: row.source.kind === "habit" ? await occurrence(row.source.habitId, row.source.scheduledDate) : null };
    await tx.productivityTask.upsert({ where: { id_ownerId: { id: row.id, ownerId } }, create: { ...data, id: row.id, ownerId }, update: data });
  }
  for (const row of changed(before.schedule.events, after.schedule.events)) {
    const data = { data: json(row), scheduledDate: row.slot.date, outcome: eventOutcome(row), categoryId: row.subScheduleId ?? null,
      linkedTaskId: row.source.kind === "task" ? row.source.taskId : null,
      archivedAt: row.archivedAt ? new Date(row.archivedAt) : null, createdAt: new Date(row.createdAt),
      occurrenceId: row.source.kind === "habit" ? await occurrence(row.source.habitId, row.originalSlot.date) : null };
    await tx.productivityEvent.upsert({ where: { id_ownerId: { id: row.id, ownerId } }, create: { ...data, id: row.id, ownerId }, update: data });
  }
}
