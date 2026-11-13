"use client";
import { SlotConflictError, type Student, type Dataset, type EventInput, type EventSource, type SchedulingOptions, type Slot, type OfficialClass, type PersonalEvent } from "./schedule/domain";
import type { Task, TaskInput } from "./tasks/domain";
import type { Habit, HabitInput, Occurrence } from "./habits/domain";
import type { DateRange } from "./analytics/periods";
import { ProductivityError, productivityAction } from "./errors";

let account = "";
let accountEpoch = 0;
let setupFailure: ProductivityError | undefined;
const retries = new Map<string, string>();
export function setProductivityAccount(id: string) { if (id !== account) { account = id; accountEpoch++; retries.clear(); setupFailure = undefined; } }
const setupCodes = new Set(["DATABASE_SCHEMA_MISSING", "DATABASE_CONFIGURATION", "DATABASE_ACCESS_DENIED", "DATABASE_NOT_FOUND"]);
const readOperations = new Set(["context", "tasks.list", "tasks.get", "tasks.history", "habits.list", "schedule.load", "schedule.history", "official.classes", "analytics.tasks", "analytics.schedule", "habits.synchronize"]);
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
export async function rpc<T>(operation: string, args: unknown[] = []): Promise<T> {
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
  } finally { clearTimeout(timeout); }
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
    window.dispatchEvent(new Event("productivity-layer:tasks-changed"));
    window.dispatchEvent(new Event("productivity-layer:habits-changed"));
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
