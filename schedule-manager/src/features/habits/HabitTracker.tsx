"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceButton, useWorkspaceNavigation } from "../workspace/WorkspaceNavigation";
import { developmentIdentity } from "../schedule/adapters";
import { addDays, localNow, type Student } from "../schedule/domain";
import { Dialog, Stamp } from "../schedule/Forms";
import { millisecondsToNextMinute } from "../tasks/domain";
import { HABITS_CHANGED } from "./storage";
import { TASKS_CHANGED } from "../tasks/storage";
import type { HabitOutcome } from "./outcomes";
import { rangeDays } from "../analytics/periods";
import { browserHabits } from "./browser";
import { monthRange, outcome, occurrenceActions, type Habit, type Occurrence } from "./domain";
import { HabitSummaryCards } from "./HabitSummaryCards";
import { HabitFeedback } from "./HabitFeedback";
import { Icon, ProdButton } from "../workspace/Design";
import { HabitGrid } from "./HabitGrid";
import { HabitForm } from "./HabitForm";
import { HabitReplan } from "./HabitReplan";

export function HabitTracker({ initialHabitId, initialDate, initialEdit }: { initialHabitId?: string; initialDate?: string; initialEdit?: boolean }) {
  const navigate = useWorkspaceNavigation();
  const [student, setStudent] = useState<Student>(), [clock, setClock] = useState<Date>();
  const [month, setMonth] = useState(initialDate || ""), [habits, setHabits] = useState<Habit[]>(), [items, setItems] = useState<Occurrence[]>([]), [feedbackItems, setFeedbackItems] = useState<Occurrence[]>([]);
  const [period, setPeriod] = useState<"week" | "month">("month"), [weekDate, setWeekDate] = useState("");
  const [activeHabitId, setActiveHabitId] = useState(initialHabitId);
  const [editor, setEditor] = useState<{ habit?: Habit }>(), [selected, setSelected] = useState<{ habitId: string; date: string }>(), [detail, setDetail] = useState<string>();
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [replanning, setReplanning] = useState(false);
  const saving = useRef(false), editRequested = useRef(false);
  const [correction, setCorrection] = useState<HabitOutcome>();
  const load = useCallback(async () => {
    const current = await developmentIdentity.getCurrentStudent(), now = new Date(), today = localNow(current.timezone, now).date;
    const range = monthRange(month || today);
    const records = await browserHabits.synchronize(range);
    const feedbackRange = period === "week" ? (() => { const date = weekDate || today, weekday = new Date(date + "T12:00:00Z").getUTCDay(), start = addDays(date, -((weekday + 6) % 7)); return { start, end: addDays(start, 6) }; })() : range;
    const feedbackRecords = period === "month" ? records : await browserHabits.synchronize(feedbackRange);
    setStudent(current); setClock(now); setMonth(range.start); setWeekDate(previous => previous || today); setHabits(await browserHabits.list());
    if (initialEdit && !editRequested.current) { const habit = (await browserHabits.list()).find(habit => habit.id === initialHabitId); if (habit) { editRequested.current = true; setEditor({ habit }); } } setItems(records); setFeedbackItems(feedbackRecords); setError(""); setLoading(false);
  }, [month, period, weekDate, initialEdit, initialHabitId]);
  useEffect(() => {
    const refresh = () => { void load().catch(error => { setError((error as Error).message); setLoading(false); }); };
    refresh();
    let timer: number;
    const tick = () => { refresh(); timer = window.setTimeout(tick, millisecondsToNextMinute(new Date())); };
    timer = window.setTimeout(tick, millisecondsToNextMinute(new Date()));
    const resumed = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", resumed);
    // Task writes may occur while generation is running. Queue one refresh
    // after it settles; unchanged generation performs no further writes.
    window.addEventListener(TASKS_CHANGED, refresh);
    window.addEventListener(HABITS_CHANGED, refresh);
    window.addEventListener("focus", refresh); window.addEventListener("storage", refresh);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", resumed); window.removeEventListener(TASKS_CHANGED, refresh); window.removeEventListener(HABITS_CHANGED, refresh); window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, [load]);
  async function mutate(operation: () => Promise<unknown>, message: string) {
    if (saving.current) return; saving.current = true; setBusy(true); setError(""); setNotice("");
    try { await operation(); setNotice(message); await load(); } catch (error) { setError((error as Error).message); } finally { saving.current = false; setBusy(false); }
  }
  const selectedKey = selected || (initialHabitId && initialDate ? { habitId: initialHabitId, date: initialDate } : undefined);
  const occurrence = selectedKey && items.find(item => item.habitId === selectedKey.habitId && item.date === selectedKey.date);
  const detailHabit = habits?.find(habit => habit.id === (detail || (!initialDate && initialHabitId)));
  const close = () => { if (!saving.current) { setSelected(undefined); setDetail(undefined); setReplanning(false); setCorrection(undefined); navigate({ section: "habits" }); } };
  if (!habits || !student || !clock) return <main className="loading"><h1>Habit Tracker</h1>{error ? <p role="alert" className="error">{error}</p> : <p role="status">Loading habits...</p>}<button onClick={() => void load().catch(e => setError(e.message))}>Retry loading</button><WorkspaceButton section="schedule">Schedule Manager</WorkspaceButton></main>;
  const today = localNow(student.timezone, clock).date, range = monthRange(month || today), now = localNow(student.timezone, clock);
  const currentOutcome = occurrence && outcome(occurrence);
  const outcomeChanges = occurrence?.task?.outcomeChanges || occurrence?.event?.outcomeChanges || [];
  const actions = occurrence ? occurrenceActions(occurrence, now) : { complete: false, missed: false, clear: false };
  const canMiss = actions.missed, canComplete = actions.complete;
  const activeHabit = habits.find(habit => habit.id === activeHabitId) || habits[0];
  const openOccurrence = (item: Occurrence) => { setSelected({ habitId: item.habitId, date: item.date }); setError(""); };
  return <div className="module-view habits-module"><main className="content">
    <div className="page-heading"><div><p className="eyebrow">BUILD YOUR RHYTHM</p><h1>Habit Tracker</h1><p className="muted">Small steps. Meaningful progress. Build a rhythm that works for you.</p></div><ProdButton className="primary" disabled={busy} onClick={() => setEditor({})}><Icon name="plus"/> Add habit</ProdButton></div>
    {error && <p className="error" role="alert">{error} <button onClick={() => void load().catch(e => setError(e.message))}>Retry loading</button></p>}{notice && <p className="notice" role="status">{notice}</p>}{busy && <p role="status">Saving...</p>}
    {initialHabitId && !habits.some(habit => habit.id === initialHabitId) && <p className="notice" role="status">The originating habit definition is unavailable for this student. Existing linked task or event records have been preserved; no repeating settings were inferred.</p>}
    <HabitSummaryCards habits={habits} occurrences={items} now={now} activeHabitId={activeHabit?.id} onSelect={setActiveHabitId} onEdit={id => { const habit = habits.find(item => item.id === id); if (habit) setEditor({ habit }); }}/>
    <div className="habit-calendar-layout">
      <section className="habit-calendar-panel" aria-label="Habit calendar">
        <div className="habit-calendar-heading">
          <h2>{activeHabit ? `${activeHabit.revisions.at(-1)!.name} Attendance Calendar` : "Habit calendar"}</h2>
          <div className="habit-month-nav"><button type="button" aria-label="Previous month" onClick={() => setMonth(monthRange(addDays(range.start, -1)).start)}>‹</button><span aria-live="polite">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(range.start + "T12:00:00Z"))}</span><button type="button" aria-label="Next month" onClick={() => setMonth(addDays(range.end, 1))}>›</button></div>
        </div>
        <div className="habit-calendar-legend" aria-label="Calendar legend"><span><i className="legend-completed"/>Completed</span><span><i className="legend-missed"/>Missed</span><span><i className="legend-unscheduled"/>Not scheduled</span><span><i className="legend-unrecorded"/>Unrecorded / upcoming</span><span><i className="legend-review"/>Needs review</span></div>
        {!activeHabit ? <div className="empty"><h2>No habits yet</h2><p>Add a daily habit or choose the weekdays that work for you.</p></div> : <HabitGrid habit={activeHabit} dates={rangeDays(range)} occurrences={items} today={today} onOpen={openOccurrence} />}
        {activeHabit && !items.some(item => item.habitId === activeHabit.id) && <p className="hint">No occurrences scheduled for this habit in the selected month.</p>}
        <div className="habit-calendar-footer"><span>Choose a date to view its occurrence.</span><button type="button" onClick={() => setMonth(monthRange(today).start)}>Current month</button></div>
      </section>
      {activeHabit && <HabitFeedback habit={activeHabit} habits={habits} occurrences={feedbackItems} monthOccurrences={items} now={now} period={period} weekDate={weekDate} showToday={today >= range.start && today <= range.end} onPeriod={setPeriod} onWeekDate={setWeekDate} onOpen={openOccurrence} onRule={setDetail}/>}
    </div>
    <footer className="page-footer">Browser persistence · No account sync</footer>
  </main>
  {editor && <HabitForm timezone={student.timezone} habit={editor.habit} onClose={() => setEditor(undefined)} onSave={async input => { await browserHabits.save(input, editor.habit?.id); setNotice("Habit saved. Changes to unrecorded occurrences apply from today."); await load().catch(error => setError(`Habit settings were saved, but generated occurrences could not be refreshed: ${error.message}. Retry loading; do not create the habit again.`)); }} />}
  {detailHabit && !editor && <Dialog title={detailHabit.revisions.at(-1)!.name} onClose={close}><div className="detail"><p>{detailHabit.revisions.at(-1)!.description || "No description"}</p><dl><dt>Type</dt><dd>{detailHabit.revisions.at(-1)!.type}</dd><dt>Frequency</dt><dd>{detailHabit.revisions.at(-1)!.frequency === "daily" ? "Daily" : detailHabit.revisions.at(-1)!.weekdays.map(day => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")}</dd><dt>Time</dt><dd>{detailHabit.revisions.at(-1)!.time || "No completion deadline"}{detailHabit.revisions.at(-1)!.type === "event" ? `–${detailHabit.revisions.at(-1)!.end}` : ""}</dd><dt>Priority</dt><dd>{detailHabit.revisions.at(-1)!.priority}</dd><dt>Start date</dt><dd>{detailHabit.revisions.at(-1)!.startDate || detailHabit.createdDate}</dd><dt>End date</dt><dd>{detailHabit.revisions.at(-1)!.endDate || "No end date"}</dd></dl><p>Latest settings take effect {detailHabit.revisions.at(-1)!.effectiveDate}. {detailHabit.revisions.at(-1)!.archived ? "Archived from that date; earlier history remains." : "Enabled from that date."}</p><div className="detail-actions"><button disabled={busy} onClick={() => { setEditor({ habit: detailHabit }); }}>Edit habit</button><button disabled={busy} onClick={() => void mutate(() => browserHabits.archive(detailHabit.id, !detailHabit.revisions.at(-1)!.archived), "Repeating settings updated from today. Past records preserved.")}>{detailHabit.revisions.at(-1)!.archived ? "Restore habit" : "Archive habit"}</button></div><details><summary>Settings history</summary>{detailHabit.revisions.map((revision, index) => <p key={index}>{revision.effectiveDate}: {revision.name}, {revision.type}, {revision.frequency}, {revision.time}{revision.end && revision.type === "event" ? `–${revision.end}` : ""}, {revision.archived ? "archived" : "enabled"} · <Stamp value={revision.at} timezone={student.timezone} /></p>)}</details></div></Dialog>}
  {occurrence && !replanning && <Dialog title={occurrence.task?.title || occurrence.event?.title || occurrence.settings.name} onClose={close}><div className="detail"><p>{occurrence.task?.description || occurrence.event?.description || occurrence.settings.description || "No description"}</p><dl><dt>Original date</dt><dd>{occurrence.date}</dd><dt>Scheduled time</dt><dd>{occurrence.task?.dueTime || (occurrence.event ? `${occurrence.event.originalSlot.start}–${occurrence.event.originalSlot.end}` : "No completion deadline")}</dd><dt>Outcome</dt><dd>{currentOutcome === "unrecorded" ? "No outcome recorded" : currentOutcome}</dd>{occurrence.event && <><dt>Current event time</dt><dd>{occurrence.event.slot.date} · {occurrence.event.slot.start}–{occurrence.event.slot.end}</dd></>}</dl>{(occurrence.task?.completedAt || occurrence.event?.completedAt) && <p>Completed: <Stamp value={(occurrence.task?.completedAt || occurrence.event?.completedAt)!} timezone={student.timezone} /></p>}{(occurrence.task?.missedAt || (occurrence.event?.outcomeChanges?.length ? occurrence.event.outcomeChanges.at(-1)?.to.missedAt : occurrence.event?.history.filter(entry => entry.kind === "missed").at(-1)?.at)) && <p>Missed outcome recorded: <Stamp value={(occurrence.task?.missedAt || (occurrence.event?.outcomeChanges?.length ? occurrence.event.outcomeChanges.at(-1)?.to.missedAt : occurrence.event?.history.filter(entry => entry.kind === "missed").at(-1)?.at))!} timezone={student.timezone} /></p>}
    {currentOutcome === "review" && <p className="notice">This event was rescheduled and then completed. Its outcome and timestamps are retained; grid-date credit and feedback completion credit require review.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="detail-actions">
      {canComplete && <button className="primary" disabled={busy} onClick={() => { if (currentOutcome !== "unrecorded") setCorrection("completed"); else void mutate(() => browserHabits.record(occurrence.habitId, occurrence.date, "completed"), "Completion saved."); }}>{currentOutcome === "unrecorded" ? "Complete" : "Change to Completed"}</button>}
      {canMiss && <button className="danger" disabled={busy} onClick={() => { if (currentOutcome !== "unrecorded") setCorrection("missed"); else void mutate(() => browserHabits.record(occurrence.habitId, occurrence.date, "missed"), "Missed outcome saved."); }}>{currentOutcome === "unrecorded" ? "Mark missed" : "Change to Missed"}</button>}
      {actions.clear && <button disabled={busy} onClick={() => setCorrection("pending")}>Clear outcome</button>}
      {occurrence.event?.status === "requires-replanning" && <button disabled={busy} onClick={() => setReplanning(true)}>Replan event</button>}
      {occurrence.task && <WorkspaceButton section="tasks" taskId={occurrence.task.id}>Open linked task</WorkspaceButton>}
    </div>
    {correction && <div className="notice habit-outcome-correction" role="group" aria-label="Confirm outcome correction"><p>Change this occurrence to {correction === "pending" ? "Unrecorded" : correction}? Its previous outcome and timestamps remain in the audit trail.</p><button disabled={busy} onClick={() => setCorrection(undefined)}>Cancel correction</button><button disabled={busy} onClick={() => void mutate(async () => { await browserHabits.record(occurrence.habitId, occurrence.date, correction); setCorrection(undefined); }, "Outcome corrected on the shared record.")}>Confirm correction</button></div>}
    {occurrence.date > today && <p className="hint">Future occurrence: outcome recording is unavailable.</p>}
    {outcomeChanges.length > 0 && <details className="habit-outcome-history"><summary>Outcome correction history</summary>{outcomeChanges.map(change => <p key={change.id}>{change.from.status} to {change.to.status} at <Stamp value={change.at} timezone={student.timezone} />{change.from.completedAt && <> (previous completion: <Stamp value={change.from.completedAt} timezone={student.timezone} />)</>}{change.from.missedAt && <> (previous miss: <Stamp value={change.from.missedAt} timezone={student.timezone} />)</>}</p>)}</details>}
</div></Dialog>}
  {occurrence?.event && replanning && <HabitReplan event={occurrence.event} onClose={() => setReplanning(false)} onSave={async (slot, options) => { await browserHabits.replan(occurrence.event!, slot, options); await load(); setReplanning(false); setNotice("Event replanned. The original missed attempt remains in history."); }} />}
  {loading && <span role="status">Loading...</span>}
  </div>;
}
