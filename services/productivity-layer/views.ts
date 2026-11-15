import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound } from "@/lib/service-error";
import { addDays, localNow, type Student, type OfficialClass } from "@/features/productivity/schedule/domain";
import { inTimezone } from "@/features/productivity/schedule/time";
import { scheduleDates } from "@/features/productivity/schedule/timetable";
import { monthRange } from "@/features/productivity/habits/domain";
import { HabitService } from "@/features/productivity/habits/service";
import { TaskService } from "@/features/productivity/tasks/service";
import { parseTaskDataset } from "@/features/productivity/tasks/storage";
import { parseHabits } from "@/features/productivity/habits/storage";
import { parseDataset } from "@/features/productivity/schedule/storage";
import { dayBounds, presetRange, rangeDays, type DateRange } from "@/features/productivity/analytics/periods";
import type { Task, TaskViewStatus } from "@/features/productivity/tasks/domain";
import type { WorkspaceInitial, WorkspaceSnapshot, ViewOptions, TaskPages } from "@/features/productivity/workspace/data";
import { saveProjectionData } from "./repository";
import { officialClasses } from "./academics";
import { publicProductivityError } from "./errors";
import { timed, diagnosticReference, diagnosticFailure } from "./diagnostics";
import type { requireProductivityUser } from "./auth";
import * as v from "./validation";

type User = Awaited<ReturnType<typeof requireProductivityUser>>;
const pageSize = 100;
const statuses: TaskViewStatus[] = ["active", "pending", "completed", "missed"];
const orders: Record<string, Prisma.Sql> = {
  newest: Prisma.sql`"createdAt" DESC, "id" ASC`, oldest: Prisma.sql`"createdAt" ASC, "id" ASC`,
  "priority-high": Prisma.sql`CASE "data"->>'priority' WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END DESC, "createdAt" ASC, "id" ASC`,
  "priority-low": Prisma.sql`CASE "data"->>'priority' WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END ASC, "createdAt" ASC, "id" ASC`,
  "due-earliest": Prisma.sql`("dueDate" IS NULL) ASC, "dueDate" ASC, ("data"->>'dueTime' IS NULL) ASC, "data"->>'dueTime' ASC, "createdAt" ASC, "id" ASC`,
  "due-latest": Prisma.sql`("dueDate" IS NULL) ASC, "dueDate" DESC, ("data"->>'dueTime' IS NULL) DESC, "data"->>'dueTime' DESC, "createdAt" ASC, "id" ASC`,
};
export async function workspaceContext(user: User) {
  const preference = await timed("context.preferences", () => prisma.productivityPreferences.findUnique({ where: { ownerId: user.id }, select: { timezone: true } }));
  const student: Student = { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), timezone: preference?.timezone || "Africa/Lagos", development: false };
  return { student, email: user.email, serverTime: new Date().toISOString() };
}
type Context = Awaited<ReturnType<typeof workspaceContext>>;
function options(value: unknown): ViewOptions {
  const input = v.object(value), status = input.status ?? "active", sort = input.sort ?? "newest", period = input.period ?? "all", page = input.page ?? 0;
  if (!["today", "tasks", "schedule", "habits"].includes(String(input.section))) throw badRequest("Choose a Productivity section.");
  if (!statuses.includes(status as TaskViewStatus) || !Object.hasOwn(orders, String(sort)) || !["all", "today", "week", "month"].includes(String(period))) throw badRequest("Choose valid task filters.");
  if (!Number.isInteger(page) || Number(page) < 0 || Number(page) > 10000) throw badRequest("Choose a valid page.");
  return { section: input.section as ViewOptions["section"], status: status as TaskViewStatus, sort: sort as ViewOptions["sort"], period: period as ViewOptions["period"], page: Number(page), history: input.section === "schedule" && (input.history === undefined ? false : v.boolean(input.history)), start: input.start === undefined ? undefined : v.date(input.start), end: input.end === undefined ? undefined : v.date(input.end), categoryId: v.optionalId(input.categoryId), taskId: v.optionalId(input.taskId), eventId: v.optionalId(input.eventId) };
}
function visibleRange(scope: ViewOptions, timezone: string): DateRange {
  const today = localNow(timezone).date, week = scheduleDates(today, "week"), month = monthRange(today);
  const range = scope.section === "today" || scope.section === "tasks" ? { start: today, end: today } : { start: scope.start || (scope.section === "habits" ? month.start : week[0]), end: scope.end || (scope.section === "habits" ? month.end : week.at(-1)!) };
  if (rangeDays(range).length > 42) throw badRequest("Load at most six weeks at a time.");
  return range;
}
async function taskPages(user: User, context: Context, scope: ViewOptions, all = false) {
  const instant = new Date(), now = localNow(context.student.timezone, instant), bounds = dayBounds(now.date, context.student.timezone);
  const period = scope.period === "week" || scope.period === "month" ? presetRange(scope.period, context.student.timezone, new Date()) : { start: now.date, end: now.date };
  const historyFilter = scope.period === "all" || !scope.period ? Prisma.empty : Prisma.sql`AND ("outcome" = 'unrecorded' OR "data"->'source'->>'kind' <> 'habit' OR "data"->'source'->>'scheduledDate' BETWEEN ${period.start} AND ${period.end})`;
  // SQL equivalent of isTaskListEligible: recorded outcomes remain historical;
  // unresolved habit plans enter the workload only on their scheduled local date.
  const [result] = await timed("read.task-pages", () => prisma.$queryRaw<{ rows: { status: TaskViewStatus; data: unknown; ordinal: number }[]; counts: Record<TaskViewStatus, number> | null; completedToday: number; openToday: number }[]>`
    WITH owned AS (
      SELECT *, CASE WHEN "outcome" <> 'unrecorded' THEN "outcome"::text
        WHEN "dueDate" IS NULL THEN 'active'
        WHEN ("data"->>'dueTime' IS NOT NULL AND "dueDate" || ("data"->>'dueTime') <= ${now.date + now.time})
          OR ("data"->>'dueTime' IS NULL AND "dueDate" < ${now.date}) THEN 'pending' ELSE 'active' END AS status
      FROM "ProductivityTask" WHERE "ownerId" = ${user.id} AND "deletedAt" IS NULL AND COALESCE("data"->>'habitWithdrawn', 'false') <> 'true'
        AND ("outcome" <> 'unrecorded' OR "data"->'source'->>'kind' <> 'habit' OR "data"->'source'->>'scheduledDate' = ${now.date}) ${historyFilter}
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY status ORDER BY ${orders[scope.sort || "newest"]}) AS ordinal FROM owned
    ), totals AS (SELECT status, COUNT(*) AS total FROM owned GROUP BY status)
    SELECT
      COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'data', "data", 'ordinal', ordinal) ORDER BY status, ordinal) FROM ranked
        WHERE ordinal > ${(scope.page || 0) * pageSize} AND ordinal <= ${((scope.page || 0) + 1) * pageSize} ${all ? Prisma.empty : Prisma.sql`AND status = ${scope.status || "active"}`}), '[]'::jsonb) AS rows,
      (SELECT jsonb_object_agg(status, total) FROM totals) AS counts,
      (SELECT COUNT(*)::int FROM owned WHERE "outcome" = 'completed' AND "data"->>'completedAt' >= ${new Date(bounds.start).toISOString()} AND "data"->>'completedAt' < ${new Date(bounds.end).toISOString()}) AS "completedToday",
      (SELECT COUNT(*)::int FROM owned WHERE "outcome" = 'unrecorded' AND ("dueDate" IS NULL OR "dueDate" <= ${now.date})) AS "openToday"
  `);
  const rows = result?.rows || [], counts = { active: 0, pending: 0, completed: 0, missed: 0, ...result?.counts };
  const tasks = parseTaskDataset(JSON.stringify({ version: 2, tasks: rows.map(row => row.data) })).tasks;
  const pages = Object.fromEntries(statuses.map(status => [status, { ids: tasks.filter((_, index) => rows[index].status === status).map(task => task.id), hasMore: counts[status] > ((scope.page || 0) + 1) * pageSize }])) as TaskPages;
  return { tasks, pages, counts, serverTime: instant.toISOString(), todayCounts: { completedTasks: result?.completedToday || 0, openTasks: result?.openToday || 0 } };
}
async function loadRange(user: User, context: Context, scope: ViewOptions, range: DateRange): Promise<WorkspaceSnapshot> {
  return timed("view.transaction", () => prisma.$transaction(async tx => {
    await timed("view.user-lock", () => tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`);
    if ((await tx.user.findUnique({ where: { id: user.id }, select: { role: true } }))?.role !== "student") throw forbidden();
    const today = localNow(context.student.timezone).date, bounds = dayBounds(today, context.student.timezone);
    const [taskRows, todayRows, habits, categories, events] = await timed("view.range-reads", () => Promise.all([
      tx.productivityTask.findMany({ where: { ownerId: user.id, dueDate: { gte: range.start, lte: range.end }, data: { path: ["source", "kind"], equals: "habit" } }, select: { data: true } }),
      tx.productivityTask.findMany({ where: { ownerId: user.id, ...(scope.taskId ? { OR: [{ id: scope.taskId }, { dueDate: today }] } : { OR: [{ dueDate: today }, { outcome: "unrecorded", OR: [{ dueDate: null }, { dueDate: { lte: today } }] }, { data: { path: ["completedAt"], gte: new Date(bounds.start).toISOString(), lt: new Date(bounds.end).toISOString() } }] }) }, select: { data: true }, orderBy: { createdAt: "desc" }, take: pageSize }),
      tx.productivityHabit.findMany({ where: { ownerId: user.id }, select: { data: true } }),
      tx.productivityCategory.findMany({ where: { ownerId: user.id }, select: { data: true } }),
      tx.productivityEvent.findMany({ where: { ownerId: user.id, OR: [{ scheduledDate: { gte: addDays(range.start, -3), lte: addDays(range.end, 3) } }, { data: { path: ["originalSlot", "date"], gte: range.start, lte: range.end } }, ...(scope.eventId ? [{ id: scope.eventId }] : [])] }, select: { data: true } }),
    ]));
    const taskMap = new Map([...taskRows, ...todayRows].map(row => [(row.data as { id: string }).id, row.data]));
    const schedule = parseDataset(JSON.stringify({ version: 1, schedules: categories.map(row => row.data), events: events.map(row => row.data) }));
    const linked = schedule.events.flatMap(event => event.source.kind === "task" && !taskMap.has(event.source.taskId) ? [event.source.taskId] : []);
    if (scope.taskId && !taskMap.has(scope.taskId)) linked.push(scope.taskId);
    if (linked.length) for (const row of await tx.productivityTask.findMany({ where: { ownerId: user.id, id: { in: linked } }, select: { data: true } })) taskMap.set((row.data as { id: string }).id, row.data);
    const before = { tasks: parseTaskDataset(JSON.stringify({ version: 2, tasks: [...taskMap.values()] })), habits: parseHabits(JSON.stringify({ version: 1, habits: habits.map(row => row.data) })), schedule };
    const data = structuredClone(before), identity = { getCurrentStudent: async () => context.student };
    const taskService = new TaskService({ load: async () => structuredClone(data.tasks), save: async value => { data.tasks = structuredClone(value); } }, identity);
    const habitService = new HabitService({ load: async () => structuredClone(data.habits), save: async value => { data.habits = structuredClone(value); } }, taskService, { load: async () => structuredClone(data.schedule), save: async value => { data.schedule = structuredClone(value); } }, identity, { getClassSessions: async () => [] });
    const occurrences = await timed("recurrence.visible-range", () => habitService.synchronize(range, { tasks: scope.section === "habits" ? "all" : "today", reconcile: "range" }));
    await timed("view.persist-projections", () => saveProjectionData(tx, user.id, before, data));
    if (scope.taskId && !data.tasks.tasks.some(task => task.id === scope.taskId)) throw notFound("This task is unavailable in your workspace.");
    if (scope.eventId && !data.schedule.events.some(event => event.id === scope.eventId)) throw notFound("This event is unavailable in your workspace.");
    const display = (event: typeof schedule.events[number]) => ({ ...event, slot: inTimezone(event.slot, context.student.timezone), backup: event.backup ? inTimezone(event.backup, context.student.timezone) : undefined });
    data.schedule.events = data.schedule.events.map(display);
    return { ...context, data, occurrences: occurrences.map(row => ({ ...row, event: row.event ? display(row.event) : undefined })), hasMore: false };
  }, { maxWait: 10000, timeout: 30000 }));
}
export async function workspaceInitial(user: User): Promise<WorkspaceInitial> {
  const context = await workspaceContext(user), today = localNow(context.student.timezone).date, month = monthRange(today), days = scheduleDates(today, "week");
  const range = { start: month.start < days[0] ? month.start : days[0], end: month.end > days.at(-1)! ? month.end : days.at(-1)! };
  const snapshot = await loadRange(user, context, { section: "habits" }, range);
  try {
    const pages = await taskPages(user, context, { section: "tasks", period: "all" }, true);
    const tasks = new Map(snapshot.data.tasks.tasks.map(task => [task.id, task]));
    for (const task of pages.tasks) tasks.set(task.id, task);
    snapshot.occurrences = snapshot.occurrences.map(row => ({ ...row, task: row.task ? tasks.get(row.task.id) || row.task : undefined }));
    snapshot.data.tasks.tasks = [...tasks.values()]; snapshot.counts = pages.counts; snapshot.todayCounts = pages.todayCounts; snapshot.serverTime = pages.serverTime;
    return { snapshot, taskPages: pages.pages, range };
  } catch (error) {
    // A malformed/history-only task page must not discard usable calendar or habit data.
    const failure = publicProductivityError(error), referenceId = diagnosticReference() || crypto.randomUUID();
    if (process.env.NODE_ENV === "development") console.error("Productivity initial task pages failed", { referenceId, code: failure.code, ...diagnosticFailure(error) });
    return { snapshot, range, taskError: `${failure.error} Reference: ${referenceId}.` };
  }
}
export async function workspaceView(user: User, value: unknown): Promise<WorkspaceSnapshot> {
  const scope = options(value), context = await workspaceContext(user), range = visibleRange(scope, context.student.timezone);
  if (scope.history) {
    const [events, categories, habits] = await Promise.all([
      prisma.productivityEvent.findMany({ where: { ownerId: user.id, ...(scope.categoryId ? { categoryId: scope.categoryId } : {}) }, select: { data: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: pageSize + 1, skip: (scope.page || 0) * pageSize }),
      prisma.productivityCategory.findMany({ where: { ownerId: user.id }, select: { data: true } }),
      prisma.productivityHabit.findMany({ where: { ownerId: user.id }, select: { data: true } }),
    ]);
    const hasMore = events.length > pageSize;
    const data = parseDataset(JSON.stringify({ version: 1, events: events.slice(0, pageSize).map(row => row.data), schedules: categories.map(row => row.data) }));
    data.events = data.events.map(event => ({ ...event, slot: inTimezone(event.slot, context.student.timezone), backup: event.backup ? inTimezone(event.backup, context.student.timezone) : undefined }));
    return { ...context, data: { schedule: data, tasks: { version: 2, tasks: [] }, habits: parseHabits(JSON.stringify({ version: 1, habits: habits.map(row => row.data) })) }, occurrences: [], hasMore };
  }
  const closed = scope.section === "tasks" && (scope.status === "completed" || scope.status === "missed");
  const snapshot = closed ? { ...context, data: { tasks: { version: 2 as const, tasks: [] as Task[] }, habits: parseHabits(JSON.stringify({ version: 1, habits: (await prisma.productivityHabit.findMany({ where: { ownerId: user.id }, select: { data: true } })).map(row => row.data) })), schedule: { version: 1 as const, schedules: [], events: [] } }, occurrences: [], hasMore: false } : await loadRange(user, context, scope, range);
  if (scope.section === "tasks" || scope.section === "today") {
    const pages = await taskPages(user, context, scope, scope.section === "today");
    if (scope.section === "tasks") {
      const selected = scope.taskId ? snapshot.data.tasks.tasks.find(task => task.id === scope.taskId) || await prisma.productivityTask.findFirst({ where: { ownerId: user.id, id: scope.taskId }, select: { data: true } }).then(row => row ? parseTaskDataset(JSON.stringify({ version: 2, tasks: [row.data] })).tasks[0] : undefined) : undefined;
      if (scope.taskId && !selected) throw notFound("This task is unavailable in your workspace.");
      snapshot.data.tasks.tasks = [...new Map([...pages.tasks, ...(selected ? [selected] : [])].map(task => [task.id, task])).values()];
      snapshot.hasMore = pages.pages[scope.status || "active"].hasMore;
    } else {
      const tasks = new Map([...snapshot.data.tasks.tasks, ...pages.tasks].map(task => [task.id, task]));
      snapshot.data.tasks.tasks = [...tasks.values()];
      snapshot.occurrences = snapshot.occurrences.map(row => ({ ...row, task: row.task ? tasks.get(row.task.id) || row.task : undefined }));
    }
    snapshot.counts = pages.counts; snapshot.todayCounts = pages.todayCounts; snapshot.serverTime = pages.serverTime;
  }
  return snapshot;
}
export async function officialRange(user: User, value: unknown) {
  const input = v.object(value), dates = rangeDays({ start: v.date(input.start), end: v.date(input.end) });
  if (dates.length > 42) throw badRequest("Load at most six weeks of official classes at a time.");
  const context = await workspaceContext(user), cache = {}, rows: OfficialClass[] = [], failedDates: string[] = []; let error = "";
  // One request-local timetable source, even when several dates are projected.
  for (const date of dates) { try { rows.push(...await officialClasses(user.id, date, context.student.timezone, cache)); } catch (failure) { failedDates.push(date); error ||= publicProductivityError(failure).error; } }
  return { rows: [...new Map(rows.map(row => [row.id, row])).values()], failedDates, error };
}
