"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { prepareWorkspace, prepareOfficialRange, loadWorkspaceView, peekStudent } from "../client";
import { localNow } from "../schedule/domain";
import { scheduleDates, timetableSourceDates } from "../schedule/timetable";
import { productivityErrorMessage } from "../errors";
import { TodayView } from "../today/TodayView";
import { TaskManager } from "../tasks/TaskManager";
import { ScheduleManager } from "../schedule/ScheduleManager";
import { HabitTracker } from "../habits/HabitTracker";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { workspaceLocation, type WorkspaceSelection } from "./navigation";
import { SectionActivity } from "./queries";

// Core code belongs to this route. Only visited views mount; analytics stays lazy.
const sections = ["today", "tasks", "schedule", "habits"] as const;
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener); window.addEventListener("popstate", listener);
  return () => { window.removeEventListener("hashchange", listener); window.removeEventListener("popstate", listener); };
}
export function Workspace({ enabled = true }: { enabled?: boolean }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const [selection, setSelection] = useState<{ hash: string; value: WorkspaceSelection }>();
  const location = selection?.hash === hash ? selection.value : workspaceLocation(hash);
  const [visited, setVisited] = useState<Set<WorkspaceSelection["section"]>>(() => new Set());
  const [preparation, setPreparation] = useState({ core: false, complete: false, error: "", taskError: "" });
  const [retry, setRetry] = useState(0);
  const [retryingTasks, setRetryingTasks] = useState(false);
  const scrolls = useRef(new Map<string, { window: number; content: number }>());
  useLayoutEffect(() => {
    const scroll = scrolls.current.get(location.section);
    window.scrollTo(0, scroll?.window || 0);
    const content = document.getElementById("workspace-content"); if (content) content.scrollTop = scroll?.content || 0;
  }, [location.section]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const run = async () => {
      try {
        const initial = await prepareWorkspace(retry > 0);
        if (!active) return;
        setPreparation({ core: true, complete: false, error: "", taskError: initial.taskError || "" });
      } catch (error) {
        if (!active) return;
        setPreparation({ core: true, complete: false, error: productivityErrorMessage(error, "Shared preparation failed. Each section can still retry its own data."), taskError: "" });
        // A failed batch does not prevent independently usable sections.
        for (const section of sections) {
          if (!active) return;
          try { await loadWorkspaceView({ section }); } catch { /* Each section owns its retry. */ }
          if (section === "tasks") for (const status of ["pending", "completed", "missed"] as const) {
            if (!active) return;
            try { await loadWorkspaceView({ section, status }); } catch { /* Other pages and sections remain usable. */ }
          }
        }
      }
      if (!active) return;
      const today = localNow(peekStudent()?.timezone || "Africa/Lagos").date;
      const dates = timetableSourceDates(scheduleDates(today, "week"));
      try { await prepareOfficialRange({ start: dates[0], end: dates.at(-1)! }); }
      catch { /* The academic widget exposes its own localized error. */ }
      if (active) setPreparation(previous => ({ ...previous, complete: true }));
    };
    void Promise.resolve().then(() => { if (active) void run(); });
    return () => { active = false; };
  }, [enabled, retry]);
  const navigate = (value: WorkspaceSelection) => {
    scrolls.current.set(location.section, { window: window.scrollY, content: document.getElementById("workspace-content")?.scrollTop || 0 });
    setSelection({ hash, value }); setVisited(previous => new Set([...previous, ...(preparation.core ? [location.section] : []), value.section]));
  };
  const retryTasks = async () => {
    setRetryingTasks(true); let error = "";
    for (const status of ["active", "pending", "completed", "missed"] as const) {
      try { await loadWorkspaceView({ section: "tasks", status }); }
      catch (failure) { error ||= productivityErrorMessage(failure); }
    }
    setPreparation(previous => ({ ...previous, taskError: error })); setRetryingTasks(false);
  };
  return <WorkspaceNavigation.Provider value={navigate}><WorkspaceShell active={location.section}>
    <span hidden data-productivity-preparation={preparation.complete ? preparation.error || preparation.taskError ? "partial" : "ready" : "loading"} />
    {preparation.error && <p className="error" role="alert">{preparation.error} <button onClick={() => { setPreparation(previous => ({ ...previous, complete: false })); setRetry(value => value + 1); }}>Retry shared preparation</button></p>}
    {preparation.taskError && <p className="error" role="alert">To-do history could not be prepared. {preparation.taskError} <button disabled={retryingTasks} onClick={() => void retryTasks()}>{retryingTasks ? "Retrying task pages..." : "Retry task pages"}</button></p>}
    {!enabled || !preparation.core ? <main className="loading" role="status"><h1>{enabled ? "Preparing your workspace" : "Loading your account"}</h1><p>Your initial activities are loading. Navigation remains available.</p></main> : sections.filter(section => visited.has(section) || location.section === section).map(section => <SectionActivity.Provider key={section} value={location.section === section}><div hidden={location.section !== section} style={location.section !== section ? { display: "none" } : undefined} inert={location.section !== section}>
      {section === "today" ? <TodayView /> : section === "tasks" ? <TaskManager initialTaskId={location.section === section ? location.taskId : undefined} /> : section === "habits" ? <HabitTracker initialHabitId={location.section === section ? location.habitId : undefined} initialDate={location.section === section ? location.occurrenceDate : undefined} initialEdit={location.section === section ? location.editHabit : undefined} /> : <ScheduleManager initialEventId={location.section === section ? location.eventId : undefined} initialDate={location.section === section ? location.scheduleDate : undefined} />}
    </div></SectionActivity.Provider>)}
  </WorkspaceShell></WorkspaceNavigation.Provider>;
}
