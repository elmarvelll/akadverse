import { habitDuplicateConflicts } from "../habits/duplicates";
import { addDays, type Dataset, type OfficialClass, type PersonalEvent, type Slot } from "../schedule/domain";
import { taskViewStatus, type Task } from "../tasks/domain";
import { dayBounds, instantInRange, localInstant, rangeDays, type DateRange } from "./periods";

export interface Interval { start: number; end: number }
export interface Metric { key: string; label: string; count: number; percent: number }
export function mergedDuration(intervals: readonly Interval[]): number {
  const sorted = intervals.filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start).map(interval => ({ ...interval })).sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0, current: Interval | undefined;
  for (const interval of sorted) {
    if (!current || interval.start > current.end) { if (current) total += current.end - current.start; current = interval; }
    else current.end = Math.max(current.end, interval.end);
  }
  return total + (current ? current.end - current.start : 0);
}
export function percentages(rows: { key: string; label: string; count: number }[]): Metric[] {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return rows.map(row => ({ ...row, percent: 0 }));
  const portions = rows.map((row, index) => ({ index, exact: row.count / total * 1000, value: Math.floor(row.count / total * 1000) }));
  let remaining = 1000 - portions.reduce((sum, row) => sum + row.value, 0);
  for (const portion of [...portions].sort((a, b) => (b.exact - b.value) - (a.exact - a.value) || a.index - b.index)) {
    if (remaining-- > 0) portions[portion.index].value++;
  }
  return rows.map((row, index) => ({ ...row, percent: portions[index].value / 10 }));
}
function eventKey(event: PersonalEvent) {
  return event.source.kind === "habit" ? JSON.stringify([event.ownerId, "habit", event.source.habitId, event.originalSlot.date]) : event.id;
}
function uniqueEvents(events: readonly PersonalEvent[], ownerId: string) {
  const seen = new Set<string>();
  return [...events].filter(event => event.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).filter(event => {
    const key = eventKey(event);
    if (seen.has(key)) return false;
    seen.add(key); return !event.archivedAt;
  });
}
function uniqueTasks(tasks: readonly Task[], ownerId: string) {
  const seen = new Set<string>();
  return [...tasks].filter(task => task.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).filter(task => {
    const key = task.source.kind === "habit" ? JSON.stringify([ownerId, "habit", task.source.habitId, task.source.scheduledDate]) : task.id;
    if (seen.has(key)) return false;
    seen.add(key); return !task.deletedAt && !task.habitWithdrawn;
  });
}
function slotInterval(slot: Slot): Interval | undefined {
  const start = localInstant(slot.date, slot.start, slot.timezone);
  const end = localInstant(slot.end < slot.start ? addDays(slot.date, 1) : slot.date, slot.end, slot.timezone);
  return start !== undefined && end !== undefined && end > start ? { start, end } : undefined;
}
function clip(interval: Interval, bounds: Interval): Interval | undefined {
  const start = Math.max(interval.start, bounds.start), end = Math.min(interval.end, bounds.end);
  return end > start ? { start, end } : undefined;
}
function sameSlot(a: Slot, b: Slot) { return a.date === b.date && a.start === b.start && a.end === b.end && a.timezone === b.timezone; }

export function scheduleAnalytics(data: Dataset, classes: readonly OfficialClass[], ownerId: string, range: DateRange, timezone: string) {
  const dates = rangeDays(range), bounds = { start: dayBounds(range.start, timezone).start, end: dayBounds(range.end, timezone).end };
  const warnings = new Set<string>();
  if (habitDuplicateConflicts([], data.events.filter(event => event.ownerId === ownerId)).length) warnings.add("Conflicting duplicate habit outcomes need review; occurrence totals are deduplicated and may be incomplete.");
  const schedules = data.schedules.filter(schedule => schedule.ownerId === ownerId);
  const academics = [...schedules].filter(schedule => schedule.academic).sort((a, b) => a.id.localeCompare(b.id))[0];
  const area = (scheduleId?: string) => schedules.find(schedule => schedule.id === scheduleId);
  const events = uniqueEvents(data.events, ownerId);
  const planned: { areaId: string; areaName: string; interval: Interval }[] = [];
  function include(slot: Slot, areaId: string, areaName: string) {
    let interval: Interval | undefined;
    try { interval = slotInterval(slot); } catch { /* report missing/unresolvable source data below */ }
    if (!interval) { warnings.add("Some planned entries have invalid or unresolvable times and were excluded."); return; }
    const intersected = clip(interval, bounds);
    if (intersected) planned.push({ areaId, areaName, interval: intersected });
  }
  for (const event of events) {
    const schedule = area(event.subScheduleId);
    include(event.slot, schedule?.id || "unassigned", schedule?.name || "Unassigned");
  }
  const seenClasses = new Set<string>();
  // Cancellation/drop wins if a provider returns duplicate representations.
  const official = [...classes].sort((a, b) => Number(b.state === "cancelled" || b.registrationState === "dropped") - Number(a.state === "cancelled" || a.registrationState === "dropped"));
  for (const session of official) {
    const key = JSON.stringify([session.sourceId || session.id, session.slot.date]);
    if (seenClasses.has(key)) continue;
    seenClasses.add(key);
    if (session.state !== "scheduled" || session.registrationState !== "registered") continue;
    include(session.slot, academics?.id || "official-academics", academics?.name || "Academics");
  }
  const areaGroups = new Map<string, { key: string; label: string; intervals: Interval[]; entries: number }>();
  for (const entry of planned) {
    const group = areaGroups.get(entry.areaId) || { key: entry.areaId, label: entry.areaName, intervals: [], entries: 0 };
    group.intervals.push(entry.interval); group.entries++; areaGroups.set(entry.areaId, group);
  }
  const areas = [...areaGroups.values()].map(group => ({ key: group.key, label: group.label, hours: mergedDuration(group.intervals) / 3600000, entries: group.entries })).sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label));
  const daily = dates.map(date => { const day = dayBounds(date, timezone); return { date, hours: mergedDuration(planned.flatMap(entry => { const intersection = clip(entry.interval, day); return intersection ? [intersection] : []; })) / 3600000 }; });
  const byArea = new Map<string, { key: string; label: string; attempts: number; missed: Set<string>; rescheduled: Set<string> }>();
  const allMissed = new Set<string>(), allRescheduled = new Set<string>();
  let missedAttempts = 0;
  for (const event of events) {
    const schedule = area(event.subScheduleId), key = schedule?.id || "unassigned";
    const group = byArea.get(key) || { key, label: schedule?.name || "Unassigned", attempts: 0, missed: new Set<string>(), rescheduled: new Set<string>() };
    const seenHistory = new Set<string>();
    const history = Array.isArray(event.history) ? event.history : [];
    if (!history.length || (event.status === "requires-replanning" && !history.some(entry => entry.kind === "missed")) || (!sameSlot(event.originalSlot, event.slot) && !history.some(entry => entry.kind === "edited" || entry.kind === "rescheduled"))) warnings.add("Some events lack complete attempt history; missed/rescheduled figures are recorded evidence only.");
    for (const entry of history) {
      if (seenHistory.has(entry.id)) continue;
      seenHistory.add(entry.id);
      if (entry.kind === "edited" && entry.next && !sameSlot(entry.planned, entry.next) && instantInRange(entry.at, range, timezone) && history.some(miss => miss.kind === "missed" && Number.isFinite(Date.parse(miss.at)) && Date.parse(miss.at) <= Date.parse(entry.at) && sameSlot(miss.planned, entry.planned))) warnings.add("Some older moved edits follow missed attempts but do not identify the rescheduling flow; they were not counted as reschedules.");
      if (entry.kind !== "missed" && entry.kind !== "rescheduled") continue;
      if (!entry.at || !Number.isFinite(Date.parse(entry.at))) { warnings.add("Some attempt timestamps are missing or invalid; those actions cannot be placed in a period."); continue; }
      if (!instantInRange(entry.at, range, timezone)) continue;
      if (entry.kind === "missed") { missedAttempts++; allMissed.add(eventKey(event)); group.attempts++; group.missed.add(eventKey(event)); }
      else if (event.source.kind === "personal") {
        const priorMiss = history.some(miss => miss.kind === "missed" && miss.at && Number.isFinite(Date.parse(miss.at)) && Date.parse(miss.at) <= Date.parse(entry.at) && sameSlot(miss.planned, entry.planned));
        if (entry.next && !sameSlot(entry.planned, entry.next) && priorMiss) { allRescheduled.add(eventKey(event)); group.rescheduled.add(eventKey(event)); }
        else warnings.add("Some rescheduling history cannot be linked to a missed attempt; it was not counted as missed-event rescheduling.");
      }
    }
    if (group.attempts || group.rescheduled.size) byArea.set(key, group);
  }
  return { areas, daily, totalHours: mergedDuration(planned.map(entry => entry.interval)) / 3600000, missedAttempts, missedEvents: allMissed.size, rescheduledEvents: allRescheduled.size, attemptsByArea: [...byArea.values()].map(group => ({ key: group.key, label: group.label, attempts: group.attempts, missedEvents: group.missed.size, rescheduledEvents: group.rescheduled.size })), warnings: [...warnings] };
}

export function taskAnalytics(records: readonly Task[], ownerId: string, range: DateRange, timezone: string, now: Date) {
  const dates = rangeDays(range), tasks = uniqueTasks(records, ownerId), warnings = new Set<string>();
  if (habitDuplicateConflicts(records.filter(task => task.ownerId === ownerId)).length) warnings.add("Conflicting duplicate habit outcomes need review; occurrence totals are deduplicated and may be incomplete.");
  if (tasks.some(task => !task.createdAt || !Number.isFinite(Date.parse(task.createdAt)))) warnings.add("Some task creation timestamps are unavailable; the creation-period status cohort may be incomplete.");
  const created = tasks.filter(task => instantInRange(task.createdAt, range, timezone));
  const statuses = percentages(["active", "pending", "completed", "missed"].map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), count: created.filter(task => taskViewStatus(task, timezone, now) === key).length })));
  const completions = new Map(dates.map(date => [date, 0]));
  const days = dates.map(date => ({ date, ...dayBounds(date, timezone) }));
  for (const task of tasks) {
    if (task.status !== "completed") continue;
    if (!task.completedAt || !Number.isFinite(Date.parse(task.completedAt))) { warnings.add("Some completed tasks lack a reliable completion timestamp; completion trend excludes them and eligible deadlines are Unclassified."); continue; }
    if (instantInRange(task.completedAt, range, timezone)) {
      // The same timezone boundary logic is used for every analytic.
      const at = Date.parse(task.completedAt);
      const date = days.find(day => at >= day.start && at < day.end)?.date;
      if (date) completions.set(date, completions.get(date)! + 1);
    }
  }
  const counts = { onTime: 0, late: 0, missed: 0, overdue: 0, unclassified: 0 };
  for (const task of tasks) {
    if (!task.dueDate || task.dueDate < range.start || task.dueDate > range.end) continue;
    let deadline: number | undefined;
    try { deadline = task.dueTime ? localInstant(task.dueDate, task.dueTime, timezone) : dayBounds(task.dueDate, timezone).end - 1; } catch { /* report below */ }
    if (deadline === undefined) { warnings.add("Some deadlines could not be resolved and were excluded from deadline eligibility."); continue; }
    if (deadline >= now.getTime()) continue;
    if (task.status === "pending") counts.overdue++;
    else if (task.status === "missed") counts.missed++;
    else if (!task.completedAt || !Number.isFinite(Date.parse(task.completedAt))) counts.unclassified++;
    else if (Date.parse(task.completedAt) <= deadline) counts.onTime++;
    else counts.late++;
  }
  const deadline = percentages([{ key: "onTime", label: "Completed on time", count: counts.onTime }, { key: "late", label: "Completed late", count: counts.late }, { key: "missed", label: "Explicitly missed", count: counts.missed }, { key: "overdue", label: "Still pending and overdue", count: counts.overdue }, { key: "unclassified", label: "Unclassified", count: counts.unclassified }]);
  return { statuses, createdTotal: created.length, daily: dates.map(date => ({ date, count: completions.get(date)! })), completedTotal: [...completions.values()].reduce((sum, count) => sum + count, 0), deadline, eligibleTotal: deadline.reduce((sum, row) => sum + row.count, 0), warnings: [...warnings] };
}
