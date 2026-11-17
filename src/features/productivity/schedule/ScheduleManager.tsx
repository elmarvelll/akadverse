"use client";
import { RefreshIndicator } from "../workspace/RefreshIndicator";
import { productivityErrorMessage } from "../errors";
import { WorkspaceButton, useWorkspaceNavigation } from "../workspace/WorkspaceNavigation";
import { Icon, ProdButton } from "../workspace/Design";
import { Timetable } from "./ScheduleTimetable";
import { scheduleDates, taskTimetableEntries, selectTimetableEvents, slotTouchesDates, timetableSourceDates, type TimetableEntry } from "./timetable";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useWorkspaceSnapshot, useSectionActive } from "../workspace/queries";
import {
  addDays,
  localNow,
  ScheduleService,
  scheduleConflicts,
  type Dataset,
  type OfficialClass,
  type PersonalEvent,
  type SubSchedule,
} from "./domain";
import { remoteSchedule, rpc, peekStudent, invalidateWorkspace } from "../client";
import { Dialog, EventForm, ScheduleForm, Stamp, formatDate } from "./Forms";
import { HabitBadge, HabitRecurrence } from "../habits/HabitLabel";
import { eventOutcome } from "../habits/domain";
import { EventBackup } from "./EventBackup";
const AnalyticsPanel = dynamic(() => import("../analytics/AnalyticsPanel").then(module => module.AnalyticsPanel));
export function ScheduleManager({ initialEventId, initialDate }: { initialEventId?: string; initialDate?: string } = {}) {
  const selectWorkspace = useWorkspaceNavigation();
  const [timeView, setTimeView] = useState<"day" | "week">("week");
  const [analytics, setAnalytics] = useState(false);
  const [service] = useState<Pick<ScheduleService, "getCurrentStudent" | "load" | "getOfficialClasses" | "saveSubSchedule" | "saveEvent" | "archiveEvent" | "recordMissedAttempt">>(
    () =>
      remoteSchedule,
  );
  const [date, setDate] = useState(initialDate || localNow(peekStudent()?.timezone || "Africa/Lagos").date),
    [classes, setClasses] = useState<OfficialClass[]>([]),
    [classError, setClassError] = useState(""),
    [classLoading, setClassLoading] = useState(false),
    [retry, changeRetry] = useState(0);
  const setRetry = (update: (value: number) => number) => { invalidateWorkspace(["official"]); changeRetry(update); };
  const [view, setView] = useState("main"),
    [focus, setFocus] = useState(false),
    [history, setHistory] = useState(false);
  const [editor, setEditor] = useState<{ event?: PersonalEvent } | null>(null),
    [scheduleEditor, setScheduleEditor] = useState<{
      schedule?: SubSchedule;
    } | null>(null);
  const [detailId, setDetailId] = useState<string | undefined>(initialEventId),
    [official, setOfficial] = useState<OfficialClass>(),
    [archiveId, setArchiveId] = useState<string>();
  const [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const active = useSectionActive();
  const rangeDates = scheduleDates(date, timeView), rangeStart = rangeDates[0], rangeEnd = rangeDates.at(-1) || date;
  const { snapshot, setSnapshot, error: loadError, refreshing, loadingAdditional, refresh: load } = useWorkspaceSnapshot({ section: "schedule", start: rangeStart, end: rangeEnd, history, page: historyPage, categoryId: !["main", "habits", "academic"].includes(view) ? view : undefined, eventId: initialEventId });
  const data = snapshot?.data.schedule, student = snapshot?.student, habitRules = snapshot?.data.habits.habits || [], loading = !data || !student;
  const setData = (updated: Dataset) => setSnapshot(previous => previous ? { ...previous, data: { ...previous.data, schedule: updated } } : previous);
  const previousLink = useRef("");
  useEffect(() => {
    const key = JSON.stringify([initialEventId, initialDate]);
    if (!active || previousLink.current === key) return;
    previousLink.current = key;
    void Promise.resolve().then(() => { if (initialDate) setDate(initialDate); setDetailId(initialEventId); });
  }, [initialEventId, initialDate, active]);
  useEffect(() => {
    if (!active || history || !rangeStart || !student) return;
    let current = true;
    const dates = timetableSourceDates(scheduleDates(rangeStart, timeView));
    void Promise.resolve().then(() => { if (current) { setClassLoading(true); setClassError(""); } });
    void rpc<{ rows: OfficialClass[]; failedDates: string[]; error: string }>("official.range", [{ start: dates[0], end: dates.at(-1)! }]).then(result => {
      if (current) { setClasses(result.rows); setClassError(result.failedDates.length ? result.error + " Personal and habit events remain available." : ""); }
    }).catch(error => { if (current) setClassError(productivityErrorMessage(error)); }).finally(() => { if (current) setClassLoading(false); });
    return () => { current = false; };
  }, [active, history, rangeStart, timeView, student, retry, snapshot?.serverTime]);
  const [analyticsData, setAnalyticsData] = useState<Dataset>(), [analyticsError, setAnalyticsError] = useState("");
  const [analyticsRetry, setAnalyticsRetry] = useState(0);
  useEffect(() => {
    if (!active || !analytics) return;
    let current = true;
    void service.load().then(value => { if (current) { setAnalyticsData(value); setAnalyticsError(""); } }).catch(error => { if (current) setAnalyticsError(productivityErrorMessage(error)); });
    return () => { current = false; };
  }, [analytics, active, service, analyticsRetry, snapshot?.serverTime]);
  async function action(operation: () => Promise<Dataset>) {
    setSaving(true);

    setNotice("");
    try {
      setData(await operation());

      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }
  if (loading && !loadError)
    return (
      <main className="loading" aria-live="polite">
        <div className="brand-mark">P</div>
        <h1>Loading your schedule…</h1>
      </main>
    );
  if (!data || !student)
    return (
      <main className="loading">
        <h1>Your schedule couldn’t be loaded</h1>
        <p role="alert" className="error">
          {loadError}
        </p>
        <p>
          Saved data has not been replaced. Resolve storage access or recover
          the saved records before continuing.
        </p>
        <button className="primary" onClick={() => void load()}>
          Retry loading
        </button>
      </main>
    );
  const schedules = data.schedules.filter((s) => s.ownerId === student.id),
    current = schedules.find((s) => s.id === view),
    own = data.events.filter((e) => e.ownerId === student.id);
  const sourceTasks = new Map((snapshot?.data.tasks.tasks || []).map(task => [task.id, task]));
  const calendarData = { ...data, events: data.events.filter(event => {
    if (event.source.kind !== "task") return true;
    const task = sourceTasks.get(event.source.taskId);
    return !!task && !task.deletedAt && !task.habitWithdrawn && !task.scheduledSlot;
  }) };
  const filteredEvents = history
    ? own.filter((e) => !current || e.subScheduleId === current.id)
    : selectTimetableEvents(calendarData, student.id, rangeDates, { scheduleId: current?.id, focus });
  const events = view === "habits" ? filteredEvents.filter(e => e.source.kind === "habit") : view === "academic" ? filteredEvents.filter(e => schedules.some(s => s.academic && s.id === e.subScheduleId)) : filteredEvents;
  const visibleClasses =
    !history && !focus && (view === "main" || view === "academic" || current?.academic)
      ? classes.filter(
          (c) =>
            slotTouchesDates(c.slot, rangeDates) &&
            c.state === "scheduled" &&
            c.registrationState === "registered",
        )
      : [];
  const selectedOfficial = official || classes.find(item => item.id === initialEventId);
  const selected = own.find((e) => e.id === detailId),
    now = localNow(student.timezone);
  const overdue = (e: PersonalEvent) =>
    e.status === "pending" &&
    !e.archivedAt &&
    e.slot.date + e.slot.end < now.date + now.time;
  const title =
    view === "main"
      ? "Main schedule"
      : view === "academic"
        ? "Academics"
        : view === "habits" ? "Habit occurrences" : current?.name || "Main schedule";
  const conflicts = history || analytics ? new Map() as ReturnType<typeof scheduleConflicts> : scheduleConflicts(calendarData.events.filter(e => rangeDates.includes(e.slot.date)), classes.filter(c => rangeDates.includes(c.slot.date)), student.id);
  const scheduledTaskEntries = !history && !focus && view === "main" ? taskTimetableEntries(snapshot?.data.tasks.tasks || [], student.id, student.timezone, rangeDates) : [];
  const timelineEntries: TimetableEntry[] = history || analytics ? [] : [...scheduledTaskEntries,...events.filter(event => !event.archivedAt).map(event => {
    const task = event.source.kind === "task" ? sourceTasks.get(event.source.taskId) : undefined;
    return { id: task ? `task:${task.id}` : event.id, taskId: task?.id, title: task?.title || event.title, slot: event.slot,
      kind: event.source.kind === "habit" ? "habit" as const : event.source.kind === "task" ? "task" as const : "personal" as const,
      category: schedules.find(schedule => schedule.id === event.subScheduleId)?.name || (event.source.kind === "habit" ? "Habit" : task ? "Task" : "Event"),
      priority: task?.priority || event.priority, outcome: task ? task.status === "pending" ? "unrecorded" : task.status : eventOutcome(event) };
  }), ...visibleClasses.map(item => ({ id: item.id, title: item.courseCode + " \u00b7 " + item.courseName, slot: item.slot, kind: "academic" as const, category: "Academics", venue: item.venue }))];
  function createEvent() {
    if (!schedules.length) {
      setNotice("Create a sub-category first, then create an event and select it.");
      setScheduleEditor({});
    } else setEditor({});
  }
  const navigate = (id: string) => {
    setView(id);
    setHistory(false);
  };
  return (
    <div className="module-view schedule-module"><main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
              <h1>{analytics ? "Schedule analytics" : title}</h1>
              <p className="muted">
                {analytics ? "Planned time and recorded attempts across all life areas." : current?.description ||
                  (view === "academic"
                    ? "Read-only timetable sessions from your approved course registration."
                    : "Your classes, plans, and personal commitments in one place.")}
              </p>
            </div>
            {!analytics && <div className="heading-actions">
              {current && (
                <button
                  onClick={() => setScheduleEditor({ schedule: current })}
                >
                  Edit sub-category
                </button>
              )}
              <ProdButton className="primary" onClick={createEvent}><Icon name="plus"/> Create event</ProdButton>
            </div>}
          </div>
          <div className="analytics-view-switch" role="group" aria-label="Schedule view"><button type="button" aria-pressed={!analytics} onClick={() => setAnalytics(false)}>Schedule</button><button type="button" aria-pressed={analytics} onClick={() => setAnalytics(true)}>Analytics</button></div>
          {loadError && <p className="error" role="alert">{loadError} <button onClick={() => void load()}>Retry loading</button></p>}
          <RefreshIndicator active={refreshing || loadingAdditional || (!analytics && !history && classLoading)} label={loadingAdditional ? "Loading this date range..." : "Refreshing schedule..."}/>
          {analytics ? analyticsData ? <AnalyticsPanel kind="schedule" student={student} data={analyticsData} academic={service} /> : <section role="status">{analyticsError || "Loading schedule analytics..."}{analyticsError && <button onClick={() => setAnalyticsRetry(value => value + 1)}>Retry analytics</button>}</section> : <>
          <section className="schedule-panel" aria-label="Schedule">
            <div className="category-filters" role="group" aria-label="Sub-category filters">
              <button aria-pressed={view === "main"} onClick={() => navigate("main")}>All</button>
              <button aria-pressed={view === "academic"} onClick={() => navigate("academic")}>Academics</button>
              {schedules.map(s => <button key={s.id} aria-pressed={view === s.id} onClick={() => navigate(s.id)}>{s.name.toLowerCase() === "academics" ? `${s.name} (category)` : s.name}</button>)}
              <button onClick={() => setScheduleEditor({})}>＋ New sub-category</button>
            </div>
            <div className="panel-toolbar">
              <div className="tabs">
                <button
                  className={"tab " + (!history ? "active" : "")}
                  onClick={() => { setHistory(false); setHistoryPage(0); }}
                >
                  Schedule
                </button>
                <button
                  className={"tab " + (history ? "active" : "")}
                  onClick={() => { setHistory(true); setHistoryPage(0); }}
                >
                  History
                </button>
              </div>
              <label className="focus-toggle">
                <input
                  type="checkbox"
                  checked={focus}
                  disabled={history}
                  onChange={(e) => setFocus(e.target.checked)}
                />
                ◎ Focus Mode
              </label>
            </div>
            {!history && (
              <>
                <div className="date-toolbar">
                  <div>
                    <h2>{timeView === "week" ? `${formatDate(rangeStart)} to ${formatDate(rangeEnd)}` : formatDate(date, true)}</h2>
                    <p className="hint">
                      {student.timezone} ·{" "}
                      {focus
                        ? "Only explicit must-complete commitments"
                        : timeView === "week" ? "Your week at a glance" : "One day, a little more intention"}
                    </p>
                  </div>
                  <div className="date-controls">
                    <button
                      aria-label={timeView === "week" ? "Previous week" : "Previous day"}
                      onClick={() => setDate(addDays(date, timeView === "week" ? -7 : -1))}
                    >
                      ‹
                    </button>
                    <button onClick={() => setDate(now.date)}>Today</button>
                    <label className="sr-only" htmlFor="selected-date">
                      Selected date
                    </label>
                    <input
                      id="selected-date"
                      type="date"
                      value={date}
                      onChange={(e) => {
                        if (e.target.value) setDate(e.target.value);
                      }}
                    />
                    <button
                      aria-label={timeView === "week" ? "Next week" : "Next day"}
                      onClick={() => setDate(addDays(date, timeView === "week" ? 7 : 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="timetable-view-toggle" role="group" aria-label="Timetable range"><button type="button" aria-pressed={timeView === "day"} onClick={() => setTimeView("day")}>Day</button><button type="button" aria-pressed={timeView === "week"} onClick={() => setTimeView("week")}>Week</button></div>
              </>
            )}
            {history && (
              <div className="history-intro">
                <h2>Event history</h2>
                <p className="muted">
                  All dates · Open an event to review its original plan, edits,
                  and outcomes. Archived records are retained.
                </p>
              </div>
            )}
            {notice && (
              <p className="success banner" role="status">
                {notice}
              </p>
            )}
            {!history && classError && (
              <p className="error banner" role="alert">
                Academic data couldn’t be loaded: {classError}{" "}
                <button onClick={() => setRetry((x) => x + 1)}>
                  Retry classes
                </button>
              </p>
            )}
            {!history && !classLoading && !classError && !timelineEntries.length && <p className="timetable-empty-note" role="status">{focus ? "No must-complete activities in this date range." : "No activities scheduled in this view. Choose another date or create an event."}</p>}
            {!history && <div className="schedule-legend" aria-label="Schedule activity colours"><span className="legend-task">Tasks</span><span className="legend-habit">Habits</span><span className="legend-event">Events</span><span className="legend-academic">Official classes</span></div>}
            {!history && <Timetable entries={timelineEntries} dates={rangeDates} today={now.date} currentTime={now.time} selectedDate={date} conflicts={conflicts} onDate={setDate} onOpen={entry => { if (entry.taskId) selectWorkspace({ section: "tasks", taskId: entry.taskId }); else if (entry.kind === "academic") setOfficial(classes.find(item => item.id === entry.id)); else setDetailId(entry.id); }}/> }
            {history && <div className="event-list" aria-busy={saving}>
              {visibleClasses.map((c) => (
                <article className="event-card official" key={c.id}>
                  <div className="event-time">
                    <strong>{c.slot.start}</strong>
                    <span>{c.slot.end}</span>
                  </div>
                  <div className="event-info">
                    <div className="badges">
                      <span className="badge blue">
                        🎓 Official class
                      </span>
                      <span className="badge">Read-only</span>
                    </div>
                    <h3>
                      <button
                        className="title-button"
                        onClick={() => setOfficial(c)}
                      >
                        {c.courseCode} — {c.courseName}
                      </button>
                    </h3>
                    <p>{c.venue}</p>
                    {!!conflicts.get(c.id)?.length && <p className="conflict-warning" role="status">Time conflict: {conflicts.get(c.id)!.map(item => item.title + " (" + item.slot.start + "–" + item.slot.end + ")").join(", ")}</p>}
                  </div>
                  <button className="quiet" onClick={() => setOfficial(c)}>
                    View details →
                  </button>
                </article>
              ))}
              {events
                .sort((a, b) =>
                  history
                    ? b.updatedAt.localeCompare(a.updatedAt)
                    : a.slot.start.localeCompare(b.slot.start),
                )
                .map((e) => (
                  <article
                    key={e.id}
                    className={
                      "event-card " +
                      (e.status === "completed" ? "completed" : "")
                    }
                  >
                    <div className="event-time">
                      <strong>{e.slot.start}</strong>
                      <span>{e.slot.end}</span>
                      {history && <small>{formatDate(e.slot.date)}</small>}
                    </div>
                    <div className="event-info">
                      <div className="badges">
                        {e.source.kind === "habit" ? <HabitBadge /> : <span className="badge">{e.source.kind === "task" ? "Task" : "Event"}</span>}
                        <span className={"badge priority-" + e.priority}>
                          {e.priority} priority
                        </span>
                        {e.mustComplete && (
                          <span className="badge purple">◎ Must complete</span>
                        )}
                        {e.archivedAt && (
                          <span className="badge">Archived</span>
                        )}
                        {e.status === "completed" && (
                          <span className="badge green">✓ Completed</span>
                        )}
                        {e.status === "requires-replanning" && <span className="badge amber">Missed · Replanning needed</span>}
                        {overdue(e) && (
                          <span className="badge amber">Awaiting outcome</span>
                        )}
                      </div>
                      <h3>
                        <button
                          className="title-button"
                          onClick={() => setDetailId(e.id)}
                        >
                          {e.title}
                        </button>
                      </h3>
                      <p>
                        {schedules.find((s) => s.id === e.subScheduleId)
                          ?.name || "Personal schedule"}
                        {current ? " · " + e.description : ""}
                      </p>
                      {!history && !!conflicts.get(e.id)?.length && <p className="conflict-warning" role="status">Time conflict: {conflicts.get(e.id)!.map(item => item.title + " (" + item.slot.start + "–" + item.slot.end + ")").join(", ")}</p>}
                    </div>
                    <div className="card-actions">
                      <button
                        className="quiet"
                        onClick={() => setDetailId(e.id)}
                      >
                        Details →
                      </button>
                    </div>
                  </article>
                ))}
              {!events.length && !visibleClasses.length && !classLoading && (
                <div className="empty">
                  <span className="empty-icon">{focus ? "◎" : "▦"}</span>
                  <h3>
                    {history
                      ? "No history yet"
                      : focus
                        ? "No must-complete events on this day"
                        : own.length
                          ? "Nothing scheduled for this day"
                          : "Make space for your first plan"}
                  </h3>
                  <p>
                    {history
                      ? "Created events and their outcomes will appear here."
                      : focus
                        ? "Mark a personal event as must complete for this date to see it here."
                        : "Create an event, or choose another date to see your commitments."}
                  </p>
                  {!history && (
                    <button onClick={createEvent}>
                      ＋ Create event
                    </button>
                  )}
                </div>
              )}
            </div>}
          </section>
          </>}
          <footer className="page-footer">
            <span>AkadVerse account · Registered timetable</span>
            <span>Stored in this browser · No account sync</span>
          </footer>
        </main>
      {editor && (
        <EventForm
          event={editor.event}
          date={editor.event?.status === "requires-replanning" && date < now.date ? now.date : date}
          student={student}
          schedules={schedules}
          defaultScheduleId={current?.id}
          onClose={() => setEditor(null)}
          onSave={async (input, eventId, scheduling) => {
            const updated = await service.saveEvent(input, eventId, undefined, scheduling);
            const saved = updated.events.find(e => e.id === eventId) || updated.events.at(-1)!;
            setData(updated);
            setDate(saved.slot.date);
          }}
        />
      )}
      {scheduleEditor && (
        <ScheduleForm
          schedule={scheduleEditor.schedule}
          onClose={() => setScheduleEditor(null)}
          onSave={async (name, description, id, academic) => {
            setData(await service.saveSubSchedule(name, description, id, academic));

          }}
        />
      )}
      {selected && (
        <Dialog title={selected.title} onClose={() => setDetailId(undefined)}>
          <div className="detail">
            {selected.source.kind === "habit" && <><HabitBadge /><HabitRecurrence recordedAt={selected.history.find(entry => entry.kind === "completed" || entry.kind === "missed")?.at} snapshot={selected.habitSettings} habit={habitRules.find(habit => selected.source.kind === "habit" && habit.id === selected.source.habitId)} date={selected.originalSlot.date} /></>}
            <p className="muted">
              {selected.source.kind === "habit"
                ? "Habit-linked event"
                : selected.source.kind === "task" ? "Task" : "Personal event"}{" "}
              · {selected.status}
              {selected.archivedAt ? " · Archived" : ""}
            </p>
            <p className="description">{selected.description}</p>
            {notice && <p className="notice" role="status">{notice}</p>}
            {selected.status === "requires-replanning" && <p className="notice">The missed attempt is preserved. Replan this event at a new time.</p>}
            <dl>
              <dt>Scheduled</dt>
              <dd>
                {formatDate(selected.slot.date, true)} · {selected.slot.start}–
                {selected.slot.end}
              </dd>
              <dt>Outcome</dt><dd>{eventOutcome(selected)}</dd>
              <dt>Priority</dt>
              <dd>{selected.priority}</dd>
              <dt>Must complete</dt>
              <dd>
                {selected.mustComplete
                  ? selected.focusDate
                  : "No day commitment"}
              </dd>
              <EventBackup event={selected} />
              <dt>Original plan</dt>
              <dd>
                {selected.originalSlot.date} · {selected.originalSlot.start}–
                {selected.originalSlot.end}
              </dd>
              {selected.completedAt && (
                <>
                  <dt>Completed at</dt>
                  <dd>
                    <Stamp
                      value={selected.completedAt}
                      timezone={student.timezone}
                    />
                  </dd>
                </>
              )}
            </dl>
            <h3>History</h3>
            <ol className="timeline">
              {selected.history.map((h) => (
                <li key={h.id}>
                  <strong>{h.kind}</strong>
                  <span>
                    <Stamp value={h.at} timezone={student.timezone} />
                  </span>
                  <p>
                    Plan: {h.planned.date} · {h.planned.start}–{h.planned.end}
                    {h.mustComplete ? " · Must complete" : ""}
                    {h.next
                      ? " → " +
                        h.next.date +
                        " · " +
                        h.next.start +
                        "–" +
                        h.next.end
                      : ""}
                  </p>
                </li>
              ))}
            </ol>
            {selected.source.kind !== "personal" && <p className="notice">Imported activity: manage its fields and outcomes in the originating section. <WorkspaceButton section={selected.source.kind === "habit" ? "habits" : "tasks"} habitId={selected.source.kind === "habit" ? selected.source.habitId : undefined} occurrenceDate={selected.source.kind === "habit" ? selected.originalSlot.date : undefined}>Open originating section</WorkspaceButton>{selected.source.kind === "habit" && <> <WorkspaceButton section="habits" habitId={selected.source.habitId} editHabit>Edit habit</WorkspaceButton></>}</p>}
            {selected.source.kind === "personal" && <div className="detail-actions">
              {selected.archivedAt ? (
                <button
                  disabled={saving}
                  onClick={() =>
                    void action(
                      () => service.archiveEvent(selected.id, true)
                    )
                  }
                >
                  Restore event
                </button>
              ) : (
                <>
                  <button
                    className="danger"
                    disabled={saving}
                    onClick={() => {
                      setArchiveId(selected.id);
                      setDetailId(undefined);
                    }}
                  >
                    Archive event
                  </button>
                  {selected.status !== "completed" && (
                    <>
                      <button
                        onClick={() => {
                          setEditor({ event: selected });
                          setDetailId(undefined);
                        }}
                      >
                        {selected.status === "requires-replanning" ? "Replan event" : "Edit event / set backup"}
                      </button>
                      <p className="hint">Completion is managed in the activity’s own tracker.</p>
                    </>
                  )}
                </>
              )}
            </div>}
          </div>
        </Dialog>
      )}
      {selectedOfficial && (
        <Dialog
          title={selectedOfficial.courseCode + " — " + selectedOfficial.courseName}
          onClose={() => { setOfficial(undefined); if (initialEventId) selectWorkspace({ section: "schedule" }); }}
        >
          <div className="detail">
            <p className="notice">
              Official class · Registered timetable · Read-only
            </p>
            <dl>
              <dt>Date</dt>
              <dd>{formatDate(selectedOfficial.slot.date, true)}</dd>
              <dt>Time</dt>
              <dd>
                {selectedOfficial.slot.start}–{selectedOfficial.slot.end}
              </dd>
              <dt>Lecturer</dt>
              <dd>{selectedOfficial.lecturer}</dd>
              <dt>Venue</dt>
              <dd>{selectedOfficial.venue}</dd>
              <dt>Semester</dt>
              <dd>{selectedOfficial.semester}</dd>
              <dt>Class group</dt>
              <dd>{selectedOfficial.classGroup}</dd>
              <dt>Source identifier</dt>
              <dd>{selectedOfficial.sourceId}</dd>
            </dl>
            <p className="muted">
              Your registered courses determine which timetable sessions appear
              here. Personal operations cannot alter this record.
            </p>
            <button onClick={() => {
              setOfficial(undefined);
              createEvent();
              setNotice(`Create a personal catch-up for ${selectedOfficial.courseCode}. The official lecture stays in place.`);
            }}>Plan a personal catch-up</button>
          </div>
        </Dialog>
      )}
      {archiveId && (
        <Dialog
          title="Archive this personal event?"
          onClose={() => {
            if (!saving) setArchiveId(undefined);
          }}
        >
          <div className="detail">
            <p>
              This removes this one event from active schedules. Its original
              plan, completion records, and history stay available in History,
              where you can restore it. No other event or sub-category is
              removed.
            </p>
            <footer className="dialog-footer">
              <button disabled={saving} onClick={() => setArchiveId(undefined)}>
                Cancel
              </button>
              <button
                className="danger"
                disabled={saving}
                onClick={async () => {
                  if (
                    await action(
                      () => service.archiveEvent(archiveId)
                    )
                  )
                    setArchiveId(undefined);
                }}
              >
                {saving ? "Archiving…" : "Archive event"}
              </button>
            </footer>
          </div>
        </Dialog>
      )}
    </div>
  );
}
