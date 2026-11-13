"use client";
import { productivityErrorMessage } from "../errors";
import { useState, type FormEvent } from "react";
import { Dialog } from "../schedule/Forms";
import { taskSnapshot, type Task, type TaskInput } from "./domain";
export function TaskForm({ task, timezone, onSave, onClose }: { task?: Task; timezone: string; onSave: (input: TaskInput) => Promise<void>; onClose: () => void }) {
  const [input, setInput] = useState<TaskInput>(() => task ? taskSnapshot(task) : { title: "", description: "", priority: "medium" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave(input); onClose(); } catch (error) { setError(productivityErrorMessage(error, "This task could not be saved. Review the fields and try again.")); } finally { setBusy(false); }
  }
  return <Dialog title={task ? "Edit task" : "New task"} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={submit}>
      <p className="muted">Dates and times use {timezone}. A deadline is optional.</p>
      <fieldset disabled={busy}>
        <label>Title<input required autoFocus maxLength={200} value={input.title} onChange={event => setInput({ ...input, title: event.target.value })} /></label>
        <label>Description (optional)<textarea rows={4} maxLength={10000} value={input.description || ""} onChange={event => setInput({ ...input, description: event.target.value })} /></label>
        <label>Priority<select value={input.priority} onChange={event => setInput({ ...input, priority: event.target.value as TaskInput["priority"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <div className="form-row">
          <label>Intended completion date<input type="date" value={input.dueDate || ""} onChange={event => setInput({ ...input, dueDate: event.target.value || undefined, dueTime: event.target.value ? input.dueTime : undefined })} /></label>
          <label>Intended completion time (optional)<input type="time" disabled={!input.dueDate} value={input.dueTime || ""} onChange={event => setInput({ ...input, dueTime: event.target.value || undefined })} /></label>
        </div>
        {!input.dueDate && <p className="hint">No deadline. The task stays Active until you complete it or set a deadline.</p>}
        {input.dueDate && !input.dueTime && <p className="hint">Date only: overdue after this local calendar day ends.</p>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <footer className="dialog-footer"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : error ? "Retry save" : "Save task"}</button></footer>
    </form>
  </Dialog>;
}
