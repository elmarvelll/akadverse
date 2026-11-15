"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { HabitTracker } from "../habits/HabitTracker";
import { browserHabits } from "../habits/browser";
import { developmentIdentity } from "../schedule/adapters";
import { localNow } from "../schedule/domain";
import { ScheduleManager } from "../schedule/ScheduleManager";
import { TaskManager } from "../tasks/TaskManager";
import { workspaceLocation, type WorkspaceSelection } from "./navigation";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}
export function Workspace() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const [selection, setSelection] = useState<WorkspaceSelection>();
  const location = selection || workspaceLocation(hash);
  const [ready, setReady] = useState<string>(), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function prepare() {
      const student = await developmentIdentity.getCurrentStudent(), today = localNow(student.timezone).date;
      await browserHabits.synchronize({ start: today, end: today }, { tasks: "today" });
      if (active) { setReady(location.section); setError(""); }
    }
    void prepare().catch(error => { if (active) setError((error as Error).message); });
    return () => { active = false; };
  }, [location.section, retry]);
  return <WorkspaceNavigation.Provider value={setSelection}>{ready !== location.section ? <main className="loading"><h1>{error ? "Saved activities could not be loaded" : "Loading your workspace..."}</h1>{error && <><p className="error" role="alert">{error}</p><p>Existing records have not been reset.</p><button onClick={() => setRetry(value => value + 1)}>Retry loading</button><button onClick={() => { setReady(location.section); setError(""); }}>Open section without generating habits</button></>}</main> : location.section === "habits" ? <HabitTracker initialHabitId={location.habitId} initialDate={location.occurrenceDate} /> : location.section === "tasks" ? <TaskManager initialTaskId={location.taskId} /> : <ScheduleManager />}</WorkspaceNavigation.Provider>;
}
