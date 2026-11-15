"use client";
import { RefreshIndicator } from "../workspace/RefreshIndicator";
import { useEffect, useState } from "react";
import { productivityErrorMessage } from "../errors";
import { rpc, invalidateWorkspace } from "../client";
import { localNow, type OfficialClass } from "../schedule/domain";
import { formatDate } from "../schedule/Forms";
import { outcome } from "../habits/domain";
import { HabitBadge } from "../habits/HabitLabel";
import { WorkspaceButton } from "../workspace/WorkspaceNavigation";
import { Icon, StatusPill } from "../workspace/Design";
import { useWorkspaceSnapshot, useSectionActive } from "../workspace/queries";
import { selectToday } from "./selectors";

export function TodayView() {
  const { snapshot, error, refreshing, clock, refresh: load } = useWorkspaceSnapshot({ section: "today" });
  const active = useSectionActive();
  const [academic, setAcademic] = useState<{ key: string; rows: OfficialClass[]; warning: string }>();
  const [academicRetry, setAcademicRetry] = useState(0);
  const date = snapshot ? localNow(snapshot.student.timezone, clock).date : "";
  const academicKey = date + ":" + snapshot?.student.timezone;
  useEffect(() => {
    if (!active || !date) return;
    let current = true;
    void rpc<{ rows: OfficialClass[]; failedDates: string[]; error: string }>("official.range", [{ start: date, end: date }]).then(result => {
      if (current) setAcademic({ key: academicKey, rows: result.rows, warning: result.failedDates.length ? result.error + " Personal and habit records remain available." : "" });
    }).catch(failure => { if (current) setAcademic({ key: academicKey, rows: [], warning: productivityErrorMessage(failure, "Official classes could not be loaded. Personal and habit records remain available.") }); });
    return () => { current = false; };
  }, [academicKey, date, active, snapshot?.serverTime, academicRetry]);
  const academicWarning = academic?.key === academicKey ? academic.warning : "Loading official classes...";
  const model = snapshot && selectToday({ tasks: snapshot.data.tasks.tasks, data: snapshot.data.schedule, habits: snapshot.data.habits.habits, occurrences: snapshot.occurrences, classes: academic?.key === academicKey ? academic.rows : [], student: snapshot.student, instant: clock });
  if (!model) return <main className="loading"><h1>Today</h1>{error ? <><p role="alert" className="error">{error}</p><button onClick={() => void load()}>Retry loading</button></> : <p role="status">Preparing your day...</p>}</main>;
  return <div className="module-view today-module"><main className="content">
    <div className="page-heading"><div><p className="today-kicker">TODAY OVERVIEW</p><h1>{formatDate(model.date, true)}</h1><p>A little clarity for the day ahead.</p></div><StatusPill tone="blue">Today</StatusPill></div>
    {error && <p className="error" role="alert">{error} <button onClick={() => void load()}>Retry loading</button></p>}
    <RefreshIndicator active={refreshing} label="Refreshing your overview..."/>
    {academicWarning && <p className="notice" role="status">{academicWarning} {academic?.key === academicKey && academic.warning && <button onClick={() => { invalidateWorkspace(["official"]); setAcademicRetry(value => value + 1); }}>Retry timetable</button>}</p>}
    <div className="today-stat-grid"><div className="today-stat"><span className="today-stat-icon"><Icon name="task"/></span><div><strong>{snapshot?.todayCounts?.openTasks ?? model.openTasks.length}</strong><span>Open tasks</span><small>{snapshot?.todayCounts?.completedTasks ?? model.completedTasks} completed today</small></div></div><div className="today-stat"><span className="today-stat-icon green"><Icon name="habit"/></span><div><strong>{model.completedHabits}<small> / {model.habits.length}</small></strong><span>Habits completed</span><small>Scheduled for today</small></div></div><div className="today-stat"><span className="today-stat-icon purple"><Icon name="calendar"/></span><div><strong>{model.events.length + model.official.length}</strong><span>On your schedule</span><small>Personal, habits &amp; classes</small></div></div></div>
    <section className="today-focus"><div className="today-section-heading"><h2><Icon name="habit"/> Focus for today</h2><WorkspaceButton section="schedule">Open schedule <Icon name="arrow"/></WorkspaceButton></div><p>Activities you explicitly marked must complete today.</p>{model.focus.length ? <div className="today-focus-list">{model.focus.map(event => <WorkspaceButton key={event.id} section="schedule" eventId={event.id} scheduleDate={model.date}><span>{event.title}</span><small>{event.slot.start}–{event.slot.end}</small><Icon name="arrow"/></WorkspaceButton>)}</div> : <p className="today-empty-inline">No must-complete commitments selected for today.</p>}</section>
    {(snapshot?.todayCounts?.openTasks || 0) > 100 && <p className="notice">Showing the first 100 open tasks. Open To-do List for additional pages.</p>}<div className="today-columns"><div className="today-primary-column"><section className="today-section"><div className="today-section-heading"><h2>Your tasks <span>{model.openTasks.length}</span></h2><WorkspaceButton section="tasks">Open To-do List <Icon name="arrow"/></WorkspaceButton></div><p className="today-section-description">A clear view of what is ready and what needs an outcome.</p>{model.openTasks.length ? model.openTasks.slice(0, 100).map(task => <WorkspaceButton key={task.id} className="today-activity-row" section="tasks" taskId={task.id} aria-label={`Open task ${task.title}`}><span className="today-row-icon"><Icon name="task"/></span><span className="today-row-main"><strong>{task.title}</strong><small>{task.dueDate ? `${task.dueDate}${task.dueTime ? ` · ${task.dueTime}` : " · Date only"}` : "No deadline"}</small>{task.source.kind === "habit" && <HabitBadge/>}</span><StatusPill tone={task.viewStatus === "pending" ? "amber" : "blue"}>{task.viewStatus === "pending" ? "Awaiting outcome" : "Active"}</StatusPill><Icon name="arrow"/></WorkspaceButton>) : <div className="empty"><h3>A little breathing room</h3><p>No open tasks for today. Manage your commitments in To-do List.</p></div>}</section>
    <section className="today-section"><div className="today-section-heading"><h2>On the timetable</h2><WorkspaceButton section="schedule" scheduleDate={model.date}>View schedule <Icon name="arrow"/></WorkspaceButton></div>{[...model.events.map(event => ({ id: event.id, title: event.title, start: event.slot.start, end: event.slot.end, type: event.source.kind === "habit" ? "Habit" : "Personal event", official: false })), ...model.official.map(item => ({ id: item.id, title: `${item.courseCode} · ${item.courseName}`, start: item.slot.start, end: item.slot.end, type: `Official class · ${item.venue}`, official: true }))].sort((a, b) => a.start.localeCompare(b.start)).map(item => <WorkspaceButton className="today-activity-row" section="schedule" eventId={item.id} scheduleDate={model.date} key={item.id}><span className="today-event-time">{item.start}<small>{item.end}</small></span><span className="today-row-main"><strong>{item.title}</strong><small>{item.type}</small></span><Icon name={item.official ? "education" : "arrow"}/></WorkspaceButton>)}{!model.events.length && !model.official.length && <p className="today-empty-inline">No activities scheduled for today.</p>}</section></div>
    <aside className="today-secondary-column"><section className="today-section"><div className="today-section-heading"><h2>Your habits</h2><WorkspaceButton section="habits" aria-label="Open Habit Tracker">Open habits <Icon name="arrow"/></WorkspaceButton></div><p className="today-section-description">Small steps count. Review each occurrence in your tracker.</p>{model.habits.map(item => { const state = outcome(item); return <WorkspaceButton key={item.id} className="today-habit-row" section="habits" habitId={item.habitId} occurrenceDate={item.date}><span className="today-row-icon"><Icon name={item.task ? "task" : "calendar"}/></span><span className="today-row-main"><strong>{item.task?.title || item.event?.title || item.settings.name}</strong><small>{item.task ? item.task.dueTime || "No deadline" : `${item.event?.slot.start}–${item.event?.slot.end}`}</small></span><StatusPill tone={state === "completed" ? "green" : state === "missed" ? "red" : "neutral"}>{state === "unrecorded" ? "Not recorded" : state}</StatusPill></WorkspaceButton>; })}{!model.habits.length && <p className="today-empty-inline">No habits scheduled today.</p>}</section><div className="today-note"><Icon name="clock"/><h3>Your day, at your pace.</h3><p>Review commitments in their own workspace. A passed deadline never records an outcome for you.</p></div></aside></div>
  </main></div>;
}
