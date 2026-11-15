"use client";
import type { Task } from "./domain";

export function TaskDetailActions({ task, busy, onEdit, onDelete }: { task: Task; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  if (task.deletedAt || task.source.kind !== "ordinary") return null;
  return <div className="detail-actions">
    {task.status === "pending" && <button type="button" disabled={busy} onClick={onEdit}>Edit task</button>}
    <button type="button" className="danger" disabled={busy} onClick={onDelete}>Delete task</button>
  </div>;
}
