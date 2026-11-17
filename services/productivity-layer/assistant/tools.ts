import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/service-error";
import { executeProductivityAs, type ProductivityExecutionHooks } from "../operations";
import { publicProductivityError } from "../errors";
import { taskTimetableEntries } from "@/features/productivity/schedule/timetable";
import type { WorkspaceSnapshot } from "@/features/productivity/workspace/data";
import { rangeDays } from "@/features/productivity/analytics/periods";
import { taskViewStatus, type Task } from "@/features/productivity/tasks/domain";
import { localNow, slotEndDate, type Dataset } from "@/features/productivity/schedule/domain";
import type { Habit } from "@/features/productivity/habits/domain";
import { validateTool } from "./schema";
import { assertTurn, json, lockOwner, type Scope } from "./store";

type Args = Record<string, unknown>;
type Command = { operation: string; args: unknown[] };
export const canonical = (value: unknown): string => JSON.stringify(sort(value));
function sort(value: unknown): unknown { if (value instanceof Date) return value.toISOString(); return Array.isArray(value) ? value.map(sort) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sort(item)])) : value; }
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const readTools = new Set(["get_context", "list_tasks", "get_task", "list_habits", "habit_occurrences", "list_schedule", "official_classes", "task_analytics", "schedule_analytics"]);
export const isReadTool = (name: string) => readTools.has(name);
function checkedRange(args: Args, max = 42) {
  const range = { start: String(args.start), end: String(args.end) };
  if (rangeDays(range).length > max) throw badRequest(`Choose at most ${max} dates for this assistant request.`);
  return range;
}
const run = (scope: Scope, operation: string, args: unknown[] = []) => executeProductivityAs(scope.sub, { operation, args });
function bounded<T>(rows: T[], limit = 50) { return { rows: rows.slice(0, limit), total: rows.length, truncated: rows.length > limit }; }
function compactTask(task: Task) { return { id: task.id, title: task.title, description: task.description?.slice(0, 2000), priority: task.priority, dueDate: task.dueDate, dueTime: task.dueTime, scheduledSlot: task.scheduledSlot, status: task.status, source: task.source, completedAt: task.completedAt, missedAt: task.missedAt }; }
export async function readTool(scope: Scope, name: string, args: Args): Promise<unknown> {
  if (name === "get_context") {
    const context = await run(scope, "context") as { student: { timezone: string }; serverTime: string };
    return { ...context, localNow: localNow(context.student.timezone) };
  }
  if (name === "get_task") { const task = await run(scope, "tasks.get", [args.task_id]) as Task; if (task.deletedAt) throw notFound(); return { ...compactTask(task), history: task.history.slice(-10) }; }
  if (name === "list_tasks") {
    const [tasks, context] = await Promise.all([run(scope, "tasks.list") as Promise<Task[]>, run(scope, "context") as Promise<{ student: { timezone: string } }>]);
    const today = localNow(context.student.timezone).date, query = String(args.query || "").toLowerCase();
    const eligible = tasks.filter(task => !task.deletedAt && task.title.toLowerCase().includes(query) && (!args.due_date || task.dueDate === args.due_date) && (!args.status || taskViewStatus(task, context.student.timezone) === args.status) && (task.source.kind !== "habit" || task.status !== "pending" || task.source.scheduledDate === today));
    return bounded(eligible.map(task => ({ ...compactTask(task), visibleStatus: taskViewStatus(task, context.student.timezone) })));
  }
  if (name === "list_habits") {
    const habits = await run(scope, "habits.list") as Habit[];
    return bounded(habits.filter(h => h.revisions.at(-1)?.name.toLowerCase().includes(String(args.query || "").toLowerCase())).map(h => ({ id: h.id, timezone: h.timezone, settings: h.revisions.at(-1) })));
  }
  if (name === "habit_occurrences") {
    const habits = await run(scope, "habits.list") as Habit[];
    if (!habits.some(h => h.id === args.habit_id)) throw notFound("This habit is unavailable.");
    const rows = await run(scope, "habits.synchronize", [checkedRange(args), { tasks: "all" }]) as { habitId: string }[];
    return bounded(rows.filter(row => row.habitId === args.habit_id));
  }
  if (name === "list_schedule") {
    const range = checkedRange(args), snapshot = await run(scope, "workspace.view", [{ section: "schedule", ...range }]) as WorkspaceSnapshot;
    const data = snapshot.data.schedule;
    const tasks = taskTimetableEntries(snapshot.data.tasks.tasks, scope.sub, snapshot.student.timezone, rangeDays(range));
    return { tasks: bounded(tasks.map(task => ({ id: task.taskId!, title: task.title, scheduledSlot: task.slot, outcome: task.outcome, priority: task.priority }))), events: bounded(data.events.filter(event => !event.archivedAt && event.slot.date <= range.end && slotEndDate(event.slot) >= range.start).map(e => ({ id: e.id, title: e.title, description: e.description.slice(0, 2000), slot: e.slot, backup: e.backup, priority: e.priority, mustComplete: e.mustComplete, subScheduleId: e.subScheduleId, source: e.source, status: e.status }))), categories: bounded(data.schedules.map(s => ({ id: s.id, name: s.name, description: s.description.slice(0, 500), academic: s.academic }))) };
  }
  if (name === "official_classes") {
    const result = await run(scope, "official.range", [checkedRange(args)]) as { rows: unknown[]; failedDates: string[]; error: string };
    return { ...bounded(result.rows), failedDates: result.failedDates, error: result.error };
  }
  if (name === "task_analytics" || name === "schedule_analytics") return run(scope, name === "task_analytics" ? "analytics.tasks" : "analytics.schedule", [checkedRange(args, 31)]);
  throw badRequest("Unsupported read tool.");
}
export async function commandFor(scope: Scope, name: string, a: Args): Promise<Command> {
  switch (name) {
    case "create_task": return { operation: "tasks.create", args: [a.input] };
    case "update_task": {
      const existing = await run(scope, "tasks.get", [a.task_id]) as Task;
      return { operation: "tasks.update", args: [a.task_id, { title: existing.title, description: existing.description, priority: existing.priority, dueDate: existing.dueDate, dueTime: existing.dueTime, scheduledSlot: existing.scheduledSlot, ...(a.changes as Args), ...((a.changes as Args).clearSchedule ? { scheduledSlot: undefined } : {}) }] };
    }
    case "complete_task": case "miss_task": case "delete_task": return { operation: ({ complete_task: "tasks.complete", miss_task: "tasks.miss", delete_task: "tasks.delete" })[name], args: [a.task_id] };
    case "save_habit": return { operation: "habits.save", args: [a.input, a.habit_id] };
    case "record_habit": return { operation: "habits.record", args: [a.habit_id, a.original_date, a.outcome] };
    case "archive_habit": return { operation: "habits.archive", args: [a.habit_id, a.archived] };
    case "replan_habit": return { operation: "habits.replan", args: [a.event_id, a.slot, a.scheduling] };
    case "save_event": return { operation: "schedule.save", args: [a.input, a.event_id, null, a.scheduling] };
    case "save_category": return { operation: "schedule.category", args: [a.name, a.description, a.category_id, a.academic] };
    case "archive_event": return { operation: "schedule.archive", args: [a.event_id, a.restore] };
    case "set_backup": return { operation: "schedule.backup", args: [a.event_id, a.slot] };
    case "miss_event": return { operation: "schedule.miss", args: [a.event_id] };
    case "set_timezone": return { operation: "preferences.save", args: [a.timezone] };
    default: throw badRequest("Unsupported mutation tool.");
  }
}
export function needsConfirmation(name: string, args: Args) {
  if (["update_task", "delete_task", "archive_habit", "replan_habit", "archive_event", "set_backup", "miss_event", "set_timezone", "record_habit"].includes(name)) return true;
  return name === "save_habit" && !!args.habit_id || name === "save_category" && !!args.category_id || name === "save_event" && (!!args.event_id || !!(args.scheduling as Args | undefined)?.allowConflicts);
}
async function targetSnapshot(tx: Prisma.TransactionClient, ownerId: string, name: string, args: Args) {
  const where = { ownerId, id: String(args.task_id || args.habit_id || args.event_id || args.category_id || "") };
  const select = { id: true, data: true, updatedAt: true } as const;
  let row: unknown;
  if (args.task_id) row = await tx.productivityTask.findFirst({ where, select });
  else if (args.habit_id) row = await tx.productivityHabit.findFirst({ where, select });
  else if (args.event_id) row = await tx.productivityEvent.findFirst({ where, select });
  else if (args.category_id) row = await tx.productivityCategory.findFirst({ where, select });
  else if (name === "set_timezone") row = await tx.productivityPreferences.findUnique({ where: { ownerId } }) || { timezone: "Africa/Lagos" };
  else row = { newRecord: true };
  if (!row) throw notFound("The proposed record is unavailable in your workspace.");
  // Include the occurrence projections: correcting the same habit day elsewhere invalidates this preview.
  if (name === "record_habit") {
    const occurrence = await tx.productivityOccurrence.findFirst({ where: { ownerId, habitId: String(args.habit_id), originalDate: String(args.original_date) }, include: { task: { select }, event: { select } } });
    return { record: row, occurrence };
  }
  return row;
}
export function resultProjection(name: string, args: Args, result: unknown) {
  if (name === "delete_task") return { saved: true, deleted: true };
  if (["record_habit", "archive_habit"].includes(name)) return { saved: true, habit: { id: args.habit_id }, applied: args };
  if (name === "replan_habit") return { saved: true, event: { id: args.event_id, slot: args.slot } };
  if (result && typeof result === "object" && "events" in result && "schedules" in result) {
    const data = result as Dataset;
    if (name === "save_category") return { saved: true, category: data.schedules.find(row => row.id === args.category_id || !args.category_id && row.name.toLowerCase() === String(args.name).trim().toLowerCase()) };
    const event = args.event_id ? data.events.find(row => row.id === args.event_id) : data.events.at(-1);
    return { saved: true, event: event && { id: event.id, title: event.title, slot: event.slot, backup: event.backup, status: event.status, archivedAt: event.archivedAt } };
  }
  if (result && typeof result === "object" && "source" in result && "history" in result && !("slot" in result)) return { saved: true, task: compactTask(result as Task) };
  if (result && typeof result === "object" && "revisions" in result) { const habit = result as Habit; return { saved: true, habit: { id: habit.id, settings: habit.revisions.at(-1) } }; }
  return { saved: true, result: result ?? null, applied: args };
}
export async function executeTool(scope: Scope, step: number, name: string, rawArgs: unknown) {
  const args = validateTool(name, rawArgs);
  if (!Number.isInteger(step) || step < 0 || step >= 10) throw badRequest("The assistant tool limit has been reached.");
  const execution = await prisma.$transaction(async tx => {
    await lockOwner(tx, scope.sub); await assertTurn(tx, scope);
    const existing = await tx.productivityAIToolExecution.findUnique({ where: { messageId_step: { messageId: scope.turn, step } } });
    if (existing) {
      if (existing.toolName !== name || canonical(existing.arguments) !== canonical(args)) throw conflict("This tool step has already been used for different arguments.");
      return existing;
    }
    return tx.productivityAIToolExecution.create({ data: { ownerId: scope.sub, conversationId: scope.cid, messageId: scope.turn, step, toolName: name, arguments: json(args), operationKey: `ai:${scope.turn}:${step}` } });
  });
  if (["completed", "failed", "cancelled", "awaiting_confirmation"].includes(execution.status)) return { status: execution.status, result: execution.result, error: execution.error, execution_id: execution.id };
  if (isReadTool(name)) {
    try {
      const result = await readTool(scope, name, args);
      await prisma.$transaction(async tx => { await lockOwner(tx, scope.sub); await assertTurn(tx, scope); await tx.productivityAIToolExecution.update({ where: { id: execution.id }, data: { status: "completed", result: json(result), completedAt: new Date() } }); });
      return { status: "completed", result, execution_id: execution.id };
    } catch (error) { return recordFailure(execution.id, error); }
  }
  let confirmation = needsConfirmation(name, args);
  if (name === "complete_task" || name === "miss_task") {
    const task = await run(scope, "tasks.get", [args.task_id]) as Task;
    confirmation ||= task.source.kind === "habit" && task.status !== "pending";
  }
  if (confirmation) {
    return prisma.$transaction(async tx => {
      await lockOwner(tx, scope.sub); await assertTurn(tx, scope);
      const current = await tx.productivityAIToolExecution.findUniqueOrThrow({ where: { id: execution.id } });
      if (current.status === "awaiting_confirmation") return { status: current.status, execution_id: current.id };
      const pending = await tx.productivityAIPendingAction.findFirst({ where: { ownerId: scope.sub, conversationId: scope.cid, status: "pending", expiresAt: { gt: new Date() } } });
      if (pending) throw conflict("Confirm or cancel the existing proposed action before making another change.");
      const snapshot = await targetSnapshot(tx, scope.sub, name, args);
      const preview = { tool: name, arguments: args, current: snapshot };
      const action = await tx.productivityAIPendingAction.create({ data: { ownerId: scope.sub, conversationId: scope.cid, executionId: execution.id, preview: json(preview), fingerprint: digest(snapshot), expiresAt: new Date(Date.now() + 600000) } });
      await tx.productivityAIToolExecution.update({ where: { id: execution.id }, data: { status: "awaiting_confirmation" } });
      return { status: "awaiting_confirmation", pending_action_id: action.id, preview, execution_id: execution.id };
    });
  }
  return performMutation(scope, execution, args);
}
type Execution = Awaited<ReturnType<typeof prisma.productivityAIToolExecution.findUniqueOrThrow>>;
export async function performMutation(scope: Scope, execution: Execution, args: Args, pendingId?: string) {
  try {
    const command = await commandFor(scope, execution.toolName, args);
    const hooks: ProductivityExecutionHooks = {
      async authorize(tx, replay) {
        await assertTurn(tx, scope);
        const current = await tx.productivityAIToolExecution.findFirst({ where: { id: execution.id, ownerId: scope.sub, conversationId: scope.cid } });
        if (!current || ["cancelled", "failed"].includes(current.status)) throw conflict("This operation is no longer executable.");
        if (pendingId) {
          const pending = await tx.productivityAIPendingAction.findFirst({ where: { id: pendingId, executionId: execution.id, ownerId: scope.sub, conversationId: scope.cid } });
          if (!pending || !replay && (pending.status !== "pending" || pending.expiresAt.getTime() <= Date.now())) throw conflict("This confirmation expired or has already been resolved.");
          if (!replay && pending.fingerprint !== digest(await targetSnapshot(tx, scope.sub, execution.toolName, args))) throw conflict("The record changed after this proposal. Cancel it and ask for a new proposal.");
        } else {
          if (!replay && ["complete_task", "miss_task"].includes(execution.toolName)) {
            const target = await tx.productivityTask.findFirst({ where: { id: String(args.task_id), ownerId: scope.sub }, select: { data: true } });
            const task = target?.data as unknown as Task | undefined;
            if (task?.source.kind === "habit" && task.status !== "pending") throw conflict("This habit already has an outcome. Request a confirmed correction or review it in Habit Tracker.");
          }
          const pending = await tx.productivityAIPendingAction.findFirst({ where: { ownerId: scope.sub, conversationId: scope.cid, status: "pending", expiresAt: { gt: new Date() } } });
          if (pending) throw conflict("Confirm or cancel the proposed action before making another change.");
        }
      },
      async commit(tx, result) {
        await tx.productivityAIToolExecution.update({ where: { id: execution.id }, data: { status: "completed", result: json(resultProjection(execution.toolName, args, result)), error: Prisma.DbNull, completedAt: new Date() } });
        if (pendingId) await tx.productivityAIPendingAction.update({ where: { id: pendingId }, data: { status: "confirmed", resolvedAt: new Date() } });
      },
    };
    await executeProductivityAs(scope.sub, { ...command, requestId: execution.operationKey }, hooks);
    const saved = await prisma.productivityAIToolExecution.findUniqueOrThrow({ where: { id: execution.id } });
    return { status: "completed", result: saved.result, execution_id: saved.id };
  } catch (error) { return recordFailure(execution.id, error); }
}
async function recordFailure(id: string, error: unknown) {
  const failure = publicProductivityError(error);
  // Database/transport failures can occur after commit acknowledgement was lost.
  // Keep those retryable with the SAME operationKey; never mint a second mutation.
  const status = failure.status >= 500 ? "unknown" : "failed";
  const saved = await prisma.productivityAIToolExecution.findUnique({ where: { id } });
  if (saved?.status === "completed") return { status: "completed", result: saved.result, execution_id: id };
  await prisma.productivityAIToolExecution.updateMany({ where: { id, status: { not: "completed" } }, data: { status, error: json({ code: failure.code, error: failure.error }), completedAt: new Date() } });
  return { status, error: { code: failure.code, error: failure.error }, execution_id: id };
}
