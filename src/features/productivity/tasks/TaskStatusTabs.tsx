"use client";
import { useRef, type KeyboardEvent } from "react";
import type { TaskViewStatus } from "./domain";

const statuses: TaskViewStatus[] = ["active", "pending", "completed", "missed"];
export function TaskStatusTabs({ status, counts, onSelect }: { status: TaskViewStatus; counts: Record<TaskViewStatus, number>; onSelect: (status: TaskViewStatus) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % statuses.length : event.key === "ArrowLeft" ? (index + statuses.length - 1) % statuses.length : event.key === "Home" ? 0 : event.key === "End" ? statuses.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(statuses[next]);
    buttons.current[next]?.focus();
  }
  return <div className="tabs task-status-tabs" role="tablist" aria-label="Task status">
    {statuses.map((value, index) => <button key={value} ref={button => { buttons.current[index] = button; }} type="button" role="tab" id={`task-tab-${value}`} aria-controls="task-status-panel" aria-selected={status === value} tabIndex={status === value ? 0 : -1} className={"tab " + (status === value ? "active" : "")} onClick={() => onSelect(value)} onKeyDown={event => keyDown(event, index)}>{value[0].toUpperCase() + value.slice(1)} ({counts[value]})</button>)}
  </div>;
}
