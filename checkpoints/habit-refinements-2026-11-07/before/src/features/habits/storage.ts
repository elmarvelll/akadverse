import type { StorageLike } from "../schedule/storage.ts";
import { validDate } from "../schedule/domain.ts";
import { validateHabit, type HabitData, type HabitRepository } from "./domain.ts";
export const HABIT_STORAGE_KEY = "productivity-layer.habits.v1";
export const HABITS_CHANGED = "productivity-layer:habits-changed";
export function parseHabits(raw: string): HabitData {
  try {
    const data: HabitData = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.habits)) throw new Error();
    const ids = new Set<string>();
    for (const habit of data.habits) {
      if (!habit || typeof habit.id !== "string" || !habit.id || ids.has(habit.id) || typeof habit.ownerId !== "string" || !habit.ownerId || typeof habit.timezone !== "string" || !habit.timezone || !validDate(habit.createdDate) || typeof habit.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(habit.createdAt) || !Number.isFinite(Date.parse(habit.createdAt)) || !Array.isArray(habit.revisions) || !habit.revisions.length) throw new Error();
      new Intl.DateTimeFormat("en", { timeZone: habit.timezone });
      let previous = "";
      for (const revision of habit.revisions) {
        validateHabit(revision, habit.timezone);
        if (!validDate(revision.effectiveDate) || revision.effectiveDate < habit.createdDate || revision.effectiveDate < previous || !Number.isFinite(Date.parse(revision.at)) || typeof revision.archived !== "boolean") throw new Error();
        previous = revision.effectiveDate;
      }
      if (habit.revisions[0].effectiveDate !== habit.createdDate) throw new Error();
      ids.add(habit.id);
    }
    return data;
  } catch { throw new Error("Saved habits contain invalid or unsupported records. Original data has been left untouched."); }
}
export class BrowserHabitRepository implements HabitRepository {
  private readable = false;
  private baseline: string | null = null;
  constructor(private storage: () => StorageLike = () => window.localStorage) {}
  async load(): Promise<HabitData> {
    this.readable = false;
    let raw: string | null;
    try { raw = this.storage().getItem(HABIT_STORAGE_KEY); } catch { throw new Error("Habit storage is unavailable. Allow storage access and retry."); }
    const data = raw === null ? { version: 1 as const, habits: [] } : parseHabits(raw);
    this.baseline = raw; this.readable = true; return data;
  }
  async save(data: HabitData) {
    if (!this.readable) throw new Error("Load habits successfully before saving.");
    const raw = JSON.stringify(data); parseHabits(raw);
    try {
      if (this.storage().getItem(HABIT_STORAGE_KEY) !== this.baseline) throw new Error("Habits changed in another tab. Reload before retrying.");
      this.storage().setItem(HABIT_STORAGE_KEY, raw); this.baseline = raw;
    } catch (error) {
      if (error instanceof Error && error.message.includes("another tab")) throw error;
      throw new Error("Saving habits failed. Previous confirmed settings are unchanged. Keep your input and retry.");
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(HABITS_CHANGED));
  }
}
