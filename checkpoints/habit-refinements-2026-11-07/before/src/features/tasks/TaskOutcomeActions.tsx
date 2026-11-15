"use client";
import { taskViewStatus, type Task } from "./domain";

export function TaskOutcomeActions({ task, timezone, instant, busy, onComplete, onMiss }: { task: Task; timezone: string; instant?: Date; busy: boolean; onComplete: () => void; onMiss: () => void }) {
  if (task.deletedAt) return null;
  if (task.status === "pending") return <>
    <button type="button" className="outcome-complete" disabled={busy} onClick={event => { event.stopPropagation(); onComplete(); }}>Complete</button>
    {taskViewStatus(task, timezone, instant) === "pending" && <button type="button" className="outcome-missed" disabled={busy} onClick={event => { event.stopPropagation(); onMiss(); }}>Mark missed</button>}
  </>;
  return null;
}
