import { addDays, validDate, validSlot, type Priority } from "../schedule/domain.ts";
import { validTime, type Task } from "../tasks/domain.ts";
import type { PersonalEvent } from "../schedule/domain.ts";
export interface HabitInput {
  name: string; description: string; type: "task" | "event";
  frequency: "daily" | "weekdays"; weekdays: number[]; priority: Priority;
  time: string; end?: string;
}
export interface HabitRevision extends HabitInput { effectiveDate: string; at: string; archived: boolean }
export interface Habit { id: string; ownerId: string; timezone: string; createdDate: string; createdAt: string; revisions: HabitRevision[] }
export interface HabitData { version: 1; habits: Habit[] }
export interface HabitRepository { load(): Promise<HabitData>; save(data: HabitData): Promise<void> }
export interface Occurrence { habitId: string; id: string; date: string; settings: HabitRevision; task?: Task; event?: PersonalEvent }
export function validateHabit(input: HabitInput, timezone: string) {
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 || typeof input.description !== "string" || input.description.length > 10000) throw new Error("Enter a name up to 100 characters and a description up to 10,000 characters.");
  if (!["task", "event"].includes(input.type) || !["daily", "weekdays"].includes(input.frequency) || !["low", "medium", "high"].includes(input.priority)) throw new Error("Choose valid habit settings.");
  if (!Array.isArray(input.weekdays) || input.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(input.weekdays).size !== input.weekdays.length || (input.frequency === "weekdays" && !input.weekdays.length)) throw new Error("Select at least one weekday.");
  if (!validTime(input.time) || (input.type === "event" && (!input.end || !validSlot({ date: "2026-01-01", start: input.time, end: input.end, timezone })))) throw new Error("Choose a valid time. An event must end after it starts on the same day.");
}
export function settingsFor(habit: Habit, date: string) {
  return habit.revisions.filter(revision => revision.effectiveDate <= date).at(-1);
}
export function scheduledFor(habit: Habit, date: string) {
  if (!validDate(date) || date < habit.createdDate) return undefined;
  const settings = settingsFor(habit, date);
  return settings && !settings.archived && (settings.frequency === "daily" || settings.weekdays.includes(new Date(date + "T12:00:00Z").getUTCDay())) ? settings : undefined;
}
export const occurrenceId = (habitId: string, date: string) => `${habitId}:${date}`;
export function monthRange(date: string) {
  const start = date.slice(0, 7) + "-01";
  const parsed = new Date(start + "T12:00:00Z"); parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  return { start, end: addDays(parsed.toISOString().slice(0, 10), -1) };
}
export function outcome(occurrence: Occurrence): "completed" | "missed" | "unrecorded" | "review" {
  const event = occurrence.event;
  if (event?.completedAt && event.history.some(entry => entry.kind === "rescheduled")) return "review";
  if (occurrence.task?.status === "completed" || event?.completedAt) return "completed";
  if (occurrence.task?.status === "missed" || event?.history.some(entry => entry.kind === "missed")) return "missed";
  return "unrecorded";
}
export function isDue(occurrence: Occurrence, now: { date: string; time: string }) {
  const time = occurrence.task?.dueTime || occurrence.event?.originalSlot.end || (occurrence.settings.type === "event" ? occurrence.settings.end! : occurrence.settings.time);
  return occurrence.date + time <= now.date + now.time;
}
export function feedback(occurrences: Occurrence[], habitId: string, now: { date: string; time: string }) {
  const counts = { due: 0, completed: 0, missed: 0, unrecorded: 0, review: 0 };
  for (const item of occurrences) if (item.habitId === habitId && isDue(item, now)) {
    const state = outcome(item);
    if (state === "review") counts.review++;
    else { counts.due++; counts[state]++; }
  }
  return counts;
}
