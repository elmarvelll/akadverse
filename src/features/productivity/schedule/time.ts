import { ProductivityError } from "../errors";
import type { Slot } from "./domain";

function wallParts(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}
export function localInstant(date: string, time: string, timezone: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const [year, month, day] = date.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const candidates: number[] = [];
  for (const shift of [-86400000, 0, 86400000]) {
    const sample = wall + shift, candidate = wall - (wallParts(sample, timezone) - sample);
    if (wallParts(candidate, timezone) === wall) candidates.push(candidate);
  }
  return candidates.length ? Math.min(...candidates) : undefined;
}
export function slotInterval(slot: Slot) {
  const nextDate = new Date(Date.parse(slot.date + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
  const start = localInstant(slot.date, slot.start, slot.timezone);
  const end = localInstant(slot.end < slot.start ? nextDate : slot.date, slot.end, slot.timezone);
  if (start === undefined || end === undefined || end <= start) throw new ProductivityError("This local event time is unavailable in its timezone.");
  return { start, end };
}
export function inTimezone(slot: Slot, timezone: string): Slot {
  if (slot.timezone === timezone) return { ...slot };
  const { start, end } = slotInterval(slot);
  const local = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
  };
  const from = local(start), to = local(end);
  return { date: from.date, start: from.time, end: to.time, timezone };
}
