import { localNow } from "../schedule/domain";
import { scheduledFor, type Habit } from "../habits/domain";
import type { Task } from "./domain";
import { presetRange } from "../analytics/periods";

// A display scope only: history, analytics and shared outcome operations must
// continue to read the full task dataset.
export function todoTasks(tasks: readonly Task[], habits: readonly Habit[], timezone: string, instant: Date): Task[] {
  const today = localNow(timezone, instant).date;
  const rules = new Map(habits.map(habit => [habit.id, habit]));
  const seen = new Set<string>();
  return tasks.filter(task => {
    if (task.source.kind !== "habit") return true;
    if (task.habitWithdrawn || task.deletedAt) return false;
    const recorded = task.status !== "pending";
    if (!recorded && task.source.scheduledDate !== today) return false;
    const habit = rules.get(task.source.habitId);
    if (!recorded && (!habit || habit.ownerId !== task.ownerId || scheduledFor(habit, today)?.type !== "task")) return false;
    const key = JSON.stringify([task.ownerId, task.source.habitId, task.source.scheduledDate]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export type HabitHistoryPeriod = "all" | "today" | "week" | "month";
export function filterHabitHistory(tasks: readonly Task[], period: HabitHistoryPeriod, timezone: string, instant: Date) {
  const today = localNow(timezone, instant).date;
  const range = period === "week" || period === "month" ? presetRange(period, timezone, instant) : { start: today, end: today };
  return tasks.filter(task => task.source.kind !== "habit" || period === "all" || task.source.scheduledDate >= range.start && task.source.scheduledDate <= range.end);
}
