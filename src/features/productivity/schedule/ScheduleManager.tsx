"use client";
import { productivityErrorMessage } from "../errors";
import { WorkspaceButton, useWorkspaceNavigation } from "../workspace/WorkspaceNavigation";
import { Icon, ProdButton } from "../workspace/Design";
import { Timetable } from "./ScheduleTimetable";
import { scheduleDates, selectTimetableEvents, slotTouchesDates, timetableSourceDates, type TimetableEntry } from "./timetable";
import { useCallback, useEffect, useState } from "react";
import {
  addDays,
  localNow,
  ScheduleService,
  scheduleConflicts,
  type Dataset,
  type OfficialClass,
  type PersonalEvent,
  type Student,
  type SubSchedule,
} from "./domain";
import { STORAGE_KEY } from "./storage";
import { remoteSchedule } from "../client";
import { Dialog, EventForm, ScheduleForm, Stamp, formatDate } from "./Forms";
import { HabitBadge, HabitRecurrence } from "../habits/HabitLabel";
import { eventOutcome, type Habit } from "../habits/domain";
import { HABITS_CHANGED, HABIT_STORAGE_KEY } from "../habits/storage";
import { browserHabits } from "../habits/browser";
import { EventBackup } from "./EventBackup";
import { AnalyticsPanel } from "../analytics/AnalyticsPanel";
export function ScheduleManager({ initialEventId, initialDate }: { initialEventId?: string; initialDate?: string } = {}) {
  const selectWorkspace = useWorkspaceNavigation();
  const [habitRules, setHabitRules] = useState<Habit[]>([]);
  const [timeView, setTimeView] = useState<"day" | "week">("week");
  const [analytics, setAnalytics] = useState(false);
  const [service] = useState<Pick<ScheduleService, "getCurrentStudent" | "load" | "getOfficialClasses" | "saveSubSchedule" | "saveEvent" | "archiveEvent" | "recordMissedAttempt">>(
    () =>
      remoteSchedule,
  );
  const [data, setData] = useState<Dataset>(),
    [student, setStudent] = useState<Student>(),
    [loadError, setLoadError] = useState(""),
    [loading, setLoading] = useState(true);
  const [date, setDate] = useState(initialDate || ""),
    [classes, setClasses] = useState<OfficialClass[]>([]),
    [classError, setClassError] = useState(""),
    [classLoading, setClassLoading] = useState(false),
    [retry, setRetry] = useState(0);
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
    [saveError, setSaveError] = useState(""),
    [notice, setNotice] = useState("");
  const rangeDates = scheduleDates(date, timeView), rangeStart = rangeDates[0], rangeEnd = rangeDates.at(-1) || date;
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [s, d] = await Promise.all([
        service.getCurrentStudent(),
        service.load(),
      ]);
      setStudent(s);
      setData(d);
      setDate((prev) => prev || localNow(s.timezone).date);
    } catch (e) {
      setLoadError(productivityErrorMessage(e, "Your schedule could not be loaded or updated. Reload Schedule Manager and try again."));
    } finally {
      setLoading(false);
    }
  }, [service]);
  useEffect(() => {
    let active = true;
    Promise.all([service.getCurrentStudent(), service.load()])
      .then(([s, d]) => {
        if (active) {
          setStudent(s);
          setData(d);
          setDate((prev) => prev || localNow(s.timezone).date);
        }
      })
      .catch((e) => {
        if (active) setLoadError(productivityErrorMessage(e, "Your schedule could not be loaded or updated. Reload Schedule Manager and try again."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [service]);
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return;
    let active = true;
    async function get() {
      setClassLoading(true);
      setClassError("");
      try {
        await browserHabits.synchronize({ start: rangeStart, end: rangeEnd }, { tasks: "today" });
        const rules = await browserHabits.list();
        const updated = await service.load();
        if (active) { setData(updated); setHabitRules(rules); }
        const results = await Promise.allSettled(timetableSourceDates(scheduleDates(rangeStart, timeView)).map(day => service.getOfficialClasses(day)));
        if (active) {
          setClasses(results.flatMap(result => result.status === "fulfilled" ? result.value : []));
          const failures = results.filter(result => result.status === "rejected");
          setClassError(failures.length ? `${failures.length} timetable date(s) could not be loaded. ${productivityErrorMessage(failures[0].reason, "The timetable service could not complete this request.")} Personal and habit events are still displayed.` : "");
        }
      } catch (e) {
        if (active) {
          setClasses([]);
          setClassError(productivityErrorMessage(e, "Your schedule could not be loaded or updated. Reload Schedule Manager and try again."));
        }
      } finally {
        if (active) setClassLoading(false);
      }
    }
    void get();
    return () => {
      active = false;
    };
  }, [rangeStart, rangeEnd, timeView, service, retry, student?.timezone]);
  useEffect(() => {
    const refresh = () => {
      void Promise.all([service.load(), service.getCurrentStudent()]).then(([data, current]) => { setData(data); setStudent(current); setLoadError(""); }).catch(e => setLoadError(productivityErrorMessage(e, "Your schedule could not be loaded or updated. Reload Schedule Manager and try again.")));
      setRetry(value => value + 1);
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === HABIT_STORAGE_KEY || event.key === null) refresh();
    };
    const resumed = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", resumed);
    window.addEventListener(HABITS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resumed);
      window.removeEventListener(HABITS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, [service]);
  async function action(operation: () => Promise<Dataset>, message: string) {
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      setData(await operation());
      if (message) setNotice(message);
      return true;
    } catch (e) {
      setSaveError(productivityErrorMessage(e, "Your schedule could not be loaded or updated. Reload Schedule Manager and try again."));
      return false;
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <main className="loading" aria-live="polite">
        <div className="brand-mark">P</div>
        <h1>Loading your schedule…</h1>
      </main>
    );
  if (loadError || !data || !student)
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
  const filteredEvents = history
    ? own.filter((e) => !current || e.subScheduleId === current.id)
    : selectTimetableEvents(data, student.id, rangeDates, { scheduleId: current?.id, focus });
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
  const conflicts = scheduleConflicts(own.filter(e => rangeDates.includes(e.slot.date)), classes.filter(c => rangeDates.includes(c.slot.date)), student.id);
  const timelineEntries: TimetableEntry[] = [...events.filter(event => !event.archivedAt).map(event => ({ id: event.id, title: event.title, slot: event.slot, kind: event.source.kind === "habit" ? "habit" as const : "personal" as const, category: schedules.find(schedule => schedule.id === event.subScheduleId)?.name || (event.source.kind === "habit" ? "Habit" : "Personal"), priority: event.priority, outcome: eventOutcome(event) })), ...visibleClasses.map(item => ({ id: item.id, title: item.courseCode + " \u00b7 " + item.courseName, slot: item.slot, kind: "academic" as const, category: "Academics", venue: item.venue }))];
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
          {analytics ? <AnalyticsPanel kind="schedule" student={student} data={data} academic={service} /> : <>
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
                  onClick={() => setHistory(false)}
                >
                  Schedule
                </button>
                <button
                  className={"tab " + (history ? "active" : "")}
                  onClick={() => setHistory(true)}
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
            {saveError && (
              <p className="error banner" role="alert">
                {saveError}
              </p>
            )}
            {notice && (
              <p className="success banner" role="status">
                {notice}
              </p>
            )}
            {!history && classLoading && (
              <p className="banner" role="status">
                Loading official classes…
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
            {!history && <Timetable entries={timelineEntries} dates={rangeDates} today={now.date} currentTime={now.time} selectedDate={date} conflicts={conflicts} onDate={setDate} onOpen={entry => { if (entry.kind === "academic") setOfficial(classes.find(item => item.id === entry.id)); else setDetailId(entry.id); }}/> }
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
            setNotice(`Scheduled for ${saved.slot.date}, ${saved.slot.start}–${saved.slot.end}.`);
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
            setNotice("Sub-category saved.");
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
            {saveError && (
              <p className="error" role="alert">
                {saveError}
              </p>
            )}
            {selected.source.kind !== "personal" && <p className="notice">Imported activity: manage its fields and outcomes in the originating section. <WorkspaceButton section={selected.source.kind === "habit" ? "habits" : "tasks"} habitId={selected.source.kind === "habit" ? selected.source.habitId : undefined} occurrenceDate={selected.source.kind === "habit" ? selected.originalSlot.date : undefined}>Open originating section</WorkspaceButton>{selected.source.kind === "habit" && <> <WorkspaceButton section="habits" habitId={selected.source.habitId} editHabit>Edit habit</WorkspaceButton></>}</p>}
            {selected.source.kind === "personal" && <div className="detail-actions">
              {selected.archivedAt ? (
                <button
                  disabled={saving}
                  onClick={() =>
                    void action(
                      () => service.archiveEvent(selected.id, true),
                      "Event restored with history intact.",
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
            {saveError && (
              <p className="error" role="alert">
                {saveError}
              </p>
            )}
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
                      () => service.archiveEvent(archiveId),
                      "Event archived. Find it in History to restore it.",
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
