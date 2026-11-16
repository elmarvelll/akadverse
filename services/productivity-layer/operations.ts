import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound, ServiceError } from "@/lib/service-error";
import { TaskService } from "@/features/productivity/tasks/service";
import { HabitService } from "@/features/productivity/habits/service";
import { ScheduleService, localNow, type Student, type PersonalEvent } from "@/features/productivity/schedule/domain";
import { taskAnalytics, scheduleAnalytics } from "@/features/productivity/analytics/calculations";
import { rangeDays } from "@/features/productivity/analytics/periods";
import { inTimezone } from "@/features/productivity/schedule/time";
import { requireProductivityUser, requireProductivityActor } from "./auth";
import { officialClasses } from "./academics";
import { loadData, saveData, json } from "./repository";
import { importLocalData } from "./import";
import * as v from "./validation";
import type { ProductivityCommand, ProductivityContext } from "./types";
import { ProductivityError } from "@/features/productivity/errors";
import { diagnosticElapsed, timed } from "./diagnostics";
import { parseTaskDataset } from "@/features/productivity/tasks/storage";
import { parseHabits } from "@/features/productivity/habits/storage";
import { parseDataset } from "@/features/productivity/schedule/storage";
import { workspaceInitial, workspaceView, officialRange } from "./views";

const reads = new Set(["context", "tasks.list", "tasks.get", "tasks.history", "habits.list", "schedule.load", "schedule.history", "official.classes", "analytics.tasks", "analytics.schedule"]);
const mutations = new Set(["tasks.create", "tasks.update", "tasks.delete", "tasks.complete", "tasks.miss", "habits.save", "habits.archive", "habits.synchronize", "habits.record", "habits.replan", "schedule.save", "schedule.category", "schedule.archive", "schedule.backup", "schedule.miss", "preferences.save", "import"]);

export async function executeProductivity(input: ProductivityCommand, expectedUserId?: string | null) {
  // Resolve identity on EVERY operation, including reads, analytics and imports.
  const user = await requireProductivityUser(expectedUserId);
  return executeForUser(user, input);
}

export interface ProductivityExecutionHooks {
  authorize(tx: Prisma.TransactionClient, replay: boolean): Promise<void>;
  commit(tx: Prisma.TransactionClient, result: unknown): Promise<void>;
}

/** Only authenticated server adapters may call this. Never accepts an actor from model arguments. */
export async function executeProductivityAs(ownerId: string, input: ProductivityCommand, hooks?: ProductivityExecutionHooks) {
  return executeForUser(await requireProductivityActor(ownerId), input, hooks);
}

async function executeForUser(user: Awaited<ReturnType<typeof requireProductivityActor>>, input: ProductivityCommand, hooks?: ProductivityExecutionHooks) {
  if (input.operation === "workspace.initial") return workspaceInitial(user);
  if (input.operation === "workspace.view") return workspaceView(user, input.args[0]);
  if (input.operation === "official.range") return officialRange(user, input.args[0]);
  // Account metadata is an owner-scoped read, not a graph mutation. It must
  // not queue behind recurrence/event writes or load unrelated histories.
  if (input.operation === "context" || input.operation === "official.classes") {
    const preference = await timed("context.preferences", () => prisma.productivityPreferences.findUnique({ where: { ownerId: user.id }, select: { timezone: true } }));
    const student: Student = { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), timezone: preference?.timezone || "Africa/Lagos", development: false };
    if (input.operation === "context") return { student, email: user.email, serverTime: new Date().toISOString() };
    // The separate academic database must not hold the Core user-row lock
    // while its connection is unavailable. It still uses the same owner ID.
    return timed("official.classes", () => officialClasses(user.id, v.date(input.args[0]), student.timezone, {}));
  }
  // Pure reads do not acquire the mutation lock or initialize occurrences.
  // Keep the same parsers, return values and authenticated owner boundaries.
  if (["tasks.list", "tasks.get", "tasks.history"].includes(input.operation)) {
    const rows = await timed("read.tasks", () => prisma.productivityTask.findMany({ where: { ownerId: user.id, ...(input.operation === "tasks.get" ? { id: v.text(input.args[0]) } : {}) }, select: { data: true }, orderBy: { id: "asc" } }));
    const tasks = parseTaskDataset(JSON.stringify({ version: 2, tasks: rows.map(row => row.data) })).tasks;
    if (input.operation === "tasks.get") { if (!tasks[0]) throw notFound("This task is unavailable in your workspace."); return tasks[0]; }
    return input.operation === "tasks.history" ? tasks.filter(task => task.status !== "pending" && !task.deletedAt) : tasks;
  }
  if (input.operation === "habits.list") {
    const rows = await timed("read.habits", () => prisma.productivityHabit.findMany({ where: { ownerId: user.id }, select: { data: true }, orderBy: { id: "asc" } }));
    return parseHabits(JSON.stringify({ version: 1, habits: rows.map(row => row.data) })).habits;
  }
  if (input.operation === "schedule.load" || input.operation === "schedule.history") {
    const history = input.operation === "schedule.history";
    const [events, categories, preference] = await Promise.all([
      timed("read.events", () => prisma.productivityEvent.findMany({ where: { ownerId: user.id, ...(history ? { id: v.text(input.args[0]) } : {}) }, select: { data: true }, orderBy: { id: "asc" } })),
      history ? [] : timed("read.categories", () => prisma.productivityCategory.findMany({ where: { ownerId: user.id }, select: { data: true }, orderBy: { id: "asc" } })),
      history ? null : timed("context.preferences", () => prisma.productivityPreferences.findUnique({ where: { ownerId: user.id }, select: { timezone: true } })),
    ]);
    const data = parseDataset(JSON.stringify({ version: 1, events: events.map(row => row.data), schedules: categories.map(row => row.data) }));
    if (history) { if (!data.events[0]) throw notFound("This event is unavailable in your workspace."); return data.events[0].history; }
    const timezone = preference?.timezone || "Africa/Lagos";
    return { ...data, events: data.events.map(event => ({ ...event, slot: inTimezone(event.slot, timezone), backup: event.backup ? inTimezone(event.backup, timezone) : undefined })) };
  }
  if (!reads.has(input.operation) && !mutations.has(input.operation)) throw badRequest("Unknown productivity operation.");
  const requestHash = createHash("sha256").update(JSON.stringify([input.operation, input.args])).digest("hex");
  const receipt = mutations.has(input.operation) && input.operation !== "habits.synchronize";
  if (receipt && (!input.requestId || !/^[a-zA-Z0-9:-]{8,200}$/.test(input.requestId))) throw badRequest("A request identifier is required.");
    const transactionStarted = performance.now();
    return await timed("transaction.total", () => prisma.$transaction(async tx => {
      diagnosticElapsed("transaction.acquire", transactionStarted);
      // Per-user row locking covers all modules and app instances, including
      // multi-repository habit operations and simultaneous import/generation.
      await timed("transaction.user-lock", () => tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`);
      const currentUser = await timed("transaction.role", () => tx.user.findUnique({ where: { id: user.id }, select: { role: true } }));
      if (currentUser?.role !== "student") throw forbidden();
      if (receipt) {
        const saved = await timed("receipt.lookup", () => tx.productivityRequest.findUnique({ where: { ownerId_key: { ownerId: user.id, key: input.requestId! } } }));
        if (saved) {
          if (saved.requestHash !== requestHash) throw conflict("This request identifier was used for different input.");
          const result = (saved.result as { value: unknown }).value;
          await hooks?.authorize(tx, true);
          await hooks?.commit(tx, result);
          return result;
        }
      }
      await hooks?.authorize(tx, false);
      const preference = await timed("context.preferences", () => tx.productivityPreferences.findUnique({ where: { ownerId: user.id } }));
      const student: Student = { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), timezone: preference?.timezone || "Africa/Lagos", development: false };
      const create = input.operation === "tasks.create" ? "task" : input.operation === "habits.save" && !input.args[1] ? "habit" : input.operation === "schedule.save" && !input.args[1] ? "event" : undefined;
      const before = await timed("data.load", () => loadData(tx, user.id, create)), data = structuredClone(before);
      const identity = { async getCurrentStudent() { return student; } };
      const academicCache = {};
      const academics = { getClassSessions: (_: string, date: string) => timed("academic.conflict-check", () => officialClasses(user.id, date, student.timezone, academicCache)) };
      const displayEvent = (e: PersonalEvent) => ({ ...e, slot: inTimezone(e.slot, student.timezone), backup: e.backup ? inTimezone(e.backup, student.timezone) : undefined });
      const taskRepo = { async load() { return structuredClone(data.tasks); }, async save(value: typeof data.tasks) { data.tasks = structuredClone(value); } };
      const habitRepo = { async load() { return structuredClone(data.habits); }, async save(value: typeof data.habits) { data.habits = structuredClone(value); } };
      const scheduleRepo = { async load() { return structuredClone(data.schedule); }, async save(value: typeof data.schedule) { data.schedule = structuredClone(value); } };
      const tasks = new TaskService(taskRepo, identity);
      const habits = new HabitService(habitRepo, tasks, scheduleRepo, identity, academics);
      const schedule = new ScheduleService(scheduleRepo, identity, academics);
      const args = input.args, today = localNow(student.timezone).date;
      function range(value: unknown) { const o = v.object(value), r = { start: v.date(o.start), end: v.date(o.end) }; rangeDays(r); return r; }
      function ownEvent(value: unknown, personal = true) {
        const event = data.schedule.events.find(e => e.id === v.text(value));
        if (!event || personal && event.source.kind !== "personal") throw notFound("This event is unavailable in your workspace. Reload the schedule and select an existing event.");
        return event;
      }
      let result: unknown;
      const domainStarted = performance.now();
      try {
        switch (input.operation) {
          case "context": result = { student, email: user.email, serverTime: new Date().toISOString() }; break;
          case "tasks.list": result = await tasks.listTasks(); break;
          case "tasks.get": result = await tasks.getTask(v.text(args[0])); break;
          case "tasks.history": result = await tasks.getHistory(); break;
          case "tasks.create": result = await tasks.createTask(v.taskInput(args[0])); break;
          case "tasks.update": result = await tasks.updateTask(v.text(args[0]), v.taskInput(args[1])); break;
          case "tasks.delete": result = await tasks.deleteTask(v.text(args[0])); break;
          case "tasks.complete": case "tasks.miss": {
            const task = await tasks.getTask(v.text(args[0]));
            if (task.source.kind === "habit") {
              if (task.source.scheduledDate !== today) throw badRequest("Review past occurrences in Habit Tracker. Future occurrences cannot receive outcomes.");
              await habits.record(task.source.habitId, task.source.scheduledDate, input.operation === "tasks.complete" ? "completed" : "missed");
              result = await tasks.getTask(task.id);
            } else result = input.operation === "tasks.complete" ? await tasks.completeTask(task.id) : await tasks.markTaskMissed(task.id);
            break;
          }
          case "habits.list": result = await habits.list(); break;
          case "habits.save": {
            const saved = await habits.save(v.habitInput(args[0], student.timezone), v.optionalId(args[1]));
            const savedOccurrences = await timed("recurrence.generate", () => habits.synchronize({ start: today, end: today }, { tasks: "today", reconcile: create === "habit" ? "range" : "all" }));
            result = { ...saved, savedOccurrences: savedOccurrences.filter(row => row.habitId === saved.id) }; break;
          }
          case "habits.archive":
            result = await habits.archive(v.text(args[0]), v.boolean(args[1]));
            await habits.synchronize({ start: today, end: today }, { tasks: "today" }); break;
          case "habits.synchronize": {
            const mode = args[1] == null ? undefined : v.object(args[1]).tasks;
            if (mode !== undefined && mode !== "today" && mode !== "all") throw badRequest("Invalid occurrence scope.");
            result = (await timed("recurrence.generate", () => habits.synchronize(range(args[0]), { tasks: mode as "today" | "all" | undefined }))).map(o => ({ ...o, event: o.event ? displayEvent(o.event) : undefined })); break;
          }
          case "habits.record":
            if (!["completed", "missed", "pending"].includes(String(args[2]))) throw badRequest("Invalid outcome.");
            if (!data.habits.habits.some(h => h.id === v.text(args[0]))) throw notFound("This habit is unavailable in your workspace. Reload Habit Tracker and select an existing habit.");
            result = await habits.record(v.text(args[0]), v.date(args[1]), args[2] as "completed" | "missed" | "pending"); break;
          case "habits.replan": {
            const event = ownEvent(args[0], false);
            if (event.source.kind !== "habit") throw notFound();
            result = await habits.replan(event, v.slot(args[1]), v.scheduling(args[2])); break;
          }
          case "schedule.load": result = data.schedule; break;
          case "schedule.history": result = ownEvent(args[0], false).history; break;
          case "schedule.save": {
            const eventId = v.optionalId(args[1]); if (eventId) ownEvent(eventId);
            // Sources/ownership/outcomes are server-derived. No arbitrary
            // browser habit/task linkage is accepted by personal event writes.
            if (args[2] && v.object(args[2]).kind !== "personal") throw badRequest("Manage linked items through their owning module.");
            result = await schedule.saveEvent(v.eventInput(args[0]), eventId, { kind: "personal" }, v.scheduling(args[3])); break;
          }
          case "schedule.category": {
            const description = args[1]; if (typeof description !== "string" || description.length > 10000) throw badRequest("Invalid category description.");
            result = await schedule.saveSubSchedule(v.text(args[0], 60, "Category name"), description, v.optionalId(args[2]), args[3] == null ? false : v.boolean(args[3])); break;
          }
          case "schedule.archive": ownEvent(args[0]); result = await schedule.archiveEvent(v.text(args[0]), args[1] == null ? false : v.boolean(args[1])); break;
          case "schedule.backup": ownEvent(args[0]); result = await schedule.setBackup(v.text(args[0]), args[1] ? v.slot(args[1]) : undefined); break;
          case "schedule.miss": ownEvent(args[0]); result = await schedule.recordMissedAttempt(v.text(args[0])); break;
          case "official.classes": result = await academics.getClassSessions(user.id, v.date(args[0])); break;
          case "analytics.tasks": result = taskAnalytics(data.tasks.tasks, user.id, range(args[0]), student.timezone, new Date()); break;
          case "analytics.schedule": {
            const r = range(args[0]), classes = [];
            for (const day of rangeDays(r)) classes.push(...await academics.getClassSessions(user.id, day));
            result = scheduleAnalytics(data.schedule, classes, user.id, r, student.timezone); break;
          }
          case "preferences.save": {
            const zone = v.timezone(args[0]);
            await tx.productivityPreferences.upsert({ where: { ownerId: user.id }, create: { ownerId: user.id, timezone: zone }, update: { timezone: zone } });
            result = { ...student, timezone: zone }; break;
          }
          case "import": result = importLocalData(data, args[0], v.boolean(args[1]), student); break;
        }
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        // Only intentional domain messages are safe to return. Academic reads
        // also run here and may throw database errors containing credentials.
        if (error instanceof ProductivityError) {
          if (/not found/i.test(error.message)) throw notFound("This record is unavailable in your workspace. Reload and select an existing record.");
          if (error.name === "SlotConflictError") throw error;
          throw badRequest(error.message);
        }
        throw error;
      } finally { diagnosticElapsed("domain.operation", domainStarted); }
      await timed("data.validate-save", () => saveData(tx, user.id, before, data));
      if (result && typeof result === "object" && "events" in result && "schedules" in result) result = { ...result, events: (result.events as PersonalEvent[]).map(displayEvent) };
      if (receipt) await timed("receipt.persist", () => tx.productivityRequest.create({ data: { ownerId: user.id, key: input.requestId!, requestHash, result: json({ value: result ?? null }) } }));
      await hooks?.commit(tx, result ?? null);
      return result ?? null;
    }, { maxWait: 10000, timeout: 30000 }));
}

export type { ProductivityContext, PersonalEvent };
