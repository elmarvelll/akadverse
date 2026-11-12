"use client";
import { SlotConflictError, type Student, type Dataset, type EventInput, type EventSource, type SchedulingOptions, type Slot, type OfficialClass, type PersonalEvent } from "./schedule/domain";
import type { Task, TaskInput } from "./tasks/domain";
import type { Habit, HabitInput, Occurrence } from "./habits/domain";
import type { DateRange } from "./analytics/periods";

let account = "";
let accountEpoch = 0;
const retries = new Map<string, string>();
export function setProductivityAccount(id: string) { if (id !== account) { account = id; accountEpoch++; retries.clear(); } }
const readOperations = new Set(["context", "tasks.list", "tasks.get", "tasks.history", "habits.list", "schedule.load", "schedule.history", "official.classes", "analytics.tasks", "analytics.schedule", "habits.synchronize"]);
export async function rpc<T>(operation: string, args: unknown[] = []): Promise<T> {
  const expected = account;
  const expectedEpoch = accountEpoch;
  if (!expected) throw new Error("Sign in to open your workspace.");
  const key = JSON.stringify([expected, operation, args]);
  const requestId = readOperations.has(operation) ? undefined : retries.get(key) || crypto.randomUUID();
  if (requestId) retries.set(key, requestId);
  let response: Response;
  try {
    response = await fetch("/api/productivity", { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Productivity-User": expected },
      body: JSON.stringify({ operation, args, requestId }) });
  } catch { throw new Error("The connection failed. Retry to safely check or save this operation."); }
  if (account !== expected || accountEpoch !== expectedEpoch) throw new Error("Your account changed. Reload your workspace.");
  if (response.status === 401 || response.status === 403) {
    retries.clear(); window.dispatchEvent(new Event("productivity:session-ended"));
    throw new Error("Your session expired or this account has no access. Sign in again.");
  }
  const body = await response.json();
  if (account !== expected || accountEpoch !== expectedEpoch) throw new Error("Your account changed. Reload your workspace.");
  if (!response.ok) {
    if (response.status < 500) retries.delete(key);
    if (body.code === "SLOT_CONFLICT") throw new SlotConflictError(body.conflicts);
    throw new Error(body.error || "The operation failed. Please retry.");
  }
  retries.delete(key);
  if (!readOperations.has(operation)) {
    window.dispatchEvent(new Event("productivity-layer:tasks-changed"));
    window.dispatchEvent(new Event("productivity-layer:habits-changed"));
  }
  return body.result;
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
