"use client";
import { WorkspaceSections } from "../workspace/WorkspaceSections";
import { WorkspaceButton } from "../workspace/WorkspaceNavigation";
import { useCallback, useEffect, useState } from "react";
import {
  addDays,
  localNow,
  ScheduleService,
  selectScheduleEvents,
  scheduleConflicts,
  type Dataset,
  type OfficialClass,
  type PersonalEvent,
  type Student,
  type SubSchedule,
} from "./domain";
import { BrowserScheduleRepository, STORAGE_KEY } from "./storage";
import { developmentIdentity, sampleAcademics } from "./adapters";
import { Dialog, EventForm, ScheduleForm, Stamp, formatDate } from "./Forms";
import { browserHabits } from "../habits/browser";
import { EventBackup } from "./EventBackup";
import { AnalyticsPanel } from "../analytics/AnalyticsPanel";
export function ScheduleManager() {
  const [analytics, setAnalytics] = useState(false);
  const [service] = useState<Pick<ScheduleService, "getCurrentStudent" | "load" | "getOfficialClasses" | "saveSubSchedule" | "saveEvent" | "archiveEvent" | "recordMissedAttempt">>(
    () =>
      new ScheduleService(
        new BrowserScheduleRepository(),
        developmentIdentity,
        sampleAcademics,
      ),
  );
  const [data, setData] = useState<Dataset>(),
    [student, setStudent] = useState<Student>(),
    [loadError, setLoadError] = useState(""),
    [loading, setLoading] = useState(true);
  const [date, setDate] = useState(""),
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
  const [detailId, setDetailId] = useState<string>(),
    [official, setOfficial] = useState<OfficialClass>(),
    [archiveId, setArchiveId] = useState<string>();
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [notice, setNotice] = useState("");
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
      setLoadError((e as Error).message);
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
        if (active) setLoadError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [service]);
  useEffect(() => {
    if (!date) return;
    let active = true;
    async function get() {
      setClassLoading(true);
      setClassError("");
      try {
        await browserHabits.synchronize({ start: date, end: date });
        const updated = await service.load();
        const result = await service.getOfficialClasses(date);
        if (active) setData(updated);
        if (active) setClasses(result);
      } catch (e) {
        if (active) {
          setClasses([]);
          setClassError((e as Error).message);
        }
      } finally {
        if (active) setClassLoading(false);
      }
    }
    void get();
    return () => {
      active = false;
    };
  }, [date, service, retry]);
  useEffect(() => {
    const refresh = () => {
      void service.load().then(setData).catch(e => setLoadError((e as Error).message));
      setRetry(value => value + 1);
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    return () => {
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
      setSaveError((e as Error).message);
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
    : selectScheduleEvents(data, student.id, {
          date,
          scheduleId: current?.id,
          focus,
        });
  const events = view === "habits" ? filteredEvents.filter(e => e.source.kind === "habit") : view === "academic" ? filteredEvents.filter(e => schedules.some(s => s.academic && s.id === e.subScheduleId)) : filteredEvents;
  const visibleClasses =
    !history && !focus && (view === "main" || view === "academic" || current?.academic)
      ? classes.filter(
          (c) =>
            c.slot.date === date &&
            c.state === "scheduled" &&
            c.registrationState === "registered",
        )
      : [];
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
        ? "Academic classes"
        : view === "habits" ? "Habit occurrences" : current?.name || "Main schedule";
  const conflicts = scheduleConflicts(own.filter(e => e.slot.date === date), classes.filter(c => c.slot.date === date), student.id);
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
    <div className="app-shell">
      <aside className="sidebar">
        <WorkspaceButton className="brand" section="schedule">
          <span className="brand-mark">P</span>
          <span>
            Productivity<span className="brand-sub">LAYER</span>
          </span>
        </WorkspaceButton>
        <p className="nav-label">YOUR WORKSPACE</p>
        <WorkspaceSections active="schedule" />
        <div className="sidebar-bottom">
          <span className="avatar">DS</span>
          <div>
            <strong>Development student</strong>
            <small>Prototype identity</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> Schedule Manager
          </span>
          <span className="prototype">LOCAL PROTOTYPE</span>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
              <h1>{analytics ? "Schedule analytics" : title}</h1>
              <p className="muted">
                {analytics ? "Planned time and recorded attempts across all life areas." : current?.description ||
                  (view === "academic"
                    ? "Read-only timetable sessions from sample course registration."
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
              <button className="primary" onClick={createEvent}>
                ＋ Create event
              </button>
            </div>}
          </div>
          <div className="analytics-view-switch" role="group" aria-label="Schedule view"><button type="button" aria-pressed={!analytics} onClick={() => setAnalytics(false)}>Schedule</button><button type="button" aria-pressed={analytics} onClick={() => setAnalytics(true)}>Analytics</button></div>
          {analytics ? <AnalyticsPanel kind="schedule" student={student} data={data} academic={service} /> : <>
          <div className="summary-grid">
            {[
              [
                "▦",
                own.filter(e => !e.archivedAt && e.slot.date === date).length + classes.filter(c => c.slot.date === date && c.state === "scheduled" && c.registrationState === "registered").length,
                "Activities scheduled on this day",
              ],
              [
                "🎓",
                classes.filter(c => c.slot.date === date && c.state === "scheduled" && c.registrationState === "registered").length,
                "Official classes on this day",
              ],
              [
                "▦",
                schedules.length,
                "Your sub-categories",
              ],
            ].map(([icon, count, label]) => (
              <div className="summary-card" key={label}>
                <span className="summary-icon">{icon}</span>
                <div>
                  <strong>{count}</strong>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
          <section className="schedule-panel" aria-label="Schedule">
            <div className="category-filters" role="group" aria-label="Sub-category filters">
              <button aria-pressed={view === "main"} onClick={() => navigate("main")}>All</button>
              <button aria-pressed={view === "academic"} onClick={() => navigate("academic")}>Academics</button>
              {schedules.map(s => <button key={s.id} aria-pressed={view === s.id} onClick={() => navigate(s.id)}>{s.name}</button>)}
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
                    <h2>{formatDate(date, true)}</h2>
                    <p className="hint">
                      {student.timezone} ·{" "}
                      {focus
                        ? "Only explicit must-complete commitments"
                        : "One day, a little more intention"}
                    </p>
                  </div>
                  <div className="date-controls">
                    <button
                      aria-label="Previous day"
                      onClick={() => setDate(addDays(date, -1))}
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
                      aria-label="Next day"
                      onClick={() => setDate(addDays(date, 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="week-strip" aria-label="Nearby dates">
                  {Array.from({ length: 7 }, (_, i) =>
                    addDays(date, i - 3),
                  ).map((d) => (
                    <button
                      key={d}
                      aria-pressed={d === date}
                      className={"day " + (d === date ? "chosen" : "")}
                      onClick={() => setDate(d)}
                    >
                      <span>
                        {new Intl.DateTimeFormat("en", {
                          timeZone: "UTC",
                          weekday: "short",
                        }).format(new Date(d + "T12:00:00Z"))}
                      </span>
                      <strong>{Number(d.slice(-2))}</strong>
                      {d === now.date && <small>Today</small>}
                    </button>
                  ))}
                </div>
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
                Loading sample classes…
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
            <div className="event-list" aria-busy={saving}>
              {visibleClasses.map((c) => (
                <article className="event-card official" key={c.id}>
                  <div className="event-time">
                    <strong>{c.slot.start}</strong>
                    <span>{c.slot.end}</span>
                  </div>
                  <div className="event-info">
                    <div className="badges">
                      <span className="badge blue">
                        🎓 Official class · Sample
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
                        <span className="badge">
                          {e.source.kind === "habit"
                            ? "Habit-linked"
                            : e.source.kind === "task" ? "Task" : "Event"}
                        </span>
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
            </div>
          </section>
          </>}
          <footer className="page-footer">
            <span>Sample academic data · Development identity</span>
            <span>Stored in this browser · No account sync</span>
          </footer>
        </main>
      </div>
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
              <dt>Priority</dt>
              <dd>{selected.priority}</dd>
              <dt>Must complete</dt>
              <dd>
                {selected.mustComplete
                  ? selected.focusDate
                  : "No day commitment"}
              </dd>
              {(selected.source.kind === "personal" || selected.backup) && <EventBackup event={selected} />}
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
            {selected.source.kind !== "personal" && <p className="notice">Imported activity: manage its fields and outcomes in the originating section. <WorkspaceButton section={selected.source.kind === "habit" ? "habits" : "tasks"} habitId={selected.source.kind === "habit" ? selected.source.habitId : undefined} occurrenceDate={selected.source.kind === "habit" ? selected.originalSlot.date : undefined}>Open originating section</WorkspaceButton></p>}
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
                      {overdue(selected) && <button disabled={saving} onClick={async () => {
                        const success = await action(() => service.recordMissedAttempt(selected.id), "Missed attempt recorded. Choose how to reschedule; the event has not moved.");
                        if (success) setNotice("Missed attempt recorded. Choose Replan event for smart or manual rescheduling.");
                      }}>Mark missed</button>}
                      <p className="hint">Completion is managed in the activity’s own tracker.</p>
                    </>
                  )}
                </>
              )}
            </div>}
          </div>
        </Dialog>
      )}
      {official && (
        <Dialog
          title={official.courseCode + " — " + official.courseName}
          onClose={() => setOfficial(undefined)}
        >
          <div className="detail">
            <p className="notice">
              Official class · Sample academic data · Read-only
            </p>
            <dl>
              <dt>Date</dt>
              <dd>{formatDate(official.slot.date, true)}</dd>
              <dt>Time</dt>
              <dd>
                {official.slot.start}–{official.slot.end}
              </dd>
              <dt>Lecturer</dt>
              <dd>{official.lecturer}</dd>
              <dt>Venue</dt>
              <dd>{official.venue}</dd>
              <dt>Semester</dt>
              <dd>{official.semester}</dd>
              <dt>Class group</dt>
              <dd>{official.classGroup}</dd>
              <dt>Source identifier</dt>
              <dd>{official.sourceId}</dd>
            </dl>
            <p className="muted">
              Your registered courses determine which timetable sessions appear
              here. Personal operations cannot alter this record.
            </p>
            <button onClick={() => {
              setOfficial(undefined);
              createEvent();
              setNotice(`Create a personal catch-up for ${official.courseCode}. The official lecture stays in place.`);
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
