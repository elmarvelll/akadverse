import { addDays, validDate, validSlot, type Priority } from "../schedule/domain.ts";
import { validTime, type Task } from "../tasks/domain.ts";
import type { PersonalEvent } from "../schedule/domain.ts";
export interface HabitInput {
  name: string; description: string; type: "task" | "event";
  frequency: "daily" | "weekdays"; weekdays: number[]; priority: Priority;
  time: string; end?: string; startDate?: string; endDate?: string;
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
  if ((input.startDate !== undefined && !validDate(input.startDate)) || (input.endDate !== undefined && (!validDate(input.endDate) || !!input.startDate && input.endDate < input.startDate))) throw new Error("Choose valid dates with the end date on or after the start date.");
  if ((input.type === "task" && input.time !== "" && !validTime(input.time)) || (input.type === "event" && (!validTime(input.time) || !input.end || !validSlot({ date: "2026-01-01", start: input.time, end: input.end, timezone })))) throw new Error("Choose valid event times; the end must follow the start. Task deadlines are optional.");
}
export function validateHabitSnapshot(value: HabitRevision, timezone: string) {
  validateHabit(value, timezone);
  if (!validDate(value.effectiveDate) || typeof value.archived !== "boolean" || !Number.isFinite(Date.parse(value.at))) throw new Error("Invalid occurrence settings snapshot.");
}
export function settingsFor(habit: Habit, date: string, recordedAt?: string) {
  return habit.revisions.filter(revision => revision.effectiveDate <= date && (!recordedAt || revision.at <= recordedAt)).at(-1);
}
export function scheduledFor(habit: Habit, date: string) {
  if (!validDate(date)) return undefined;
  const settings = settingsFor(habit, date);
  return settings && !settings.archived && date >= (settings.startDate || habit.createdDate) && (!settings.endDate || date <= settings.endDate) && (settings.frequency === "daily" || settings.weekdays.includes(new Date(date + "T12:00:00Z").getUTCDay())) ? settings : undefined;
}
export const occurrenceId = (habitId: string, date: string) => `${habitId}:${date}`;
export function monthRange(date: string) {
  const start = date.slice(0, 7) + "-01";
  const parsed = new Date(start + "T12:00:00Z"); parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  return { start, end: addDays(parsed.toISOString().slice(0, 10), -1) };
}
export function outcome(occurrence: Occurrence): "completed" | "missed" | "unrecorded" | "review" {
  if (occurrence.task) return occurrence.task.status === "pending" ? "unrecorded" : occurrence.task.status;
  return occurrence.event ? eventOutcome(occurrence.event) : "unrecorded";
}
export function eventOutcome(event: PersonalEvent): "completed" | "missed" | "unrecorded" {
  if (event?.outcomeChanges?.length) return event.outcomeChanges.at(-1)!.to.status === "pending" ? "unrecorded" : event.outcomeChanges.at(-1)!.to.status as "completed" | "missed";
  if (event.completedAt) return "completed";
  if (event.history.some(entry => entry.kind === "missed")) return "missed";
  return "unrecorded";
}
export function isDue(occurrence: Occurrence, now: { date: string; time: string }) {
  if (occurrence.date < now.date) return true;
  if (occurrence.date > now.date) return false;
  const state = outcome(occurrence);
  if (state !== "unrecorded") return true;
  const time = occurrence.task ? occurrence.task.dueTime : occurrence.event?.originalSlot.end || (occurrence.settings.type === "event" ? occurrence.settings.end : occurrence.settings.time);
  return !!time && time <= now.time;
}
export function occurrenceActions(item: Occurrence, now: { date: string; time: string }) {
  if (item.date > now.date) return { complete: false, missed: false, clear: false };
  const state = outcome(item), past = item.date < now.date;
  const event = item.event;
  const complete = event ? event.slot.date < now.date || event.slot.date === now.date && event.slot.start <= now.time : true;
  const missed = event ? event.slot.date < now.date || event.slot.date === now.date && event.slot.end <= now.time : past || !!item.task?.dueTime && item.task.dueTime <= now.time;
  return { complete: complete && state !== "completed", missed: missed && state !== "missed", clear: state !== "unrecorded" };
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
