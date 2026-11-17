import { slotTouchesDates } from "../schedule/timetable";
import { inTimezone } from "../schedule/time";
import { rangeDays } from "../analytics/periods";
import { localNow } from "../schedule/domain";
import { taskStatusCounts, queryTasks } from "../tasks/queries";
import type { Task } from "../tasks/domain";
import type { Habit, Occurrence } from "../habits/domain";
import type { WorkspaceSnapshot, ViewOptions } from "./data";

export type SavedHabit = Habit & { savedOccurrences?: Occurrence[] };
export function applyCreatedTask(snapshot: WorkspaceSnapshot, task: Task, scope: ViewOptions): WorkspaceSnapshot {
  if (task.ownerId !== snapshot.student.id || snapshot.data.tasks.tasks.some(row => row.id === task.id)) return snapshot;
  const now = new Date(), today = localNow(snapshot.student.timezone, now).date;
  const delta = taskStatusCounts([task], snapshot.student.timezone, new Date(snapshot.serverTime));
  const counts = snapshot.counts && { ...snapshot.counts };
  if (counts) for (const key of ["active", "pending", "completed", "missed"] as const) counts[key] += delta[key];
  const relevantToday = task.source.kind === "habit" ? task.source.scheduledDate === today : !task.dueDate || task.dueDate <= today;
  const onSchedule = task.scheduledSlot && (scope.section === "schedule" || scope.section === "today") && slotTouchesDates(inTimezone(task.scheduledSlot, snapshot.student.timezone), rangeDays(scope.section === "today" ? { start: today, end: today } : { start: scope.start || today, end: scope.end || today }));
  const include = scope.section !== "tasks" ? relevantToday || onSchedule : (scope.page || 0) === 0 && queryTasks([task], { status: scope.status, sort: scope.sort, timezone: snapshot.student.timezone, instant: now }).length > 0;
  let tasks = include ? [...snapshot.data.tasks.tasks, task] : snapshot.data.tasks.tasks;
  if (scope.section === "tasks") tasks = queryTasks(tasks, { status: scope.status, sort: scope.sort, timezone: snapshot.student.timezone, instant: now }).slice(0, 100);
  return { ...snapshot, counts, hasMore: scope.section === "tasks" && counts ? counts[scope.status || "active"] > ((scope.page || 0) + 1) * 100 : snapshot.hasMore,
    todayCounts: snapshot.todayCounts && { ...snapshot.todayCounts, openTasks: snapshot.todayCounts.openTasks + (relevantToday && task.status === "pending" ? 1 : 0) },
    data: { ...snapshot.data, tasks: { version: 2, tasks } } };
}
export function applyCreatedHabit(snapshot: WorkspaceSnapshot, habit: SavedHabit, scope: ViewOptions): WorkspaceSnapshot {
  if (habit.ownerId !== snapshot.student.id || snapshot.data.habits.habits.some(row => row.id === habit.id)) return snapshot;
  const { savedOccurrences, ...definition } = habit;
  let next: WorkspaceSnapshot = { ...snapshot, data: { ...snapshot.data, habits: { version: 1, habits: [...snapshot.data.habits.habits, definition] } } };
  for (const occurrence of savedOccurrences || []) {
    if (occurrence.habitId !== habit.id || !occurrence.id.startsWith(habit.id + ":")) continue;
    if (occurrence.task) next = applyCreatedTask(next, occurrence.task, scope);
    const start = scope.start || occurrence.date, end = scope.end || occurrence.date;
    if (occurrence.date >= start && occurrence.date <= end) {
      next = { ...next, occurrences: [...next.occurrences.filter(row => row.id !== occurrence.id), occurrence] };
      if (occurrence.event?.ownerId === snapshot.student.id) next = { ...next, data: { ...next.data, schedule: { ...next.data.schedule, events: [...next.data.schedule.events.filter(row => row.id !== occurrence.event!.id), occurrence.event] } } };
    }
  }
  return next;
}
