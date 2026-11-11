"use client";
import type { ReactNode } from "react";
import type { Task } from "./domain";
import { TaskOutcomeActions } from "./TaskOutcomeActions";

export function TaskCard({ task, timezone, instant, busy, onOpen, onComplete, onMiss, children }: { task: Task; timezone: string; instant?: Date; busy: boolean; onOpen: (id: string) => void; onComplete: () => void; onMiss: () => void; children: ReactNode }) {
  // Reference ActivityCardRow: compact completion box, title/source and metadata.
  // Details and outcome actions remain sibling buttons with separate handlers.
  return <article data-priority={task.priority} className={"event-card task-card " + (task.status === "completed" ? "completed" : task.status === "missed" ? "missed" : "")}>
    {task.status !== "pending" && <span className="task-state-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{task.status === "completed" ? <path d="m5 12 4 4 10-10"/> : <path d="m6 6 12 12m0-12L6 18"/>}</svg></span>}
    {children}
    <button type="button" className="task-card-open" aria-label={`Open details for ${task.title}`} onClick={() => onOpen(task.id)} />
    <div className="card-actions"><TaskOutcomeActions compact task={task} timezone={timezone} instant={instant} busy={busy} onComplete={onComplete} onMiss={onMiss} /></div>
  </article>;
}
