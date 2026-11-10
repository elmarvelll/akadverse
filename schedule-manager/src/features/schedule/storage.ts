import { validateHabitSnapshot } from "../habits/domain.ts";
import { validateOutcomeChanges } from "../habits/outcomes.ts";
﻿import {
  emptyDataset,
  validDate,
  validSlot,
  type Dataset,
  type ScheduleRepository,
  type Slot,
} from "./domain.ts";
export const STORAGE_KEY = "productivity-layer.schedule.v1";
export type StorageLike = Pick<Storage, "getItem" | "setItem">;
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function text(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function stamp(v: unknown) {
  return (
    text(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
  );
}
function slot(v: unknown): v is Slot {
  return (
    record(v) &&
    typeof v.date === "string" &&
    typeof v.start === "string" &&
    typeof v.end === "string" &&
    typeof v.timezone === "string" &&
    validSlot(v as unknown as Slot)
  );
}
function optionalText(v: unknown) {
  return v === undefined || text(v);
}
export function parseDataset(raw: string): Dataset {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "Saved schedule is not valid JSON. It has been left untouched.",
    );
  }
  const invalid = () => {
    throw new Error(
      "Saved schedule has invalid or unsupported records. It has been left untouched.",
    );
  };
  if (
    !record(data) ||
    data.version !== 1 ||
    !Array.isArray(data.events) ||
    !Array.isArray(data.schedules)
  )
    return invalid();
  const seen = new Set<string>();
  for (const s of data.schedules) {
    if (
      !record(s) ||
      !text(s.id) ||
      seen.has(s.id) ||
      !text(s.ownerId) ||
      !text(s.name) ||
      s.name.length > 60 ||
      typeof s.description !== "string" ||
      (s.academic !== undefined && typeof s.academic !== "boolean") ||
      !stamp(s.createdAt) ||
      !stamp(s.updatedAt)
    )
      return invalid();
    seen.add(s.id);
  }
  for (const e of data.events) {
    if (
      !record(e) ||
      !text(e.id) ||
      seen.has(e.id) ||
      !text(e.ownerId) ||
      !text(e.title) ||
      e.title.length > 100 ||
      !text(e.description) ||
      !optionalText(e.subScheduleId) ||
      !slot(e.slot) ||
      !slot(e.originalSlot) ||
      !["low", "medium", "high"].includes(String(e.priority)) ||
      typeof e.mustComplete !== "boolean" ||
      !["pending", "completed", "requires-replanning"].includes(
        String(e.status),
      ) ||
      !stamp(e.createdAt) ||
      !stamp(e.updatedAt) ||
      (e.completedAt !== undefined && !stamp(e.completedAt)) ||
      (e.archivedAt !== undefined && !stamp(e.archivedAt)) ||
      (e.status === "completed" && !stamp(e.completedAt)) ||
      !record(e.source) ||
      !Array.isArray(e.history) ||
      !e.history.length
    )
      return invalid();
    try {
      if (e.habitSettings !== undefined) { if (e.source.kind !== "habit" || (e.habitSettings as import("../habits/domain.ts").HabitRevision).type !== "event") return invalid(); validateHabitSnapshot(e.habitSettings as import("../habits/domain.ts").HabitRevision, (e.slot as Slot).timezone); }
      if (e.outcomeChanges !== undefined && e.source.kind !== "habit") return invalid();
      const latest = (e.outcomeChanges as import("../habits/outcomes.ts").OutcomeChange[] | undefined)?.at(-1)?.to;
      validateOutcomeChanges(e.outcomeChanges, { status: e.status === "pending" && latest?.status === "missed" && e.history.some(entry => typeof entry === "object" && entry !== null && "kind" in entry && entry.kind === "rescheduled") ? "missed" : e.status === "completed" ? "completed" : e.status === "requires-replanning" ? "missed" : "pending", completedAt: e.completedAt as string | undefined, missedAt: latest?.missedAt }, e.createdAt as string, e.updatedAt as string);
    } catch { return invalid(); }
    if (
      e.source.kind !== "personal" &&
      !(e.source.kind === "task" && text(e.source.taskId)) &&
      !(
        e.source.kind === "habit" &&
        text(e.source.habitId) &&
        text(e.source.occurrenceId)
      )
    )
      return invalid();
    if (
      e.mustComplete ? e.focusDate !== e.slot.date : e.focusDate !== undefined
    )
      return invalid();
    if (e.focusDate !== undefined && !validDate(e.focusDate)) return invalid();
    if (
      e.backup !== undefined &&
      (!slot(e.backup) || e.backup.timezone !== e.slot.timezone)
    )
      return invalid();
    if (
      e.subScheduleId &&
      !data.schedules.some(
        (s) => s.id === e.subScheduleId && s.ownerId === e.ownerId,
      )
    )
      return invalid();
    const historyIds = new Set<string>();
    for (const h of e.history) {
      if (
        !record(h) ||
        !text(h.id) ||
        historyIds.has(h.id) ||
        ![
          "created",
          "edited",
          "completed",
          "archived",
          "restored",
          "missed",
          "rescheduled",
        ].includes(String(h.kind)) ||
        !stamp(h.at) ||
        !slot(h.planned) ||
        typeof h.mustComplete !== "boolean" ||
        (h.next !== undefined && !slot(h.next))
      )
        return invalid();
      historyIds.add(h.id);
    }
    if (e.history.filter((h) => h.kind === "completed").length > 1)
      return invalid();
    seen.add(e.id);
  }
  return data as unknown as Dataset;
}
export class BrowserScheduleRepository implements ScheduleRepository {
  private readable = false;
  private baseline: string | null = null;
  constructor(private storage: () => StorageLike = () => window.localStorage) {}
  async load(): Promise<Dataset> {
    this.readable = false;
    let raw: string | null;
    try {
      raw = this.storage().getItem(STORAGE_KEY);
    } catch {
      throw new Error(
        "Browser storage is unavailable. Allow storage access and retry loading.",
      );
    }
    const data = raw === null ? emptyDataset() : parseDataset(raw);
    this.baseline = raw;
    this.readable = true;
    return data;
  }
  async save(data: Dataset): Promise<void> {
    if (!this.readable)
      throw new Error("Load saved data successfully before making changes.");
    const raw = JSON.stringify(data);
    parseDataset(raw);
    try {
      if (this.storage().getItem(STORAGE_KEY) !== this.baseline)
        throw new Error(
          "Schedule changed in another tab. Reload before retrying.",
        );
      this.storage().setItem(STORAGE_KEY, raw);
      this.baseline = raw;
    } catch (error) {
      if (error instanceof Error && error.message.includes("another tab"))
        throw error;
      throw new Error(
        "Saving failed. Your changes have not been saved. Keep this form open and retry.",
      );
    }
  }
}
