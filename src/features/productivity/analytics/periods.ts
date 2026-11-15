import { ProductivityError, productivityErrorMessage } from "../errors";
import { addDays, localNow, validDate, type OfficialClass } from "../schedule/domain";

export interface DateRange { start: string; end: string }
export const maxAnalyticsDays = 366;
export function rangeDays(range: DateRange): string[] {
  if (!validDate(range.start) || !validDate(range.end) || range.end < range.start) throw new ProductivityError("Choose valid dates with the end on or after the start.");
  const days: string[] = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    if (days.length >= maxAnalyticsDays) throw new ProductivityError("Choose a range of at most 366 days.");
    days.push(date);
  }
  return days;
}
export function presetRange(preset: "week" | "month", timezone: string, instant: Date): DateRange {
  const today = localNow(timezone, instant).date;
  if (preset === "week") {
    const day = new Date(today + "T12:00:00Z").getUTCDay();
    const start = addDays(today, -((day + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  const start = today.slice(0, 8) + "01";
  const [year, month] = start.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { start, end: addDays(nextMonth, -1) };
}
function wallParts(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}
// Resolve a local wall time without assuming a fixed UTC offset. Nonexistent DST
// times are unavailable; ambiguous times consistently use the earlier instant.
export function localInstant(date: string, time: string, timezone: string): number | undefined {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const [year, month, day] = date.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const candidates: number[] = [];
  for (const shift of [-86400000, 0, 86400000]) {
    const sample = wall + shift;
    const offset = wallParts(sample, timezone) - sample;
    const candidate = wall - offset;
    if (wallParts(candidate, timezone) === wall) candidates.push(candidate);
  }
  return candidates.length ? Math.min(...candidates) : undefined;
}
export function dayBounds(date: string, timezone: string) {
  const start = localInstant(date, "00:00", timezone), end = localInstant(addDays(date, 1), "00:00", timezone);
  if (start === undefined || end === undefined) throw new ProductivityError("A local day boundary could not be resolved in this timezone.");
  return { start, end };
}
export function instantInRange(at: string | undefined, range: DateRange, timezone: string) {
  if (!at || !Number.isFinite(Date.parse(at))) return false;
  const date = localNow(timezone, new Date(at)).date;
  return date >= range.start && date <= range.end;
}
export async function loadAcademicRange(range: DateRange, getClasses: (date: string) => Promise<OfficialClass[]>) {
  // Include the preceding day to cover a session continuing across midnight.
  const dates = [addDays(range.start, -1), ...rangeDays(range)], rows: OfficialClass[] = [], failedDates: string[] = [], errors = new Set<string>();
  for (let index = 0; index < dates.length; index += 4) {
    const batch = dates.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(date => getClasses(date)));
    results.forEach((result, offset) => { if (result.status === "fulfilled") rows.push(...result.value); else { failedDates.push(batch[offset]); errors.add(productivityErrorMessage(result.reason, "The official timetable service could not complete this request. Retry timetable data.")); } });
  }
  return { rows, failedDates, errors: [...errors] };
}
