import { addDays, selectScheduleEvents, validDate, type Dataset, type Slot } from "./domain";
export function scheduleDates(date: string, view: "day" | "week") {
  if (!validDate(date)) return [];
  if (view === "day") return [date];
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const monday = addDays(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}
export interface TimetableEntry { id: string; title: string; slot: Slot; kind: "personal" | "habit" | "academic"; category: string; priority?: string; venue?: string; outcome?: string }
interface TimetableSegment extends TimetableEntry { displayDate: string; startMinute: number; endMinute: number }
export interface PlacedEntry extends TimetableSegment { column: number; columns: number }
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const HOUR_HEIGHT = 72;
export const DAY_HEIGHT = 24 * HOUR_HEIGHT;
export const timetableHours = Array.from({ length: 24 }, (_, hour) => hour);
export const minuteLabel = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

// Slots remain in their existing local timezone. Only their display portions
// are split; IDs, source slots and stored records are never changed.
function slotSegments(slot: Slot) {
  const startMinute = minutes(slot.start), endMinute = minutes(slot.end);
  if (endMinute === startMinute) return [];
  if (endMinute > startMinute) return [{ displayDate: slot.date, startMinute, endMinute }];
  return [
    { displayDate: slot.date, startMinute, endMinute: 1440 },
    ...(endMinute > 0 ? [{ displayDate: addDays(slot.date, 1), startMinute: 0, endMinute }] : []),
  ];
}
export const slotTouchesDates = (slot: Slot, dates: readonly string[]) => slotSegments(slot).some(segment => dates.includes(segment.displayDate));
export const timetableSourceDates = (dates: readonly string[]) => dates.length ? [addDays(dates[0], -1), ...dates] : [];
export function selectTimetableEvents(data: Dataset, ownerId: string, dates: readonly string[], options: { scheduleId?: string; focus?: boolean }) {
  return timetableSourceDates(dates).flatMap(date => selectScheduleEvents(data, ownerId, { ...options, date })).filter(event => slotTouchesDates(event.slot, dates));
}
export function initialTimetableScroll(dates: readonly string[], today: string, currentTime: string) {
  return dates.includes(today) ? Math.max(0, (minutes(currentTime) / 60 - 1) * HOUR_HEIGHT) : 6 * HOUR_HEIGHT;
}
export function timetableEventGeometry(startMinute: number, endMinute: number) {
  const top = Math.min(DAY_HEIGHT - 1, startMinute / 60 * HOUR_HEIGHT + 2);
  return { top, height: Math.min(DAY_HEIGHT - top, Math.max(25, (endMinute - startMinute) / 60 * HOUR_HEIGHT - 4)) };
}
// Connected overlap groups receive side-by-side columns. Adjacent intervals
// can share a column, preserving the existing half-open conflict semantics.
export function placeTimetable(entries: readonly TimetableEntry[]): PlacedEntry[] {
  const result: PlacedEntry[] = [];
  const unique = [...new Map(entries.map(item => [item.id, item])).values()];
  const segments: TimetableSegment[] = unique.flatMap(entry => slotSegments(entry.slot).map(segment => ({ ...entry, ...segment })));
  for (const date of new Set(segments.map(item => item.displayDate))) {
    const rows = segments.filter(item => item.displayDate === date).sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute || a.id.localeCompare(b.id));
    let cluster: PlacedEntry[] = [], ends: number[] = [], maxEnd = -1;
    const flush = () => { for (const row of cluster) result.push({ ...row, columns: ends.length }); cluster = []; ends = []; maxEnd = -1; };
    for (const entry of rows) {
      const { startMinute, endMinute } = entry;
      if (startMinute >= maxEnd && cluster.length) flush();
      let column = ends.findIndex(end => end <= startMinute);
      if (column === -1) column = ends.length;
      ends[column] = endMinute; maxEnd = Math.max(maxEnd, endMinute);
      cluster.push({ ...entry, column, columns: 1, startMinute, endMinute });
    }
    flush();
  }
  return result;
}
