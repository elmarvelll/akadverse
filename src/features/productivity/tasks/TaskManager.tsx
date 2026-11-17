"use client";
import { RefreshIndicator } from "../workspace/RefreshIndicator";
import { productivityErrorMessage } from "../errors";
import { habitDuplicateConflicts } from "../habits/duplicates";
import { HabitBadge } from "../habits/HabitLabel";
import { WorkspaceButton, useWorkspaceNavigation } from "../workspace/WorkspaceNavigation";
import { Icon, ProdButton } from "../workspace/Design";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useWorkspaceSnapshot, useSectionActive } from "../workspace/queries";
import { remoteTasks } from "../client";
import { Dialog, Stamp, formatDate } from "../schedule/Forms";
import { todoTasks, filterHabitHistory, type HabitHistoryPeriod } from "./todo";
import { isTaskListEligible, isTaskOverdue, taskViewStatus, type Task, type TaskViewStatus } from "./domain";

import { queryTasks, taskStatusCounts, type TaskSort } from "./queries";
import { TaskForm } from "./TaskForm";
const AnalyticsPanel = dynamic(() => import("../analytics/AnalyticsPanel").then(module => module.AnalyticsPanel));
import { TaskStatusTabs } from "./TaskStatusTabs";
import { TaskCard } from "./TaskCard";
import { TaskDetailActions } from "./TaskDetailActions";
import { localNow } from "../schedule/domain";

function Deadline({ task }: { task: Task }) {
  return <>{task.dueDate ? <>{formatDate(task.dueDate, true)}{task.dueTime ? ` · ${task.dueTime}` : " · Date only"}</> : "No deadline"}</>;
}
export function TaskManager({ initialTaskId }: { initialTaskId?: string }) {
  const [historyPeriod, setHistoryPeriod] = useState<HabitHistoryPeriod>("all");
  const [analytics, setAnalytics] = useState(false);
  const navigate = useWorkspaceNavigation();
  const closeTask = () => navigate({ section: "tasks" });
  const [service] = useState(() => remoteTasks);
  const [status, setStatus] = useState<TaskViewStatus>("active"), [sort, setSort] = useState<TaskSort>("newest");
  const [editor, setEditor] = useState<{ task?: Task }>(), [deleteId, setDeleteId] = useState<string>();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const active = useSectionActive();
  const { snapshot, setSnapshot, error: loadError, refreshing, loadingAdditional, clock, refresh } = useWorkspaceSnapshot({ section: "tasks", status, sort, period: historyPeriod, page, taskId: initialTaskId });
  const tasks = snapshot?.data.tasks.tasks, student = snapshot?.student, habits = snapshot?.data.habits.habits || [];
  const setTasks = (update: (previous: Task[] | undefined) => Task[] | undefined) => setSnapshot(previous => {
    if (!previous) return previous;
    const updated = update(previous.data.tasks.tasks) || [], counts = previous.counts && { ...previous.counts };
    if (counts) {
      const at = new Date(previous.serverTime), before = taskStatusCounts(previous.data.tasks.tasks, previous.student.timezone, at), after = taskStatusCounts(updated, previous.student.timezone, at);
      for (const status of ["active", "pending", "completed", "missed"] as const) counts[status] = Math.max(0, counts[status] + after[status] - before[status]);
    }
    return { ...previous, counts, data: { ...previous.data, tasks: { version: 2, tasks: updated } } };
  });
  const [analyticsTasks, setAnalyticsTasks] = useState<Task[]>(), [analyticsError, setAnalyticsError] = useState("");
  const [analyticsRetry, setAnalyticsRetry] = useState(0);
  const analyticsDate = snapshot && localNow(snapshot.student.timezone, new Date(snapshot.serverTime)).date;
  const analyticsZone = snapshot?.student.timezone;
  useEffect(() => {
    if (!analytics || !active) return;
    let current = true;
    let loadedAt = 0;
    const load = () => { void service.listTasks().then(records => { if (current) { loadedAt = Date.now(); setAnalyticsTasks(records); setAnalyticsError(""); } }).catch(error => { if (current) setAnalyticsError(productivityErrorMessage(error)); }); };
    const changed = (event: Event) => { if ((event as CustomEvent<string[]>).detail.includes("tasks")) load(); };
    const foreground = () => { if (document.visibilityState === "visible" && analyticsZone && localNow(analyticsZone).date === analyticsDate && Date.now() - loadedAt >= 60000) load(); };
    load(); window.addEventListener("productivity:invalidated", changed); window.addEventListener("focus", foreground); document.addEventListener("visibilitychange", foreground);
    return () => { current = false; window.removeEventListener("productivity:invalidated", changed); window.removeEventListener("focus", foreground); document.removeEventListener("visibilitychange", foreground); };
  }, [analytics, active, service, analyticsRetry, analyticsDate, analyticsZone]);
  async function mutate(operation: () => Promise<Task>) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      const saved = await operation();
      setTasks(previous => previous?.map(task => task.id === saved.id ? saved : task));
       return true;
    } catch { return false; } finally { saving.current = false; setBusy(false); }
  }
  if (!tasks || !student) return <main className="loading"><h1>{loadError ? "Tasks could not be loaded" : "Loading your tasks…"}</h1>{loadError ? <><p role="alert" className="error">{loadError}</p><p>Saved records have not been replaced.</p><button onClick={() => void refresh()}>Retry loading</button></> : <p role="status">Reading your saved tasks.</p>}<WorkspaceButton section="schedule">Open Schedule Manager</WorkspaceButton></main>;
  const duplicateConflicts = habitDuplicateConflicts(tasks);
  const scopedTasks = clock ? todoTasks(tasks, habits, student.timezone, clock) : tasks.filter(task => task.source.kind !== "habit");
  const requestedTask = tasks.find(task => task.id === initialTaskId);
  const selected = scopedTasks.find(task => task.id === initialTaskId);
  const historyTasks = clock ? filterHabitHistory(scopedTasks, historyPeriod, student.timezone, clock) : scopedTasks;
  const listTasks = status === "completed" || status === "missed" ? historyTasks : scopedTasks;
  const visible = queryTasks(listTasks, { timezone: student.timezone, instant: clock, status, sort }).slice(0, 100);
  const counts = snapshot?.counts ? { ...snapshot.counts } : taskStatusCounts(scopedTasks, student.timezone, clock);
  // Apply known deadline transitions immediately; the minute refresh obtains
  // authoritative counts for records beyond the current page.
  if (snapshot?.counts) for (const task of tasks) {
    if (task.deletedAt || task.habitWithdrawn) continue;
    const previousTime = new Date(snapshot.serverTime), previous = taskViewStatus(task, student.timezone, previousTime), current = taskViewStatus(task, student.timezone, clock);
    const wasEligible = isTaskListEligible(task, student.timezone, previousTime), eligible = isTaskListEligible(task, student.timezone, clock);
    if (previous !== current || wasEligible !== eligible) { if (wasEligible) counts[previous] = Math.max(0, counts[previous] - 1); if (eligible) counts[current]++; }
  }
  const historicalCounts = taskStatusCounts(historyTasks, student.timezone, clock);
  counts.completed = snapshot?.counts?.completed ?? historicalCounts.completed; counts.missed = snapshot?.counts?.missed ?? historicalCounts.missed;
  const historyEmpty = (status === "completed" || status === "missed") && historyPeriod !== "all";
  const deleting = tasks.find(task => task.id === deleteId);
  return <div className="module-view tasks-module"><main className="content tasks-content">
        <div className="page-heading"><div><p className="eyebrow">ONE THING AT A TIME</p><h1>{analytics ? "To-do analytics" : "To-do List"}</h1><p className="muted">Keep your commitments clear. One task at a time.</p></div>{!analytics && <ProdButton className="primary" onClick={() => {  setEditor({}); }}><Icon name="plus"/> New task</ProdButton>}</div>
        <div className="analytics-view-switch" role="group" aria-label="To-do view"><button type="button" aria-pressed={!analytics} onClick={() => setAnalytics(false)}>Tasks</button><button type="button" aria-pressed={analytics} onClick={() => setAnalytics(true)}>Analytics</button></div>
        {duplicateConflicts.length > 0 && <p className="error" role="alert">Conflicting duplicate habit outcomes require review. Stored outcomes have not been merged or deleted. {duplicateConflicts.join(", ")}</p>}
        {loadError && <p className="error" role="alert">{loadError} <button onClick={() => void refresh()}>Retry loading</button></p>}

        {initialTaskId && !selected && <p className="notice" role="status">{requestedTask?.source.kind === "habit" ? <>This habit occurrence is outside today&apos;s To-do List. <WorkspaceButton section="habits" habitId={requestedTask.source.habitId} occurrenceDate={requestedTask.source.scheduledDate}>Review in Habit Tracker</WorkspaceButton></> : "This task was not found for this student."} <WorkspaceButton section="tasks">View your tasks</WorkspaceButton></p>}
        {analytics ? analyticsTasks ? <AnalyticsPanel kind="tasks" student={student} tasks={analyticsTasks} /> : <section role="status">{analyticsError || "Loading task analytics..."}{analyticsError && <button onClick={() => setAnalyticsRetry(value => value + 1)}>Retry analytics</button>}</section> : <section className="schedule-panel" aria-label="Tasks">
          <div className="panel-toolbar"><TaskStatusTabs status={status} counts={counts} onSelect={value => { setStatus(value); setPage(0); }} /></div>
          <div className="task-filters">
            {(status === "completed" || status === "missed") && <label>Habit history<select value={historyPeriod} onChange={event => { setHistoryPeriod(event.target.value as HabitHistoryPeriod); setPage(0); }}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select></label>}
            <label>Sort by<select value={sort} onChange={event => { setSort(event.target.value as TaskSort); setPage(0); }}><option value="newest">Newest created</option><option value="oldest">Oldest created</option><option value="due-earliest">Earliest intended completion</option><option value="due-latest">Latest intended completion</option><option value="priority-high">Highest priority first</option><option value="priority-low">Lowest priority first</option></select></label>
          </div>
          <div className="event-list" role="tabpanel" id="task-status-panel" aria-labelledby={`task-tab-${status}`} tabIndex={0} aria-busy={busy || refreshing}>
            <RefreshIndicator active={refreshing || loadingAdditional} label={loadingAdditional ? "Loading this task page..." : "Refreshing tasks..."}/>
            <div className="detail-actions productivity-pagination"><button disabled={!page || refreshing || loadingAdditional} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page + 1}</span><button disabled={!snapshot?.hasMore || refreshing || loadingAdditional} onClick={() => setPage(value => value + 1)}>Next page</button></div>
            <p className="hint">{visible.length} shown / {counts[status]} total {status}</p>

            {visible.map(task => <TaskCard key={task.id} task={task} timezone={student.timezone} instant={clock} busy={busy} onOpen={id => navigate({ section: "tasks", taskId: id })} onComplete={() => void mutate(() => service.completeTask(task.id))} onMiss={() => void mutate(() => service.markTaskMissed(task.id))}>
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

    }} />}
    {selected && !editor && !deleting && <Dialog title={selected.title} onClose={() => closeTask()}><div className="detail task-detail">
      {selected.source.kind === "habit" && <HabitBadge />}
      <p>{selected.source.kind === "habit" ? `Habit: ${selected.source.habitName}` : "Ordinary task"} · {taskViewStatus(selected, student.timezone, clock)}{selected.deletedAt ? " · Deleted" : ""}</p>
      {selected.description && <p className="description">{selected.description}</p>}
      <dl><dt>Priority</dt><dd>{selected.priority}</dd><dt>Intended completion</dt><dd><Deadline task={selected} /></dd><dt>Allocated working time</dt><dd>{selected.scheduledSlot ? `${selected.scheduledSlot.date} · ${selected.scheduledSlot.start}–${selected.scheduledSlot.end} · ${selected.scheduledSlot.timezone}` : "Not scheduled"}</dd><dt>Created</dt><dd><Stamp value={selected.createdAt} timezone={student.timezone} /></dd><dt>Last updated</dt><dd><Stamp value={selected.updatedAt} timezone={student.timezone} /></dd>{selected.completedAt && <><dt>Actually completed</dt><dd><Stamp value={selected.completedAt} timezone={student.timezone} /></dd></>}{selected.missedAt && <><dt>Missed outcome recorded</dt><dd><Stamp value={selected.missedAt} timezone={student.timezone} /></dd></>}{selected.source.kind === "habit" && <><dt>Scheduled date</dt><dd>{selected.source.scheduledDate}</dd></>}</dl>
      {isTaskOverdue(selected, student.timezone, clock) && <p className="notice">Overdue. This task remains unfinished until you record its outcome.</p>}
      {selected.source.kind === "habit" && <div className="detail-actions"><WorkspaceButton section="habits" habitId={selected.source.habitId} occurrenceDate={selected.source.scheduledDate}>Open habit</WorkspaceButton><WorkspaceButton section="habits" habitId={selected.source.habitId} editHabit>Edit habit</WorkspaceButton></div>}
      <h3>Audit history</h3><ol className="timeline">{selected.history.map(entry => <li key={entry.id}><strong>{entry.kind}</strong><Stamp value={entry.at} timezone={student.timezone} /><p>{entry.snapshot.title} · {entry.snapshot.priority} priority · Intended: {entry.snapshot.dueDate || "No deadline"}{entry.snapshot.dueTime ? ` ${entry.snapshot.dueTime}` : ""}{entry.snapshot.scheduledSlot ? ` · Scheduled: ${entry.snapshot.scheduledSlot.date} ${entry.snapshot.scheduledSlot.start}–${entry.snapshot.scheduledSlot.end}` : ""}</p></li>)}</ol>

      <TaskDetailActions task={selected} busy={busy} onEdit={() => setEditor({ task: selected })} onDelete={() => {  setDeleteId(selected.id); }} />
    </div></Dialog>}
    {deleting && <Dialog title="Delete this task?" onClose={() => { if (!busy) setDeleteId(undefined); }}><div className="detail"><p>Remove “{deleting.title}” from your lists? This is deletion, not completion. Its audit records will be preserved; this milestone has no restore action.</p><div className="detail-actions"><button disabled={busy} onClick={() => setDeleteId(undefined)}>Cancel</button><button className="danger" disabled={busy} onClick={async () => { if (await mutate(() => service.deleteTask(deleting.id))) { setDeleteId(undefined); closeTask(); } }}>{busy ? "Deleting…" : "Confirm deletion"}</button></div></div></Dialog>}
  </div>;
}
