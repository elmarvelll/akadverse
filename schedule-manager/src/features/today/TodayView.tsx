"use client";
import { useCallback, useEffect, useState } from "react";
import { developmentIdentity, sampleAcademics } from "../schedule/adapters";
import { localNow } from "../schedule/domain";
import { BrowserScheduleRepository } from "../schedule/storage";
import { formatDate } from "../schedule/Forms";
import { browserHabits } from "../habits/browser";
import { HABITS_CHANGED } from "../habits/storage";
import { outcome } from "../habits/domain";
import { HabitBadge } from "../habits/HabitLabel";
import { TASKS_CHANGED } from "../tasks/storage";
import { millisecondsToNextMinute } from "../tasks/domain";
import { WorkspaceButton } from "../workspace/WorkspaceNavigation";
import { Icon, StatusPill } from "../workspace/Design";
import { selectToday, type TodayModel } from "./selectors";

// TodayScreen's visual composition, using shared data and navigation only.
export function TodayView() {
  const [model, setModel] = useState<TodayModel>(), [error, setError] = useState(""), [academicWarning, setAcademicWarning] = useState("");
  const load = useCallback(async () => {
    const student = await developmentIdentity.getCurrentStudent(), instant = new Date(), date = localNow(student.timezone, instant).date;
    const occurrences = await browserHabits.synchronize({ start: date, end: date }, { tasks: "today" });
    const [tasks, data, habits] = await Promise.all([browserHabits.tasks.listTasks(), new BrowserScheduleRepository().load(), browserHabits.list()]);
    let classes: Awaited<ReturnType<typeof sampleAcademics.getClassSessions>> = [];
    try { classes = await sampleAcademics.getClassSessions(student.id, date); setAcademicWarning(""); } catch { setAcademicWarning("Academic sessions could not be loaded. The schedule count includes personal and habit events only."); }
    setModel(selectToday({ tasks, data, habits, occurrences, classes, student, instant })); setError("");
  }, []);
  useEffect(() => {
    let active = true, timer: number;
    const refresh = () => { if (active) void load().catch(error => { if (active) setError(error.message); }); };
    const tick = () => { refresh(); timer = window.setTimeout(tick, millisecondsToNextMinute(new Date())); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh(); timer = window.setTimeout(tick, millisecondsToNextMinute(new Date()));
    window.addEventListener("focus", refresh); window.addEventListener("storage", refresh); window.addEventListener(TASKS_CHANGED, refresh); window.addEventListener(HABITS_CHANGED, refresh); document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); window.removeEventListener(TASKS_CHANGED, refresh); window.removeEventListener(HABITS_CHANGED, refresh); document.removeEventListener("visibilitychange", visible); };
  }, [load]);
  if (!model) return <main className="loading"><h1>Today</h1>{error ? <><p role="alert" className="error">{error}</p><button onClick={() => void load().catch(error => setError(error.message))}>Retry loading</button></> : <p role="status">Preparing your day...</p>}</main>;
  return <div className="module-view today-module"><main className="content">
    <div className="page-heading"><div><p className="today-kicker">TODAY OVERVIEW</p><h1>{formatDate(model.date, true)}</h1><p>A little clarity for the day ahead.</p></div><StatusPill tone="blue">Today</StatusPill></div>
    {error && <p className="error" role="alert">{error} <button onClick={() => void load().catch(error => setError(error.message))}>Retry loading</button></p>}
    {academicWarning && <p className="notice" role="status">{academicWarning}</p>}
    <div className="today-stat-grid"><div className="today-stat"><span className="today-stat-icon"><Icon name="task"/></span><div><strong>{model.openTasks.length}</strong><span>Open tasks</span><small>{model.completedTasks} completed today</small></div></div><div className="today-stat"><span className="today-stat-icon green"><Icon name="habit"/></span><div><strong>{model.completedHabits}<small> / {model.habits.length}</small></strong><span>Habits completed</span><small>Scheduled for today</small></div></div><div className="today-stat"><span className="today-stat-icon purple"><Icon name="calendar"/></span><div><strong>{model.events.length + model.official.length}</strong><span>On your schedule</span><small>Personal, habits &amp; classes</small></div></div></div>
    <section className="today-focus"><div className="today-section-heading"><h2><Icon name="habit"/> Focus for today</h2><WorkspaceButton section="schedule">Open schedule <Icon name="arrow"/></WorkspaceButton></div><p>Activities you explicitly marked must complete today.</p>{model.focus.length ? <div className="today-focus-list">{model.focus.map(event => <WorkspaceButton key={event.id} section="schedule" eventId={event.id} scheduleDate={model.date}><span>{event.title}</span><small>{event.slot.start}–{event.slot.end}</small><Icon name="arrow"/></WorkspaceButton>)}</div> : <p className="today-empty-inline">No must-complete commitments selected for today.</p>}</section>
    <div className="today-columns"><div className="today-primary-column"><section className="today-section"><div className="today-section-heading"><h2>Your tasks <span>{model.openTasks.length}</span></h2><WorkspaceButton section="tasks">Open To-do List <Icon name="arrow"/></WorkspaceButton></div><p className="today-section-description">A clear view of what is ready and what needs an outcome.</p>{model.openTasks.length ? model.openTasks.map(task => <WorkspaceButton key={task.id} className="today-activity-row" section="tasks" taskId={task.id} aria-label={`Open task ${task.title}`}><span className="today-row-icon"><Icon name="task"/></span><span className="today-row-main"><strong>{task.title}</strong><small>{task.dueDate ? `${task.dueDate}${task.dueTime ? ` · ${task.dueTime}` : " · Date only"}` : "No deadline"}</small>{task.source.kind === "habit" && <HabitBadge/>}</span><StatusPill tone={task.viewStatus === "pending" ? "amber" : "blue"}>{task.viewStatus === "pending" ? "Awaiting outcome" : "Active"}</StatusPill><Icon name="arrow"/></WorkspaceButton>) : <div className="empty"><Icon name="task"/><h3>A little breathing room</h3><p>No open tasks for today. Manage your commitments in To-do List.</p></div>}</section>
    <section className="today-section"><div className="today-section-heading"><h2>On the timetable</h2><WorkspaceButton section="schedule" scheduleDate={model.date}>View schedule <Icon name="arrow"/></WorkspaceButton></div>{[...model.events.map(event => ({ id: event.id, title: event.title, start: event.slot.start, end: event.slot.end, type: event.source.kind === "habit" ? "Habit" : "Personal event", official: false })), ...model.official.map(item => ({ id: item.id, title: `${item.courseCode} · ${item.courseName}`, start: item.slot.start, end: item.slot.end, type: `Sample class · ${item.venue}`, official: true }))].sort((a, b) => a.start.localeCompare(b.start)).map(item => <WorkspaceButton className="today-activity-row" section="schedule" eventId={item.id} scheduleDate={model.date} key={item.id}><span className="today-event-time">{item.start}<small>{item.end}</small></span><span className="today-row-main"><strong>{item.title}</strong><small>{item.type}</small></span><Icon name={item.official ? "education" : "arrow"}/></WorkspaceButton>)}{!model.events.length && !model.official.length && <p className="today-empty-inline">No activities scheduled for today.</p>}</section></div>
    <aside className="today-secondary-column"><section className="today-section"><div className="today-section-heading"><h2>Your habits</h2><WorkspaceButton section="habits" aria-label="Open Habit Tracker"><Icon name="arrow"/></WorkspaceButton></div><p className="today-section-description">Small steps count. Review each occurrence in your tracker.</p>{model.habits.map(item => { const state = outcome(item); return <WorkspaceButton key={item.id} className="today-habit-row" section="habits" habitId={item.habitId} occurrenceDate={item.date}><span className="today-row-icon"><Icon name={item.task ? "task" : "calendar"}/></span><span className="today-row-main"><strong>{item.task?.title || item.event?.title || item.settings.name}</strong><small>{item.task ? item.task.dueTime || "No deadline" : `${item.event?.slot.start}–${item.event?.slot.end}`}</small></span><StatusPill tone={state === "completed" ? "green" : state === "missed" ? "red" : "neutral"}>{state === "unrecorded" ? "Not recorded" : state}</StatusPill></WorkspaceButton>; })}{!model.habits.length && <p className="today-empty-inline">No habits scheduled today.</p>}</section><div className="today-note"><Icon name="clock"/><h3>Your day, at your pace.</h3><p>Review commitments in their own workspace. A passed deadline never records an outcome for you.</p></div></aside></div>
  </main></div>;
}
