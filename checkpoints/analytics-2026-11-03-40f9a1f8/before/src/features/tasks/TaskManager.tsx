"use client";
import { WorkspaceSections } from "../workspace/WorkspaceSections";
import { WorkspaceButton, useWorkspaceNavigation } from "../workspace/WorkspaceNavigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { developmentIdentity } from "../schedule/adapters";
import { Dialog, Stamp, formatDate } from "../schedule/Forms";
import type { Student } from "../schedule/domain";
import { isTaskOverdue, type Task, type TaskStatus } from "./domain";
import { TaskService } from "./service";
import { BrowserTaskRepository, TASK_STORAGE_KEY, TASKS_CHANGED } from "./storage";
import { queryTasks, taskStatusCounts, type TaskSort } from "./queries";
import { TaskForm } from "./TaskForm";
import { TaskStatusTabs } from "./TaskStatusTabs";
import { TaskOutcomeActions } from "./TaskOutcomeActions";

function Deadline({ task }: { task: Task }) {
  return <>{task.dueDate ? <>{formatDate(task.dueDate, true)}{task.dueTime ? ` · ${task.dueTime}` : " · Date only"}</> : "No deadline"}</>;
}
export function TaskManager({ initialTaskId }: { initialTaskId?: string }) {
  const navigate = useWorkspaceNavigation();
  const closeTask = () => navigate({ section: "tasks" });
  const [service] = useState(() => new TaskService(new BrowserTaskRepository(), developmentIdentity));
  const [tasks, setTasks] = useState<Task[]>(), [student, setStudent] = useState<Student>();
  const [loadError, setLoadError] = useState(""), [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending"), [sort, setSort] = useState<TaskSort>("newest");
  const [editor, setEditor] = useState<{ task?: Task }>(), [deleteId, setDeleteId] = useState<string>();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [clock, setClock] = useState<Date>();
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [current, records] = await Promise.all([service.getCurrentStudent(), service.listTasks()]);
      setStudent(current); setTasks(records); setLoadError(""); setClock(new Date());
    } catch (error) { setLoadError((error as Error).message); }
  }, [service]);
  useEffect(() => {
    let active = true;
    Promise.all([service.getCurrentStudent(), service.listTasks()]).then(([current, records]) => {
      if (active) { setStudent(current); setTasks(records); setClock(new Date()); }
    }).catch(error => { if (active) setLoadError((error as Error).message); });
    const changed = (event: StorageEvent) => { if (event.key === TASK_STORAGE_KEY || event.key === null) void refresh(); };
    const reload = () => { void refresh(); };
    window.addEventListener("storage", changed); window.addEventListener("focus", reload); window.addEventListener(TASKS_CHANGED, reload);
    return () => { active = false; window.removeEventListener("storage", changed); window.removeEventListener("focus", reload); window.removeEventListener(TASKS_CHANGED, reload); };
  }, [service, refresh]);
  async function mutate(operation: () => Promise<Task>, message: string) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true); setSaveError(""); setNotice("");
    try {
      const saved = await operation();
      setTasks(previous => previous?.map(task => task.id === saved.id ? saved : task));
      setNotice(message); return true;
    } catch (error) { setSaveError((error as Error).message); return false; } finally { saving.current = false; setBusy(false); }
  }
  if (!tasks || !student) return <main className="loading"><h1>{loadError ? "Tasks could not be loaded" : "Loading your tasks…"}</h1>{loadError ? <><p role="alert" className="error">{loadError}</p><p>Saved records have not been replaced.</p><button onClick={() => void refresh()}>Retry loading</button></> : <p role="status">Reading your saved tasks.</p>}<WorkspaceButton section="schedule">Open Schedule Manager</WorkspaceButton></main>;
  const selected = tasks.find(task => task.id === initialTaskId);
  const visible = queryTasks(tasks, { timezone: student.timezone, status, sort });
  const counts = taskStatusCounts(tasks);
  const deleting = tasks.find(task => task.id === deleteId);
  return <div className="app-shell">
    <aside className="sidebar">
      <WorkspaceButton className="brand" section="schedule"><span className="brand-mark">P</span><span>Productivity<span className="brand-sub">LAYER</span></span></WorkspaceButton>
      <p className="nav-label">YOUR WORKSPACE</p>
      <WorkspaceSections active="tasks" />
      <div className="sidebar-bottom"><span className="avatar">DS</span><div><strong>{student.name}</strong><small>Prototype identity</small></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span>Workspace / To-do List</span><span className="prototype">LOCAL PROTOTYPE</span></header>
      <main className="content tasks-content">
        <div className="page-heading"><div><p className="eyebrow">ONE THING AT A TIME</p><h1>To-do List</h1><p className="muted">Your ordinary tasks and task-type habit occurrences. All dates use {student.timezone}.</p></div><button className="primary" onClick={() => { setSaveError(""); setEditor({}); }}>＋ New task</button></div>
        {loadError && <p className="error" role="alert">{loadError} <button onClick={() => void refresh()}>Retry loading</button></p>}
        {saveError && <p className="error" role="alert">{saveError} Retry the action when ready.</p>}
        {notice && <p className="success banner" role="status">{notice}</p>}
        {initialTaskId && !selected && <p className="notice" role="status">This task was not found for this student. <WorkspaceButton section="tasks">View your tasks</WorkspaceButton></p>}
        <section className="schedule-panel" aria-label="Tasks">
          <div className="panel-toolbar"><TaskStatusTabs status={status} counts={counts} onSelect={setStatus} /></div>
          <div className="task-filters">
            <label>Sort by<select value={sort} onChange={event => setSort(event.target.value as TaskSort)}><option value="newest">Newest created</option><option value="oldest">Oldest created</option><option value="due-earliest">Earliest intended completion</option><option value="due-latest">Latest intended completion</option><option value="priority-high">Highest priority first</option><option value="priority-low">Lowest priority first</option></select></label>
          </div>
          <div className="event-list" role="tabpanel" id="task-status-panel" aria-labelledby={`task-tab-${status}`} tabIndex={0} aria-busy={busy}>
            <p className="hint">{visible.length} shown / {counts[status]} total {status}</p>
            {busy && <p role="status">Saving task update...</p>}
            {visible.map(task => <article className={"event-card " + (task.status === "completed" ? "completed" : task.status === "missed" ? "missed" : "")} key={task.id}>
              <div className="event-info"><div className="badges"><span className={"badge priority-" + task.priority}>{task.priority} priority</span><span className="badge">{task.source.kind === "habit" ? "Habit task" : "Ordinary task"}</span><span className={"badge " + (task.status === "missed" ? "red" : task.status === "completed" ? "green" : "")}>{task.status}</span>{isTaskOverdue(task, student.timezone, clock) && <span className="badge amber">Overdue</span>}</div>
                <h2><WorkspaceButton className="task-title" section="tasks" taskId={task.id}>{task.title}</WorkspaceButton></h2>
                {task.source.kind === "habit" && <p>Habit: {task.source.habitName} · Scheduled {task.source.scheduledDate}</p>}
                <p>Intended completion: <Deadline task={task} /></p>
                {task.completedAt && <p>Actually completed: <Stamp value={task.completedAt} timezone={student.timezone} /></p>}
                {task.missedAt && <p>Missed outcome recorded: <Stamp value={task.missedAt} timezone={student.timezone} /></p>}
              </div>
              <div className="card-actions"><WorkspaceButton section="tasks" taskId={task.id}>View task</WorkspaceButton><TaskOutcomeActions task={task} busy={busy} onComplete={() => void mutate(() => service.completeTask(task.id), "Task completed. Find it in Completed.")} onMiss={() => void mutate(() => service.markTaskMissed(task.id), "Missed outcome recorded. Find it in Missed.")} /></div>
            </article>)}
            {!visible.length && <div className="empty"><h2>{status === "pending" ? "No pending tasks" : status === "completed" ? "No completed tasks yet" : "No missed tasks"}</h2><p>{status === "pending" ? "New tasks appear here until you explicitly complete or mark them missed." : status === "completed" ? "Completed tasks and their actual completion times appear here." : "Tasks appear here only after an explicit missed outcome is recorded."}</p></div>}
          </div>
        </section>
        <p className="notice">Habits are created in the Habit Tracker. That section is not implemented yet; no sample habit tasks are added to your data.</p>
        <footer className="page-footer"><span>Development identity · Browser persistence</span><span>No account sync</span></footer>
      </main>
    </div>
    {editor && <TaskForm task={editor.task} timezone={student.timezone} onClose={() => setEditor(undefined)} onSave={async input => {
      const saved = editor.task ? await service.updateTask(editor.task.id, input) : await service.createTask(input);
      setTasks(previous => previous?.some(task => task.id === saved.id) ? previous.map(task => task.id === saved.id ? saved : task) : [...(previous || []), saved]);
      setNotice("Task saved.");
      if (!editor.task) setStatus("pending");
    }} />}
    {selected && !editor && !deleting && <Dialog title={selected.title} onClose={() => closeTask()}><div className="detail task-detail">
      <p>{selected.source.kind === "habit" ? `Habit: ${selected.source.habitName}` : "Ordinary task"} · {selected.status}{selected.deletedAt ? " · Deleted" : ""}</p>
      {selected.description && <p className="description">{selected.description}</p>}
      <dl><dt>Priority</dt><dd>{selected.priority}</dd><dt>Intended completion</dt><dd><Deadline task={selected} /></dd><dt>Created</dt><dd><Stamp value={selected.createdAt} timezone={student.timezone} /></dd><dt>Last updated</dt><dd><Stamp value={selected.updatedAt} timezone={student.timezone} /></dd>{selected.completedAt && <><dt>Actually completed</dt><dd><Stamp value={selected.completedAt} timezone={student.timezone} /></dd></>}{selected.missedAt && <><dt>Missed outcome recorded</dt><dd><Stamp value={selected.missedAt} timezone={student.timezone} /></dd></>}{selected.source.kind === "habit" && <><dt>Scheduled date</dt><dd>{selected.source.scheduledDate}</dd></>}</dl>
      {isTaskOverdue(selected, student.timezone, clock) && <p className="notice">Overdue. This task remains unfinished until you record its outcome.</p>}
      {selected.source.kind === "habit" && <p className="notice">Habit fields are read-only here. The Habit Tracker destination is not implemented yet; Open habit navigation will be enabled with that section.</p>}
      <h3>Audit history</h3><ol className="timeline">{selected.history.map(entry => <li key={entry.id}><strong>{entry.kind}</strong><Stamp value={entry.at} timezone={student.timezone} /><p>{entry.snapshot.title} · {entry.snapshot.priority} priority · Intended: {entry.snapshot.dueDate || "No deadline"}{entry.snapshot.dueTime ? ` ${entry.snapshot.dueTime}` : ""}</p></li>)}</ol>
      {saveError && <p className="error" role="alert">{saveError}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {!selected.deletedAt && <div className="detail-actions">{selected.source.kind === "ordinary" && <><button className="danger" disabled={busy} onClick={() => { setSaveError(""); setDeleteId(selected.id); }}>Delete task</button>{selected.status === "pending" && <button disabled={busy} onClick={() => setEditor({ task: selected })}>Edit task</button>}</>}<TaskOutcomeActions task={selected} busy={busy} allowLateCompletion onComplete={() => void mutate(() => service.completeTask(selected.id), "Task completed. Find it in Completed.")} onMiss={() => void mutate(() => service.markTaskMissed(selected.id), "Missed outcome recorded. Find it in Missed.")} /></div>}
    </div></Dialog>}
    {deleting && <Dialog title="Delete this task?" onClose={() => { if (!busy) setDeleteId(undefined); }}><div className="detail"><p>Remove “{deleting.title}” from your lists? This is deletion, not completion. Its audit records will be preserved; this milestone has no restore action.</p>{saveError && <p className="error" role="alert">{saveError}</p>}<div className="detail-actions"><button disabled={busy} onClick={() => setDeleteId(undefined)}>Cancel</button><button className="danger" disabled={busy} onClick={async () => { if (await mutate(() => service.deleteTask(deleting.id), "Task deleted. Audit records retained.")) { setDeleteId(undefined); closeTask(); } }}>{busy ? "Deleting…" : "Confirm deletion"}</button></div></div></Dialog>}
  </div>;
}
