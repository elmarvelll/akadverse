import type { Prisma } from "@prisma/client";
import { badRequest } from "@/lib/service-error";
import { parseTaskDataset } from "@/features/productivity/tasks/storage";
import { parseHabits } from "@/features/productivity/habits/storage";
import { parseDataset } from "@/features/productivity/schedule/storage";
import { eventOutcome } from "@/features/productivity/habits/domain";
import type { ProductivityData } from "./types";
import { timed } from "./diagnostics";

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

export async function loadData(tx: Prisma.TransactionClient, ownerId: string, create?: "task" | "habit" | "event"): Promise<ProductivityData> {
  // Independent creates need no historical graph. Their new sources and all
  // identifiers are still produced by the domain services and persisted atomically.
  if (create === "task" || create === "habit") return { tasks: { version: 2, tasks: [] }, habits: { version: 1, habits: [] }, schedule: { version: 1, schedules: [], events: [] } };
  if (create === "event") {
    const [events, categories] = await Promise.all([
      timed("data.events", () => tx.productivityEvent.findMany({ where: { ownerId }, orderBy: { id: "asc" } })),
      timed("data.categories", () => tx.productivityCategory.findMany({ where: { ownerId }, orderBy: { id: "asc" } })),
    ]);
    const schedule = parseDataset(JSON.stringify({ version: 1, schedules: categories.map(row => row.data), events: events.map(row => row.data) }));
    // Retain every existing calendar conflict and required source relationship,
    // but do not load unrelated task histories just to create a personal event.
    const taskIds = schedule.events.flatMap(row => row.source.kind === "task" ? [row.source.taskId] : []);
    const taskRows = taskIds.length ? await timed("data.linked-tasks", () => tx.productivityTask.findMany({ where: { ownerId, id: { in: taskIds } }, orderBy: { id: "asc" } })) : [];
    const tasks = parseTaskDataset(JSON.stringify({ version: 2, tasks: taskRows.map(row => row.data) }));
    const habitIds = [...new Set([...schedule.events, ...tasks.tasks].flatMap(row => row.source.kind === "habit" ? [row.source.habitId] : []))];
    const habitRows = habitIds.length ? await timed("data.linked-habits", () => tx.productivityHabit.findMany({ where: { ownerId, id: { in: habitIds } }, orderBy: { id: "asc" } })) : [];
    return { tasks, schedule, habits: parseHabits(JSON.stringify({ version: 1, habits: habitRows.map(row => row.data) })) };
  }
  const [tasks, habits, categories, events] = await Promise.all([
    timed("data.tasks", () => tx.productivityTask.findMany({ where: { ownerId }, orderBy: { id: "asc" } })),
    timed("data.habits", () => tx.productivityHabit.findMany({ where: { ownerId }, orderBy: { id: "asc" } })),
    timed("data.categories", () => tx.productivityCategory.findMany({ where: { ownerId }, orderBy: { id: "asc" } })),
    timed("data.events", () => tx.productivityEvent.findMany({ where: { ownerId }, orderBy: { id: "asc" } })),
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

/** Bounded view initialization: batch projections; keep explicit mutation rules unchanged. */
export async function saveProjectionData(tx: Prisma.TransactionClient, ownerId: string, before: ProductivityData, after: ProductivityData) {
  const taskIds = new Set(before.tasks.tasks.map(row => row.id)), eventIds = new Set(before.schedule.events.map(row => row.id));
  const tasks = after.tasks.tasks.filter(row => !taskIds.has(row.id)), events = after.schedule.events.filter(row => !eventIds.has(row.id));
  validateGraph(after, ownerId);
  const keys = new Map<string, { ownerId: string; habitId: string; originalDate: string }>();
  for (const task of tasks) if (task.source.kind === "habit") keys.set(task.source.occurrenceId, { ownerId, habitId: task.source.habitId, originalDate: task.source.scheduledDate });
  for (const event of events) if (event.source.kind === "habit") keys.set(event.source.occurrenceId, { ownerId, habitId: event.source.habitId, originalDate: event.originalSlot.date });
  const entries = [...keys.values()];
  if (entries.length) await tx.productivityOccurrence.createMany({ data: entries, skipDuplicates: true });
  const dates = entries.map(row => row.originalDate).sort();
  const occurrences = entries.length ? await tx.productivityOccurrence.findMany({ where: { ownerId, habitId: { in: [...new Set(entries.map(row => row.habitId))] }, originalDate: { gte: dates[0], lte: dates.at(-1) } }, select: { id: true, habitId: true, originalDate: true } }) : [];
  const identities = new Map(occurrences.map(row => [JSON.stringify([row.habitId, row.originalDate]), row.id]));
  const occurrence = (habitId: string, date: string) => { const id = identities.get(JSON.stringify([habitId, date])); if (!id) throw badRequest("The generated habit occurrence could not be persisted."); return id; };
  if (tasks.length) await tx.productivityTask.createMany({ data: tasks.map(row => ({ id: row.id, ownerId, data: json(row), dueDate: row.dueDate ?? null, outcome: row.status === "pending" ? "unrecorded" : row.status, deletedAt: row.deletedAt ? new Date(row.deletedAt) : null, createdAt: new Date(row.createdAt), occurrenceId: row.source.kind === "habit" ? occurrence(row.source.habitId, row.source.scheduledDate) : null })) });
  if (events.length) await tx.productivityEvent.createMany({ data: events.map(row => ({ id: row.id, ownerId, data: json(row), scheduledDate: row.slot.date, outcome: eventOutcome(row), categoryId: row.subScheduleId ?? null, linkedTaskId: row.source.kind === "task" ? row.source.taskId : null, archivedAt: row.archivedAt ? new Date(row.archivedAt) : null, createdAt: new Date(row.createdAt), occurrenceId: row.source.kind === "habit" ? occurrence(row.source.habitId, row.originalSlot.date) : null })) });
  const oldTasks = new Map(before.tasks.tasks.map(row => [row.id, row])), oldEvents = new Map(before.schedule.events.map(row => [row.id, row]));
  const changedTasks = after.tasks.tasks.filter(row => oldTasks.has(row.id) && JSON.stringify(row) !== JSON.stringify(oldTasks.get(row.id)));
  const changedEvents = after.schedule.events.filter(row => oldEvents.has(row.id) && JSON.stringify(row) !== JSON.stringify(oldEvents.get(row.id)));
  for (const row of changedTasks) {
    const old = oldTasks.get(row.id)!;
    if (row.source.kind !== "habit" || old.source.kind !== "habit" || row.source.habitId !== old.source.habitId || row.source.occurrenceId !== old.source.occurrenceId || row.source.scheduledDate !== old.source.scheduledDate) throw badRequest("View preparation cannot change a task's source identity.");
  }
  for (const row of changedEvents) {
    const old = oldEvents.get(row.id)!;
    if (row.source.kind !== "habit" || old.source.kind !== "habit" || row.source.habitId !== old.source.habitId || row.source.occurrenceId !== old.source.occurrenceId || row.originalSlot.date !== old.originalSlot.date) throw badRequest("View preparation cannot change an event's source identity.");
  }
  // Reconciliation can touch many future instances after a timezone change.
  // Two bounded updates avoid one network round trip per existing instance.
  if (changedTasks.length) {
    const rows = changedTasks.map(row => ({ id: row.id, data: row, dueDate: row.dueDate ?? null, outcome: row.status === "pending" ? "unrecorded" : row.status, deletedAt: row.deletedAt ?? null }));
    const updated = await tx.$executeRaw`UPDATE "ProductivityTask" AS target SET "data" = source."data", "dueDate" = source."dueDate", "outcome" = source."outcome"::"ProductivityOutcome", "deletedAt" = source."deletedAt"::timestamp, "updatedAt" = timezone('UTC', CURRENT_TIMESTAMP) FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS source("id" text, "data" jsonb, "dueDate" text, "outcome" text, "deletedAt" text) WHERE target."id" = source."id" AND target."ownerId" = ${ownerId}`;
    if (updated !== changedTasks.length) throw badRequest("Some generated tasks changed while preparing this view. Retry loading.");
  }
  if (changedEvents.length) {
    const rows = changedEvents.map(row => ({ id: row.id, data: row, scheduledDate: row.slot.date, outcome: eventOutcome(row), archivedAt: row.archivedAt ?? null }));
    const updated = await tx.$executeRaw`UPDATE "ProductivityEvent" AS target SET "data" = source."data", "scheduledDate" = source."scheduledDate", "outcome" = source."outcome"::"ProductivityOutcome", "archivedAt" = source."archivedAt"::timestamp, "updatedAt" = timezone('UTC', CURRENT_TIMESTAMP) FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS source("id" text, "data" jsonb, "scheduledDate" text, "outcome" text, "archivedAt" text) WHERE target."id" = source."id" AND target."ownerId" = ${ownerId}`;
    if (updated !== changedEvents.length) throw badRequest("Some generated events changed while preparing this view. Retry loading.");
  }
}
