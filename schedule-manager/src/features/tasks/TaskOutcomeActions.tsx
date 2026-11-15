"use client";
import { taskViewStatus, type Task } from "./domain";

export function TaskOutcomeActions({ task, timezone, instant, busy, onComplete, onMiss, compact = false }: { task: Task; timezone: string; instant?: Date; busy: boolean; onComplete: () => void; onMiss: () => void; compact?: boolean }) {
  if (task.deletedAt) return null;
  if (task.status === "pending") return <>
    <button type="button" className="outcome-complete" aria-label={`Complete task: ${task.title}`} title={`Complete task: ${task.title}`} disabled={busy} onClick={event => { event.stopPropagation(); onComplete(); }}>{compact ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg><span className="sr-only">Complete</span></> : "Complete"}</button>
    {taskViewStatus(task, timezone, instant) === "pending" && <button type="button" className="outcome-missed" disabled={busy} onClick={event => { event.stopPropagation(); onMiss(); }}>Mark missed</button>}
  </>;
  return null;
}
