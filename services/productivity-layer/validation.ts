import { badRequest, forbidden } from "@/lib/service-error";
import { validDate, validSlot, type EventInput, type Slot, type SchedulingOptions } from "@/features/productivity/schedule/domain";
import { validateTaskInput, type TaskInput } from "@/features/productivity/tasks/domain";
import { validateHabit, type HabitInput } from "@/features/productivity/habits/domain";
import type { ProductivityCommand } from "./types";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Invalid input.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw badRequest("Invalid text or identifier.");
  return value;
}
export const optionalId = (value: unknown) => value === undefined || value === null ? undefined : text(value);
export function boolean(value: unknown) { if (typeof value !== "boolean") throw badRequest("Expected a boolean."); return value; }
export function date(value: unknown) { if (typeof value !== "string" || !validDate(value)) throw badRequest("Choose a valid date."); return value; }
export function timezone(value: unknown) {
  const zone = text(value, 100);
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); } catch { throw badRequest("Choose a valid IANA timezone."); }
  return zone;
}
export function taskInput(value: unknown): TaskInput {
  const o = object(value);
  const input = { title: o.title, description: o.description, priority: o.priority, dueDate: o.dueDate, dueTime: o.dueTime } as TaskInput;
  validateTaskInput(input); return input;
}
export function habitInput(value: unknown, zone: string): HabitInput {
  const o = object(value);
  const input = { name: o.name, description: o.description, type: o.type, frequency: o.frequency, weekdays: o.weekdays,
    priority: o.priority, time: o.time, end: o.end, startDate: o.startDate, endDate: o.endDate } as HabitInput;
  validateHabit(input, zone); return input;
}
export function slot(value: unknown): Slot {
  const o = object(value), result = { date: o.date, start: o.start, end: o.end, timezone: o.timezone } as Slot;
  if (!validSlot(result)) throw badRequest("Choose a valid event date and times."); return result;
}
export function eventInput(value: unknown): EventInput {
  const o = object(value);
  if (typeof o.description !== "string" || o.description.length > 10000) throw badRequest("Description must be at most 10,000 characters.");
  return { title: text(o.title, 100), description: o.description, priority: o.priority as EventInput["priority"], mustComplete: boolean(o.mustComplete),
    subScheduleId: optionalId(o.subScheduleId), slot: slot(o.slot), backup: o.backup ? slot(o.backup) : undefined };
}
export function scheduling(value: unknown): SchedulingOptions {
  if (value === undefined || value === null) return { mode: "manual" };
  const o = object(value);
  if (o.mode === "manual") return { mode: "manual", allowConflicts: o.allowConflicts === undefined ? false : boolean(o.allowConflicts) };
  if (o.mode !== "smart" || !Number.isInteger(o.durationMinutes) || Number(o.durationMinutes) < 1 || Number(o.durationMinutes) > 1439) throw badRequest("Invalid scheduling options.");
  return { mode: "smart", durationMinutes: Number(o.durationMinutes), earliest: text(o.earliest, 5), latest: text(o.latest, 5) };
}
export function command(value: unknown): ProductivityCommand {
  const o = object(value);
  if (!Array.isArray(o.args) || o.args.length > 5) throw badRequest("Invalid operation arguments.");
  return { operation: text(o.operation, 60), args: o.args, requestId: optionalId(o.requestId) };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw forbidden("Cross-origin productivity requests are not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw badRequest("Send a JSON request.");
}
