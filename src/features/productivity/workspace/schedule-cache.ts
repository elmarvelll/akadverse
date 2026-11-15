import { localNow, type Dataset } from "../schedule/domain";
import { scheduleDates, slotTouchesDates } from "../schedule/timetable";
import type { ViewOptions, WorkspaceSnapshot } from "./data";

/** Merge only a server-confirmed schedule, retaining unrelated cached data. */
export function applySavedSchedule(snapshot: WorkspaceSnapshot, dataset: Dataset, scope: ViewOptions): WorkspaceSnapshot {
  const ownerId = snapshot.student.id, today = localNow(snapshot.student.timezone).date;
  const schedules = dataset.schedules.filter(row => row.ownerId === ownerId);
  const own = dataset.events.filter(row => row.ownerId === ownerId);
  let events = own, hasMore = snapshot.hasMore;
  if (scope.section === "today") events = own.filter(event => slotTouchesDates(event.slot, [today]));
  else if (scope.history) {
    const all = own.filter(event => !scope.categoryId || event.subScheduleId === scope.categoryId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const offset = (scope.page || 0) * 100;
    events = all.slice(offset, offset + 100); hasMore = all.length > offset + 100;
  } else {
    const week = scheduleDates(today, "week"), start = scope.start || week[0], end = scope.end || week.at(-1)!;
    events = own.filter(event => event.slot.date >= start && event.slot.date <= end || event.originalSlot.date >= start && event.originalSlot.date <= end || event.id === scope.eventId || slotTouchesDates(event.slot, [start]));
  }
  const eventMap = new Map(own.map(event => [event.id, event]));
  return { ...snapshot, hasMore, data: { ...snapshot.data, schedule: { version: 1, schedules, events } }, occurrences: snapshot.occurrences.map(row => ({ ...row, event: row.event ? eventMap.get(row.event.id) || row.event : undefined })) };
}
