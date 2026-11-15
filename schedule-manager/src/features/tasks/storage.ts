import { validateHabitSnapshot } from "../habits/domain.ts";
import { validateOutcomeChanges } from "../habits/outcomes.ts";
import type { StorageLike } from "../schedule/storage.ts";
import { emptyTasks, validateTaskInput, type TaskDataset, type TaskRepository } from "./domain.ts";
import { validDate } from "../schedule/domain.ts";
export const TASK_STORAGE_KEY = "productivity-layer.tasks.v1";
export const TASKS_CHANGED = "productivity-layer:tasks-changed";
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const stamp = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function parseTaskDataset(raw: string): TaskDataset {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Saved tasks are not valid JSON. The original data has been left untouched."); }
  const invalid = (): never => { throw new Error("Saved tasks have invalid or unsupported records. The original data has been left untouched."); };
  if (!record(value) || (value.version !== 1 && value.version !== 2) || !Array.isArray(value.tasks)) return invalid();
  if (value.version === 1) {
    // Version one already used pending/completed/missed. Never infer an outcome
    // from a deadline, updatedAt, or an unrecognized legacy status.
    for (const task of value.tasks) {
      if (!record(task)) return invalid();
      if (!["pending", "completed", "missed"].includes(String(task.status))) throw new Error("Saved tasks contain an ambiguous legacy status. Original records are untouched; recover or clarify that status before continuing.");
      const missed = Array.isArray(task.history) ? task.history.filter(entry => record(entry) && entry.kind === "missed") : [];
      if (missed.length && task.missedAt === undefined) task.missedAt = missed[0].at;
    }
    value.version = 2;
  }
  const ids = new Set<string>(), occurrences = new Set<string>();
  for (const task of value.tasks) {
    if (!record(task) || !text(task.id) || ids.has(task.id) || !text(task.ownerId) || !stamp(task.createdAt) || !stamp(task.updatedAt) || Date.parse(task.updatedAt) < Date.parse(task.createdAt) || !["pending", "missed", "completed"].includes(String(task.status)) || !record(task.source) || !Array.isArray(task.history) || !task.history.length) return invalid();
    try { validateTaskInput(task as unknown as import("./domain.ts").TaskInput); } catch { return invalid(); }
    if (task.source.kind === "habit") {
      if (task.habitWithdrawn !== undefined && typeof task.habitWithdrawn !== "boolean") return invalid();
      try { if (task.habitSettings !== undefined && (task.habitSettings as import("../habits/domain.ts").HabitRevision).type !== "task") return invalid(); if (task.habitSettings !== undefined) validateHabitSnapshot(task.habitSettings as import("../habits/domain.ts").HabitRevision, "UTC"); } catch { return invalid(); }
      const source = task.source;
      if (!text(source.habitId) || !text(source.occurrenceId) || !text(source.habitName) || !validDate(source.scheduledDate) || task.dueDate !== source.scheduledDate || task.deletedAt !== undefined || (source.habitHref !== undefined && (!text(source.habitHref) || !/^\/habits(?:\/|\?|$)/.test(source.habitHref)))) return invalid();
      const key = JSON.stringify([task.ownerId, source.habitId, source.occurrenceId]);
      if (occurrences.has(key)) return invalid();
      occurrences.add(key);
    } else if (task.source.kind !== "ordinary" || (task.habitWithdrawn !== undefined || task.habitSettings !== undefined)) return invalid();
    if ((task.status === "completed") !== (task.completedAt !== undefined) || (task.completedAt !== undefined && !stamp(task.completedAt)) || (task.missedAt !== undefined && !stamp(task.missedAt)) || (task.deletedAt !== undefined && !stamp(task.deletedAt))) return invalid();
    const auditIds = new Set<string>();
    for (const entry of task.history) {
      if (!record(entry) || !text(entry.id) || auditIds.has(entry.id) || !stamp(entry.at) || !["created", "edited", "completed", "deleted", "missed"].includes(String(entry.kind)) || !record(entry.snapshot) || Date.parse(entry.at) < Date.parse(task.createdAt) || Date.parse(entry.at) > Date.parse(task.updatedAt)) return invalid();
      try { validateTaskInput(entry.snapshot as unknown as import("./domain.ts").TaskInput); } catch { return invalid(); }
      auditIds.add(entry.id);
    }
    let base: import("../habits/outcomes.ts").OutcomeState;
    try {
      if (task.outcomeChanges !== undefined && task.source.kind !== "habit") return invalid();
      base = validateOutcomeChanges(task.outcomeChanges, task as unknown as import("../habits/outcomes.ts").OutcomeState, task.createdAt, task.updatedAt);
    } catch { return invalid(); }
    const completed = task.history.filter(entry => entry.kind === "completed"), deleted = task.history.filter(entry => entry.kind === "deleted"), missed = task.history.filter(entry => entry.kind === "missed");
    if (task.history[0].kind !== "created" || task.history.filter(entry => entry.kind === "created").length !== 1 || task.history[0].at !== task.createdAt || completed.length !== (base.status === "completed" ? 1 : 0) || (completed.length && completed[0].at !== base.completedAt) || deleted.length !== (task.deletedAt ? 1 : 0) || (deleted.length && deleted[0].at !== task.deletedAt) || missed.length !== (base.missedAt ? 1 : 0) || (missed.length && missed[0].at !== base.missedAt) || (base.status === "missed" && missed.length !== 1) || (base.status === "pending" && missed.length)) return invalid();
    ids.add(task.id);
  }
  return value as unknown as TaskDataset;
}

// Same asynchronous, load-before-save and stale-tab conventions as the schedule
// repository, with its own key: schedule records are never rewritten by tasks.
export class BrowserTaskRepository implements TaskRepository {
  private readable = false;
  private baseline: string | null = null;
  constructor(private storage: () => StorageLike = () => window.localStorage) {}
  async load(): Promise<TaskDataset> {
    this.readable = false;
    let raw: string | null;
    try { raw = this.storage().getItem(TASK_STORAGE_KEY); } catch { throw new Error("Task storage is unavailable. Allow browser storage and retry loading."); }
    const data = raw === null ? emptyTasks() : parseTaskDataset(raw);
    this.baseline = raw;
    this.readable = true;
    return data;
  }
  async save(data: TaskDataset) {
    if (!this.readable) throw new Error("Load task data successfully before saving.");
    const raw = JSON.stringify(data);
    parseTaskDataset(raw);
    try {
      if (this.storage().getItem(TASK_STORAGE_KEY) !== this.baseline) throw new Error("Tasks changed in another tab. Reload before retrying.");
      this.storage().setItem(TASK_STORAGE_KEY, raw);
      this.baseline = raw;
    } catch (error) {
      if (error instanceof Error && error.message.includes("another tab")) throw error;
      throw new Error("Saving tasks failed. Your changes have not been saved. Keep your input and retry.");
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(TASKS_CHANGED));
  }
}
