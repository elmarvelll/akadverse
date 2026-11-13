"use client";
import { productivityErrorMessage } from "../errors";
import { habitDuplicateConflicts } from "../habits/duplicates";
import { HabitBadge } from "../habits/HabitLabel";
import { WorkspaceButton, useWorkspaceNavigation } from "../workspace/WorkspaceNavigation";
import { Icon, ProdButton } from "../workspace/Design";
import { useCallback, useEffect, useRef, useState } from "react";
import { remoteTasks } from "../client";
import { Dialog, Stamp, formatDate } from "../schedule/Forms";
import { todoTasks, filterHabitHistory, type HabitHistoryPeriod } from "./todo";
import type { Habit } from "../habits/domain";
import { HABITS_CHANGED, HABIT_STORAGE_KEY } from "../habits/storage";
import { browserHabits } from "../habits/browser";
import { localNow } from "../schedule/domain";
import type { Student } from "../schedule/domain";
import { isTaskOverdue, taskViewStatus, millisecondsToNextMinute, type Task, type TaskViewStatus } from "./domain";

import { TASK_STORAGE_KEY, TASKS_CHANGED } from "./storage";
import { queryTasks, taskStatusCounts, type TaskSort } from "./queries";
import { TaskForm } from "./TaskForm";
import { AnalyticsPanel } from "../analytics/AnalyticsPanel";
import { TaskStatusTabs } from "./TaskStatusTabs";
import { TaskCard } from "./TaskCard";
import { TaskDetailActions } from "./TaskDetailActions";

function Deadline({ task }: { task: Task }) {
  return <>{task.dueDate ? <>{formatDate(task.dueDate, true)}{task.dueTime ? ` · ${task.dueTime}` : " · Date only"}</> : "No deadline"}</>;
}
export function TaskManager({ initialTaskId }: { initialTaskId?: string }) {
  const [historyPeriod, setHistoryPeriod] = useState<HabitHistoryPeriod>("all");
  const [analytics, setAnalytics] = useState(false);
  const navigate = useWorkspaceNavigation();
  const closeTask = () => navigate({ section: "tasks" });
  const [service] = useState(() => remoteTasks);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>(), [student, setStudent] = useState<Student>();
  const [loadError, setLoadError] = useState(""), [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState<TaskViewStatus>("active"), [sort, setSort] = useState<TaskSort>("newest");
  const [editor, setEditor] = useState<{ task?: Task }>(), [deleteId, setDeleteId] = useState<string>();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [clock, setClock] = useState<Date>();
  const habitSettings = JSON.stringify(habits);
  const timezone = student?.timezone;
  const habitDay = clock && student ? localNow(student.timezone, clock).date : "";
  useEffect(() => {
    if (!habitDay) return;
    let active = true;
    void browserHabits.synchronize({ start: habitDay, end: habitDay }).then(() => service.listTasks()).then(records => { if (active) setTasks(records); }).catch(error => { if (active) setLoadError(productivityErrorMessage(error, "Your tasks could not be loaded or updated. Reload the task list and try again.")); });
    return () => { active = false; };
  }, [habitDay, timezone, habitSettings, service]);
  useEffect(() => {
    let timer: number;
    const tick = () => { setClock(new Date()); timer = window.setTimeout(tick, millisecondsToNextMinute(new Date())); };
    const refreshClock = () => { setClock(new Date()); };
    const visible = () => { if (document.visibilityState === "visible") refreshClock(); };
    timer = window.setTimeout(tick, millisecondsToNextMinute(new Date()));
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refreshClock); document.removeEventListener("visibilitychange", visible); };
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [current, records, rules] = await Promise.all([service.getCurrentStudent(), service.listTasks(), browserHabits.list()]);
      setStudent(current); setTasks(records); setHabits(rules); setLoadError(""); setClock(new Date());
    } catch (error) { setLoadError(productivityErrorMessage(error, "Your tasks could not be loaded or updated. Reload the task list and try again.")); }
  }, [service]);
  useEffect(() => {
    let active = true;
    Promise.all([service.getCurrentStudent(), service.listTasks(), browserHabits.list()]).then(([current, records, rules]) => {
      if (active) { setStudent(current); setTasks(records); setHabits(rules); setClock(new Date()); }
    }).catch(error => { if (active) setLoadError(productivityErrorMessage(error, "Your tasks could not be loaded or updated. Reload the task list and try again.")); });
    const changed = (event: StorageEvent) => { if (event.key === TASK_STORAGE_KEY || event.key === HABIT_STORAGE_KEY || event.key === null) void refresh(); };
    const reload = () => { void refresh(); };
    const resumed = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", resumed);
    window.addEventListener(HABITS_CHANGED, reload);
    window.addEventListener("storage", changed); window.addEventListener("focus", reload); window.addEventListener(TASKS_CHANGED, reload);
    return () => { active = false; document.removeEventListener("visibilitychange", resumed); window.removeEventListener(HABITS_CHANGED, reload); window.removeEventListener("storage", changed); window.removeEventListener("focus", reload); window.removeEventListener(TASKS_CHANGED, reload); };
  }, [service, refresh]);
  async function mutate(operation: () => Promise<Task>, message: string) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true); setSaveError(""); setNotice("");
    try {
      const saved = await operation();
      setTasks(previous => previous?.map(task => task.id === saved.id ? saved : task));
      setNotice(message); return true;
    } catch (error) { setSaveError(productivityErrorMessage(error, "Your tasks could not be loaded or updated. Reload the task list and try again.")); return false; } finally { saving.current = false; setBusy(false); }
  }
  if (!tasks || !student) return <main className="loading"><h1>{loadError ? "Tasks could not be loaded" : "Loading your tasks…"}</h1>{loadError ? <><p role="alert" className="error">{loadError}</p><p>Saved records have not been replaced.</p><button onClick={() => void refresh()}>Retry loading</button></> : <p role="status">Reading your saved tasks.</p>}<WorkspaceButton section="schedule">Open Schedule Manager</WorkspaceButton></main>;
  const duplicateConflicts = habitDuplicateConflicts(tasks);
  const scopedTasks = clock ? todoTasks(tasks, habits, student.timezone, clock) : tasks.filter(task => task.source.kind !== "habit");
  const requestedTask = tasks.find(task => task.id === initialTaskId);
  const selected = scopedTasks.find(task => task.id === initialTaskId);
  const historyTasks = clock ? filterHabitHistory(scopedTasks, historyPeriod, student.timezone, clock) : scopedTasks;
  const listTasks = status === "completed" || status === "missed" ? historyTasks : scopedTasks;
  const visible = queryTasks(listTasks, { timezone: student.timezone, instant: clock, status, sort });
  const counts = taskStatusCounts(scopedTasks, student.timezone, clock);
  const historicalCounts = taskStatusCounts(historyTasks, student.timezone, clock);
  counts.completed = historicalCounts.completed; counts.missed = historicalCounts.missed;
  const historyEmpty = (status === "completed" || status === "missed") && historyPeriod !== "all";
  const deleting = tasks.find(task => task.id === deleteId);
  return <div className="module-view tasks-module"><main className="content tasks-content">
        <div className="page-heading"><div><p className="eyebrow">ONE THING AT A TIME</p><h1>{analytics ? "To-do analytics" : "To-do List"}</h1><p className="muted">Keep your commitments clear. One task at a time.</p></div>{!analytics && <ProdButton className="primary" onClick={() => { setSaveError(""); setEditor({}); }}><Icon name="plus"/> New task</ProdButton>}</div>
        <div className="analytics-view-switch" role="group" aria-label="To-do view"><button type="button" aria-pressed={!analytics} onClick={() => setAnalytics(false)}>Tasks</button><button type="button" aria-pressed={analytics} onClick={() => setAnalytics(true)}>Analytics</button></div>
        {duplicateConflicts.length > 0 && <p className="error" role="alert">Conflicting duplicate habit outcomes require review. Stored outcomes have not been merged or deleted. {duplicateConflicts.join(", ")}</p>}
        {loadError && <p className="error" role="alert">{loadError} <button onClick={() => void refresh()}>Retry loading</button></p>}
        {saveError && <p className="error" role="alert">{saveError} Retry the action when ready.</p>}
        {notice && <p className="success banner" role="status">{notice}</p>}
        {initialTaskId && !selected && <p className="notice" role="status">{requestedTask?.source.kind === "habit" ? <>This habit occurrence is outside today&apos;s To-do List. <WorkspaceButton section="habits" habitId={requestedTask.source.habitId} occurrenceDate={requestedTask.source.scheduledDate}>Review in Habit Tracker</WorkspaceButton></> : "This task was not found for this student."} <WorkspaceButton section="tasks">View your tasks</WorkspaceButton></p>}
        {analytics ? <AnalyticsPanel kind="tasks" student={student} tasks={tasks} /> : <section className="schedule-panel" aria-label="Tasks">
          <div className="panel-toolbar"><TaskStatusTabs status={status} counts={counts} onSelect={setStatus} /></div>
          <div className="task-filters">
            {(status === "completed" || status === "missed") && <label>Habit history<select value={historyPeriod} onChange={event => setHistoryPeriod(event.target.value as HabitHistoryPeriod)}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select></label>}
            <label>Sort by<select value={sort} onChange={event => setSort(event.target.value as TaskSort)}><option value="newest">Newest created</option><option value="oldest">Oldest created</option><option value="due-earliest">Earliest intended completion</option><option value="due-latest">Latest intended completion</option><option value="priority-high">Highest priority first</option><option value="priority-low">Lowest priority first</option></select></label>
          </div>
          <div className="event-list" role="tabpanel" id="task-status-panel" aria-labelledby={`task-tab-${status}`} tabIndex={0} aria-busy={busy}>
            <p className="hint">{visible.length} shown / {counts[status]} total {status}</p>
            {busy && <p role="status">Saving task update...</p>}
            {visible.map(task => <TaskCard key={task.id} task={task} timezone={student.timezone} instant={clock} busy={busy} onOpen={id => navigate({ section: "tasks", taskId: id })} onComplete={() => void mutate(() => service.completeTask(task.id), "Task completed. Find it in Completed.")} onMiss={() => void mutate(() => service.markTaskMissed(task.id), "Missed outcome recorded. Find it in Missed.")}>
              <div className="task-card-info"><h2 className="task-title" title={task.title}>{task.title}</h2><p className="task-card-source">{task.source.kind === "habit" ? `${task.source.habitName} · Scheduled ${formatDate(task.source.scheduledDate)}` : "Personal task"}</p></div>
              <div className="task-card-meta">
                {task.status === "missed" && <span className="badge red">Missed</span>}
                {isTaskOverdue(task, student.timezone, clock) && <span className="badge amber">Awaiting outcome</span>}
                <span className="task-priority-dot" role="img" aria-label={`${task.priority} priority`} title={`Priority: ${task.priority}`}/>
                <span className="task-card-deadline" title={task.dueDate ? `Intended completion: ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : " (date only)"}` : "No deadline"}>{task.dueDate ? <>{formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ""}</> : "No deadline"}</span>
                <span className="task-source-pill">{task.source.kind === "habit" ? "Habit" : "Task"}</span>
              </div>

            </TaskCard>)}
            {!visible.length && <div className="empty"><h2>{historyEmpty ? "No results for this history period" : status === "active" ? "No active tasks" : status === "pending" ? "No pending tasks" : status === "completed" ? "No completed tasks yet" : "No missed tasks"}</h2><p>{historyEmpty ? "Choose All time to review earlier habit outcomes. Ordinary task visibility is unchanged." : status === "active" ? "Future and undated unfinished tasks appear here. Complete a task early or set its deadline." : status === "pending" ? "Tasks await an outcome here once their deadline arrives. Complete them, mark them missed, or edit a deadline." : status === "completed" ? "Completed tasks and their actual completion times appear here." : "Tasks appear here only after an explicit missed outcome is recorded."}</p></div>}
          </div>
        </section>}
        <footer className="page-footer"><span>AkadVerse account · Saved to your workspace</span><span>Account synchronization</span></footer>
      </main>
    {editor && <TaskForm task={editor.task} timezone={student.timezone} onClose={() => setEditor(undefined)} onSave={async input => {
      const saved = editor.task ? await service.updateTask(editor.task.id, input) : await service.createTask(input);
      setTasks(previous => previous?.some(task => task.id === saved.id) ? previous.map(task => task.id === saved.id ? saved : task) : [...(previous || []), saved]);
      setNotice("Task saved.");
      setClock(new Date());
    }} />}
    {selected && !editor && !deleting && <Dialog title={selected.title} onClose={() => closeTask()}><div className="detail task-detail">
      {selected.source.kind === "habit" && <HabitBadge />}
      <p>{selected.source.kind === "habit" ? `Habit: ${selected.source.habitName}` : "Ordinary task"} · {taskViewStatus(selected, student.timezone, clock)}{selected.deletedAt ? " · Deleted" : ""}</p>
      {selected.description && <p className="description">{selected.description}</p>}
      <dl><dt>Priority</dt><dd>{selected.priority}</dd><dt>Intended completion</dt><dd><Deadline task={selected} /></dd><dt>Created</dt><dd><Stamp value={selected.createdAt} timezone={student.timezone} /></dd><dt>Last updated</dt><dd><Stamp value={selected.updatedAt} timezone={student.timezone} /></dd>{selected.completedAt && <><dt>Actually completed</dt><dd><Stamp value={selected.completedAt} timezone={student.timezone} /></dd></>}{selected.missedAt && <><dt>Missed outcome recorded</dt><dd><Stamp value={selected.missedAt} timezone={student.timezone} /></dd></>}{selected.source.kind === "habit" && <><dt>Scheduled date</dt><dd>{selected.source.scheduledDate}</dd></>}</dl>
      {isTaskOverdue(selected, student.timezone, clock) && <p className="notice">Overdue. This task remains unfinished until you record its outcome.</p>}
      {selected.source.kind === "habit" && <div className="detail-actions"><WorkspaceButton section="habits" habitId={selected.source.habitId} occurrenceDate={selected.source.scheduledDate}>Open habit</WorkspaceButton><WorkspaceButton section="habits" habitId={selected.source.habitId} editHabit>Edit habit</WorkspaceButton></div>}
      <h3>Audit history</h3><ol className="timeline">{selected.history.map(entry => <li key={entry.id}><strong>{entry.kind}</strong><Stamp value={entry.at} timezone={student.timezone} /><p>{entry.snapshot.title} · {entry.snapshot.priority} priority · Intended: {entry.snapshot.dueDate || "No deadline"}{entry.snapshot.dueTime ? ` ${entry.snapshot.dueTime}` : ""}</p></li>)}</ol>
      {saveError && <p className="error" role="alert">{saveError}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <TaskDetailActions task={selected} busy={busy} onEdit={() => setEditor({ task: selected })} onDelete={() => { setSaveError(""); setDeleteId(selected.id); }} />
    </div></Dialog>}
    {deleting && <Dialog title="Delete this task?" onClose={() => { if (!busy) setDeleteId(undefined); }}><div className="detail"><p>Remove “{deleting.title}” from your lists? This is deletion, not completion. Its audit records will be preserved; this milestone has no restore action.</p>{saveError && <p className="error" role="alert">{saveError}</p>}<div className="detail-actions"><button disabled={busy} onClick={() => setDeleteId(undefined)}>Cancel</button><button className="danger" disabled={busy} onClick={async () => { if (await mutate(() => service.deleteTask(deleting.id), "Task deleted. Audit records retained.")) { setDeleteId(undefined); closeTask(); } }}>{busy ? "Deleting…" : "Confirm deletion"}</button></div></div></Dialog>}
  </div>;
}
