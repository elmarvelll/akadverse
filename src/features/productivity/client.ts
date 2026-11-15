"use client";
import { SlotConflictError, type Student, type Dataset, type EventInput, type EventSource, type SchedulingOptions, type Slot, type OfficialClass, type PersonalEvent } from "./schedule/domain";
import type { Task, TaskInput } from "./tasks/domain";
import type { Habit, HabitInput, Occurrence } from "./habits/domain";
import { rangeDays, type DateRange } from "./analytics/periods";
import { ProductivityError, productivityAction } from "./errors";
import { ProductivityReadCache } from "./read-cache";
import { localNow } from "./schedule/domain";
import type { ViewOptions, WorkspaceSnapshot, WorkspaceInitial } from "./workspace/data";
import { monthRange } from "./habits/domain";
import { scheduleDates, slotTouchesDates } from "./schedule/timetable";
import { applySavedSchedule } from "./workspace/schedule-cache";
import { saveNotifications, saveSuccessMessage } from "./notifications";
import { applyCreatedTask, applyCreatedHabit, type SavedHabit } from "./workspace/create-cache";
import { saveTiming } from "./save-timing";

let account = "";
let accountEpoch = 0;
let setupFailure: ProductivityError | undefined;
const retries = new Map<string, string>();
let cache = new ProductivityReadCache("");
let contextStudent: Student | undefined;
let initial: Promise<WorkspaceInitial> | undefined;
const officialCoverage: { key: string; range: DateRange }[] = [];
const officialPending = new Map<string, { range: DateRange; promise: Promise<unknown> }>();
export function setProductivityAccount(id: string, nextCache?: ProductivityReadCache) { if (id !== account) { saveNotifications.clear(); cache.clear(); cache = nextCache || new ProductivityReadCache(id); account = id; accountEpoch++; retries.clear(); setupFailure = undefined; contextStudent = undefined; initial = undefined; officialCoverage.length = 0; officialPending.clear(); } }
const setupCodes = new Set(["DATABASE_SCHEMA_MISSING", "DATABASE_CONFIGURATION", "DATABASE_ACCESS_DENIED", "DATABASE_NOT_FOUND"]);
const readOperations = new Set(["context", "workspace.initial", "workspace.view", "official.range", "tasks.list", "tasks.get", "tasks.history", "habits.list", "schedule.load", "schedule.history", "official.classes", "analytics.tasks", "analytics.schedule", "habits.synchronize"]);
function stable(value: unknown): unknown { return Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([,item]) => item !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,stable(item)])) : value; }
function keyFor(operation: string, args: unknown[]) { return JSON.stringify([account, operation, stable(args), localNow(contextStudent?.timezone || "Africa/Lagos").date, contextStudent?.timezone || "pending"]); }
function freshness(serverTime?: string) { const at = serverTime ? Date.parse(serverTime) : Date.now(); return Number.isFinite(at) ? Math.max(0, Math.min(60000, at + 60000 - Date.now())) : 0; }
function readTags(operation: string, args: unknown[]) { return operation === "workspace.initial" ? ["initial"] : operation === "workspace.view" ? [String((args[0] as ViewOptions).section)] : operation === "context" ? ["context"] : operation.startsWith("official.") ? ["official"] : (operation.startsWith("tasks.") || operation === "analytics.tasks") ? ["tasks"] : operation.startsWith("habits.") ? ["habits"] : ["schedule"]; }
function normalizeView(options: ViewOptions): ViewOptions {
  const today = contextStudent && localNow(contextStudent.timezone).date;
  const range = !options.start && today && options.section === "habits" ? monthRange(today) : !options.start && today && options.section === "schedule" ? (() => { const days = scheduleDates(today, "week"); return { start: days[0], end: days.at(-1)! }; })() : {};
  return { status: "active", sort: "newest", period: "all", page: 0, history: false, ...range, ...options };
}
export function peekWorkspaceView(options: ViewOptions) { return account ? cache.peek<WorkspaceSnapshot>(keyFor("workspace.view", [normalizeView(options)])) : undefined; }
export function isWorkspaceViewFresh(options: ViewOptions) { return !!account && !!cache.fresh(keyFor("workspace.view", [normalizeView(options)])); }
export async function loadWorkspaceView(options: ViewOptions) {
  const expected = account, epoch = accountEpoch;
  try { await prepareWorkspace(); } catch { /* A failed batch can be retried as a local section read. */ }
  if (expected !== account || epoch !== accountEpoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
  return rpc<WorkspaceSnapshot>("workspace.view", [normalizeView(options)]);
}
function rememberContext(context: { student: Student; email?: string; serverTime?: string }) {
  const previous = contextStudent;
  contextStudent = context.student;
  cache.seed(keyFor("context", []), context, ["context"], freshness(context.serverTime));
  if (previous?.id !== context.student.id || previous?.timezone !== context.student.timezone || previous?.name !== context.student.name) window.dispatchEvent(new Event("productivity:context-ready"));
}
function seedView(options: ViewOptions, snapshot: WorkspaceSnapshot) { cache.seed(keyFor("workspace.view", [normalizeView(options)]), snapshot, [options.section], freshness(snapshot.serverTime)); }
export function prepareWorkspace(force = false): Promise<WorkspaceInitial> {
  if (force) { cache.invalidate(["initial"]); initial = undefined; }
  if (!initial) {
    const expected = account, epoch = accountEpoch, stamp = cache.stamp(["tasks", "today", "habits", "schedule"]);
    initial = rpc<WorkspaceInitial>("workspace.initial").then(result => {
      if (expected !== account || epoch !== accountEpoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
      // A mutation racing the initial batch must not seed an older snapshot.
      if (stamp !== cache.stamp(["tasks", "today", "habits", "schedule"])) { initial = undefined; return prepareWorkspace(true); }
      const snapshot = result.snapshot;
      if (snapshot.student.id !== expected) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
      rememberContext({ student: snapshot.student, email: snapshot.email, serverTime: snapshot.serverTime });
      const date = localNow(snapshot.student.timezone).date, month = monthRange(date);
      seedView({ section: "today" }, snapshot);
      seedView({ section: "schedule" }, snapshot);
      seedView({ section: "habits", ...month }, { ...snapshot, occurrences: snapshot.occurrences.filter(item => item.date >= month.start && item.date <= month.end) });
      if (result.taskPages) for (const status of ["active", "pending", "completed", "missed"] as const) {
        const page = result.taskPages[status], ids = new Set(page.ids);
        seedView({ section: "tasks", status }, { ...snapshot, data: { ...snapshot.data, tasks: { version: 2, tasks: snapshot.data.tasks.tasks.filter(task => ids.has(task.id)) } }, hasMore: page.hasMore });
      }
      return result;
    });
  }
  return initial;
}
type OfficialRange = { rows: OfficialClass[]; failedDates: string[]; error: string };
export async function prepareOfficialRange(range: DateRange) { return rpc<OfficialRange>("official.range", [range]); }
export function peekStudent() { return contextStudent; }
export function invalidateWorkspace(tags: string[]) { cache.invalidate(tags); }
export async function rpc<T>(operation: string, args: unknown[] = []): Promise<T> {
  if (!account) throw new ProductivityError("Sign in to open your workspace.", "SIGN_IN_REQUIRED");
  if (operation === "habits.synchronize") return request<T>(operation, args);
  if (!readOperations.has(operation)) return saveNotifications.run(JSON.stringify([accountEpoch, operation, stable(args)]), () => request<T>(operation, args), saveSuccessMessage(operation));
  if (operation === "official.range") {
    const requested = args[0] as DateRange;
    const slice = (value: OfficialRange) => { const dates = rangeDays(requested), failedDates = value.failedDates.filter(date => dates.includes(date)); return { rows: value.rows.filter(row => slotTouchesDates(row.slot, dates)), failedDates, error: failedDates.length ? value.error : "" } as T; };
    for (const coverage of officialCoverage) {
      if (coverage.range.start > requested.start || coverage.range.end < requested.end) continue;
      const value = cache.fresh<OfficialRange>(coverage.key);
      if (value) return slice(value);
    }
    for (const pending of officialPending.values()) if (pending.range.start <= requested.start && pending.range.end >= requested.end) {
      const expected = account, epoch = accountEpoch, stamp = cache.stamp(["official"]);
      const value = await pending.promise as OfficialRange;
      if (expected !== account || epoch !== accountEpoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
      if (stamp !== cache.stamp(["official"])) return rpc<T>(operation, args);
      return slice(value);
    }
  }
  const currentCache = cache, expected = account, epoch = accountEpoch, tags = readTags(operation, args), stamp = currentCache.stamp(tags);
  const key = keyFor(operation, args);
  const promise = currentCache.read(key, () => {
    if (account !== expected || accountEpoch !== epoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
    return request<T>(operation, args);
  }, tags);
  if (operation === "official.range") officialPending.set(key, { range: args[0] as DateRange, promise });
  let result: T;
  try { result = await promise; }
  catch (error) { if (account !== expected || accountEpoch !== epoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED"); throw error; }
  finally { if (officialPending.get(key)?.promise === promise) officialPending.delete(key); }
  if (account !== expected || accountEpoch !== epoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
  if (currentCache.stamp(tags) !== stamp) return rpc<T>(operation, args);
  if (operation === "workspace.view" || operation === "context") {
    const context = result as { student: Student; email?: string; serverTime?: string };
    if (context.student.id !== expected) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED");
    rememberContext({ student: context.student, email: context.email, serverTime: context.serverTime });
    currentCache.seed(keyFor(operation, args), result, readTags(operation, args), freshness(context.serverTime));
    if (operation === "workspace.view") currentCache.seed(keyFor(operation, [normalizeView(args[0] as ViewOptions)]), result, tags, freshness(context.serverTime));
  }
  if (operation === "official.range") { const key = keyFor(operation, args); if (!officialCoverage.some(item => item.key === key)) officialCoverage.push({ key, range: args[0] as DateRange }); }
  return result;
}
const publicCodes = new Set(["SLOT_CONFLICT", "INVALID_INPUT", "SIGN_IN_REQUIRED", "ACCESS_DENIED", "RECORD_NOT_FOUND", "RECORD_CONFLICT", "REQUEST_FAILED", "DATABASE_SCHEMA_MISSING", "DATABASE_ACCESS_DENIED", "DATABASE_UNAVAILABLE", "DATABASE_NOT_FOUND", "DATABASE_TIMEOUT", "DATABASE_CONFIGURATION", "DUPLICATE_RECORD", "RELATED_RECORD_MISSING", "CONCURRENT_UPDATE", "UNEXPECTED_ERROR"]);
function statusMessage(status: number) {
  if (status === 401) return "Your session has expired. Sign in again to continue.";
  if (status === 403) return "This account or request does not have access to the student workspace. Reload and sign in with a student account.";
  if (status === 404) return "The requested record or workspace endpoint was not found. Reload the workspace.";
  if (status === 409) return "These records conflict with an existing change. Reload and review the current records.";
  if (status === 413) return "The request is too large. Choose an import smaller than 2 MB.";
  if (status === 429) return "Too many requests were sent. Wait a moment before trying again.";
  if ([502, 503, 504].includes(status)) return "The workspace server is unavailable or did not respond in time. Try again shortly.";
  return status >= 500 ? "The workspace server could not complete the request. Retry the same action; if it continues, contact the developer." : "The server rejected this request. Review the entered values and try again.";
}
async function request<T>(operation: string, args: unknown[] = []): Promise<T> {
  const expected = account;
  const expectedEpoch = accountEpoch;
  if (!expected) throw new ProductivityError("Sign in to open your workspace.", "SIGN_IN_REQUIRED");
  // Missing schema/credentials cannot recover through automatic refreshes.
  // A full reload after setup, or switching accounts, starts a fresh attempt.
  if (setupFailure) throw setupFailure;
  const assertAccount = () => { if (account !== expected || accountEpoch !== expectedEpoch) throw new ProductivityError("Your account changed. Reload your workspace.", "ACCOUNT_CHANGED"); };
  const key = JSON.stringify([expected, operation, args]);
  const requestId = readOperations.has(operation) ? undefined : retries.get(key) || crypto.randomUUID();
  if (requestId) retries.set(key, requestId);
  let response: Response;
  let body: Record<string, unknown> | undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const networkStarted = performance.now();
  try {
    response = await fetch("/api/productivity", { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Productivity-User": expected },
      body: JSON.stringify({ operation, args, requestId }), signal: controller.signal });
    try {
      const value: unknown = await response.json();
      if (value && typeof value === "object" && !Array.isArray(value)) body = value as Record<string, unknown>;
    } catch { /* Use the HTTP status or an invalid-response message below. */ }
  } catch {
    assertAccount();
    const reason = controller.signal.aborted ? "The request timed out." : "The connection to the workspace server failed. Check your internet connection.";
    throw new ProductivityError(`Could not ${productivityAction(operation)}. ${reason} ${requestId ? "The save could not be confirmed. Retry the same action to check or finish it without creating a duplicate." : "Please retry loading."}`, controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR");
  } finally { clearTimeout(timeout); if (requestId) saveTiming(operation, "network-and-response-body", networkStarted); }
  assertAccount();
  const code = typeof body?.code === "string" && publicCodes.has(body.code) ? body.code : "HTTP_ERROR";
  const referenceId = typeof body?.referenceId === "string" && /^[a-f0-9-]{36}$/i.test(body.referenceId) ? body.referenceId : undefined;
  const message = code !== "HTTP_ERROR" && typeof body?.error === "string" && body.error.length <= 2000 ? body.error : statusMessage(response.status);
  if (response.status === 401 || response.status === 403) {
    retries.clear();
    const error = new ProductivityError(message, response.status === 401 ? "SIGN_IN_REQUIRED" : "ACCESS_DENIED", referenceId);
    window.dispatchEvent(new CustomEvent("productivity:session-ended", { detail: error }));
    throw error;
  }
  if (!response.ok) {
    if (response.status < 500 && ![408, 429].includes(response.status)) retries.delete(key);
    if (code === "SLOT_CONFLICT" && Array.isArray(body?.conflicts) && body.conflicts.every(value => value && typeof value === "object" && typeof value.id === "string" && typeof value.title === "string" && value.slot && typeof value.slot.date === "string" && typeof value.slot.start === "string" && typeof value.slot.end === "string" && typeof value.slot.timezone === "string")) throw new SlotConflictError(body.conflicts, referenceId);
    const error = new ProductivityError(`Could not ${productivityAction(operation)}. ${message}`, code, referenceId);
    if (setupCodes.has(code) && body?.dependency !== "official-timetable") {
      if (!setupFailure) {
        setupFailure = error;
        window.dispatchEvent(new CustomEvent("productivity:setup-required", { detail: error }));
      }
    }
    throw error;
  }
  if (!body || !Object.hasOwn(body, "result")) {
    throw new ProductivityError(`Could not ${productivityAction(operation)}. The server returned an incomplete or unreadable response. ${requestId ? "The save could not be confirmed. Retry the same action without creating a second item." : "Reload and try again."}`, "INVALID_RESPONSE");
  }
  retries.delete(key);
  if (!readOperations.has(operation)) {
    const cacheStarted = performance.now();
    const email = cache.peek<{ email?: string }>(keyFor("context", []))?.email;
    const tags = operation.startsWith("tasks.") ? ["tasks", "today", ...((body.result as Task)?.source?.kind === "habit" ? ["habits"] : [])] : operation.startsWith("schedule.") ? ["schedule", "today"] : operation === "preferences.save" ? ["tasks", "habits", "schedule", "today", "context", "official"] : ["tasks", "habits", "schedule", "today"];
    cache.invalidate(tags);
    if (operation === "tasks.create" || operation === "habits.save" && !args[1]) {
      cache.updateReady(tags, (value, entryKey) => {
        const [, cachedOperation, cachedArgs] = JSON.parse(entryKey) as [string, string, ViewOptions[]];
        const snapshot = value as WorkspaceSnapshot;
        if (cachedOperation !== "workspace.view" || snapshot.student?.id !== expected) return;
        return { value: operation === "tasks.create" ? applyCreatedTask(snapshot, body.result as Task, cachedArgs[0]) : applyCreatedHabit(snapshot, body.result as SavedHabit, cachedArgs[0]), ttl: freshness(snapshot.serverTime) };
      });
    }
    if (operation.startsWith("schedule.") && body.result && typeof body.result === "object" && Array.isArray((body.result as Dataset).events) && Array.isArray((body.result as Dataset).schedules)) {
      const saved = body.result as Dataset;
      cache.updateReady(["schedule", "today"], (value, entryKey) => {
        const [, cachedOperation, cachedArgs] = JSON.parse(entryKey) as [string, string, ViewOptions[]];
        if (cachedOperation === "schedule.load") return { value: saved, ttl: 60000 };
        const snapshot = value as WorkspaceSnapshot;
        if (cachedOperation !== "workspace.view" || snapshot.student?.id !== expected) return;
        return { value: applySavedSchedule(snapshot, saved, cachedArgs[0]), ttl: freshness(snapshot.serverTime) };
      });
    }
    if (operation === "preferences.save" && (body.result as Student)?.id === expected) rememberContext({ student: body.result as Student, email, serverTime: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("productivity:invalidated", { detail: tags }));
    if (tags.includes("tasks")) window.dispatchEvent(new Event("productivity-layer:tasks-changed"));
    if (tags.includes("habits")) window.dispatchEvent(new Event("productivity-layer:habits-changed"));
    if (tags.includes("schedule")) window.dispatchEvent(new Event("productivity-layer:schedule-changed"));
    saveTiming(operation, "confirmed-cache-and-notify", cacheStarted);
  }
  return body.result as T;
}

export const authenticatedIdentity = { async getCurrentStudent() { return (await rpc<{ student: Student }>("context")).student; } };
export const authenticatedAcademics = { getClassSessions: (_studentId: string, date: string) => rpc<OfficialClass[]>("official.classes", [date]) };
export const remoteTasks = {
  getCurrentStudent: authenticatedIdentity.getCurrentStudent,
  listTasks: () => rpc<Task[]>("tasks.list"), getTask: (id: string) => rpc<Task>("tasks.get", [id]), getHistory: () => rpc<Task[]>("tasks.history"),
  createTask: (input: TaskInput) => rpc<Task>("tasks.create", [input]), updateTask: (id: string, input: TaskInput) => rpc<Task>("tasks.update", [id, input]),
  deleteTask: (id: string) => rpc<Task>("tasks.delete", [id]), completeTask: (id: string) => rpc<Task>("tasks.complete", [id]), markTaskMissed: (id: string) => rpc<Task>("tasks.miss", [id]),
};
export const remoteSchedule = {
  getCurrentStudent: authenticatedIdentity.getCurrentStudent,
  load: () => rpc<Dataset>("schedule.load"), getOfficialClasses: (date: string) => rpc<OfficialClass[]>("official.classes", [date]),
  saveEvent: (input: EventInput, id?: string, source?: EventSource, options?: SchedulingOptions) => rpc<Dataset>("schedule.save", [input, id, source, options]),
  saveSubSchedule: (name: string, description: string, id?: string, academic?: boolean) => rpc<Dataset>("schedule.category", [name, description, id, academic]),
  archiveEvent: (id: string, restore?: boolean) => rpc<Dataset>("schedule.archive", [id, restore]),
  recordMissedAttempt: (id: string) => rpc<Dataset>("schedule.miss", [id]), setBackup: (id: string, backup?: Slot) => rpc<Dataset>("schedule.backup", [id, backup]),
};
export const remoteHabits = {
  tasks: remoteTasks, list: () => rpc<Habit[]>("habits.list"), save: (input: HabitInput, id?: string) => rpc<Habit>("habits.save", [input, id]),
  archive: (id: string, archived: boolean) => rpc<void>("habits.archive", [id, archived]),
  synchronize: (range: DateRange, options?: { tasks?: "all" | "today" }) => rpc<Occurrence[]>("habits.synchronize", [range, options]),
  record: (id: string, date: string, kind: "completed" | "missed" | "pending") => rpc<void>("habits.record", [id, date, kind]),
  replan: (event: PersonalEvent, slot: Slot, options: SchedulingOptions) => rpc<void>("habits.replan", [event.id, slot, options]),
};
