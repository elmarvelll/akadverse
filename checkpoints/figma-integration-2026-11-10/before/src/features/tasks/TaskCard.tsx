"use client";
import type { ReactNode } from "react";
import type { Task } from "./domain";
import { TaskOutcomeActions } from "./TaskOutcomeActions";

export function TaskCard({ task, timezone, instant, busy, onOpen, onComplete, onMiss, children }: { task: Task; timezone: string; instant?: Date; busy: boolean; onOpen: (id: string) => void; onComplete: () => void; onMiss: () => void; children: ReactNode }) {
  return <article className={"event-card task-card " + (task.status === "completed" ? "completed" : task.status === "missed" ? "missed" : "")}>
    {children}
    <button type="button" className="task-card-open" aria-label={`Open details for ${task.title}`} onClick={() => onOpen(task.id)} />
    <div className="card-actions"><TaskOutcomeActions task={task} timezone={timezone} instant={instant} busy={busy} onComplete={onComplete} onMiss={onMiss} /></div>
  </article>;
}
