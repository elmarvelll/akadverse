import { ProductivityError } from "../errors";
import { validDate } from "../schedule/domain";
import { validateHabit, type HabitData } from "./domain";
export const HABIT_STORAGE_KEY = "productivity-layer.habits.v1";
export const HABITS_CHANGED = "productivity-layer:habits-changed";
export function parseHabits(raw: string): HabitData {
  try {
    const data: HabitData = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.habits)) throw new ProductivityError("Invalid saved habit record.");
    const ids = new Set<string>();
    for (const habit of data.habits) {
      if (!habit || typeof habit.id !== "string" || !habit.id || ids.has(habit.id) || typeof habit.ownerId !== "string" || !habit.ownerId || typeof habit.timezone !== "string" || !habit.timezone || !validDate(habit.createdDate) || typeof habit.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(habit.createdAt) || !Number.isFinite(Date.parse(habit.createdAt)) || !Array.isArray(habit.revisions) || !habit.revisions.length) throw new ProductivityError("Invalid saved habit record.");
      new Intl.DateTimeFormat("en", { timeZone: habit.timezone });
      for (const revision of habit.revisions) {
        validateHabit(revision, habit.timezone);
        if (!validDate(revision.effectiveDate) || revision.effectiveDate < (habit.revisions[0].startDate && habit.revisions[0].startDate < habit.createdDate ? habit.revisions[0].startDate : habit.createdDate) || !Number.isFinite(Date.parse(revision.at)) || typeof revision.archived !== "boolean") throw new ProductivityError("Invalid saved habit record.");
      }
      if (habit.revisions[0].effectiveDate !== (habit.revisions[0].startDate && habit.revisions[0].startDate < habit.createdDate ? habit.revisions[0].startDate : habit.createdDate)) throw new ProductivityError("Invalid saved habit record.");
      ids.add(habit.id);
    }
    return data;
  } catch { throw new ProductivityError("Saved habits contain invalid or unsupported records. Original data has been left untouched."); }
}
