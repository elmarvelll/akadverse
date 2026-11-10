import { localNow } from "../schedule/domain.ts";
import { scheduledFor, type Habit } from "../habits/domain.ts";
import type { Task } from "./domain.ts";

// A display scope only: history, analytics and shared outcome operations must
// continue to read the full task dataset.
export function todoTasks(tasks: readonly Task[], habits: readonly Habit[], timezone: string, instant: Date): Task[] {
  const today = localNow(timezone, instant).date;
  const rules = new Map(habits.map(habit => [habit.id, habit]));
  const seen = new Set<string>();
  return tasks.filter(task => {
    if (task.source.kind !== "habit") return true;
    if (task.habitWithdrawn || task.deletedAt || task.source.scheduledDate !== today) return false;
    const habit = rules.get(task.source.habitId);
    if (!habit || habit.ownerId !== task.ownerId || scheduledFor(habit, today)?.type !== "task") return false;
    const key = JSON.stringify([task.ownerId, task.source.habitId, task.source.scheduledDate]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
