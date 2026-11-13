"use client";
import { productivityErrorMessage } from "../errors";
import { useRef, useState } from "react";
import { Dialog } from "../schedule/Forms";
import { localNow } from "../schedule/domain";
import { validateHabit, type Habit, type HabitInput } from "./domain";
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function HabitForm({ habit, onClose, onSave, timezone }: { habit?: Habit; onClose: () => void; onSave: (input: HabitInput) => Promise<void>; timezone: string }) {
  const [input, setInput] = useState<HabitInput>(() => habit ? { ...habit.revisions.at(-1)!, startDate: habit.revisions.at(-1)!.startDate || habit.createdDate } : { name: "", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "", end: "", startDate: localNow(timezone).date });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""); const saving = useRef(false);
  function change<K extends keyof HabitInput>(key: K, value: HabitInput[K]) { setInput(previous => ({ ...previous, [key]: value })); }
  return <Dialog title={habit ? `Edit habit — ${habit.revisions.at(-1)!.name}` : "Add habit"} onClose={() => { if (!saving.current) onClose(); }}><form onSubmit={async event => {
    event.preventDefault(); if (saving.current) return; saving.current = true; setBusy(true); setError("");
    try { validateHabit(input, timezone); await onSave(input); onClose(); } catch (error) { setError(productivityErrorMessage(error, "This habit could not be saved. Review the habit settings and try again.")); } finally { saving.current = false; setBusy(false); }
  }}><fieldset disabled={busy} className="habit-form-fields">
    <label>Name<input required maxLength={100} value={input.name} onChange={e => change("name", e.target.value)} /></label>
    <label>Description (optional)<textarea maxLength={10000} value={input.description} onChange={e => change("description", e.target.value)} /></label>
    <label>Type<select value={input.type} onChange={e => change("type", e.target.value as HabitInput["type"])}><option value="task">Task</option><option value="event">Event</option></select></label>
    <p className="notice">{input.type === "task" ? "Appears in your To-do List." : "Appears in your Schedule Manager."}</p>
    <label>Start date<input required type="date" value={input.startDate || ""} onChange={e => change("startDate", e.target.value)} /></label>
    <label>End date (optional)<input type="date" min={input.startDate} value={input.endDate || ""} onChange={e => change("endDate", e.target.value || undefined)} /></label>
    <label>Frequency<select value={input.frequency} onChange={e => change("frequency", e.target.value as HabitInput["frequency"])}><option value="daily">Daily</option><option value="weekdays">Selected weekdays</option></select></label>
    {input.frequency === "weekdays" && <fieldset><legend>Scheduled weekdays (choose at least one)</legend><div className="habit-weekdays">{weekdays.map((name, day) => <label key={day}><input type="checkbox" checked={input.weekdays.includes(day)} onChange={e => change("weekdays", e.target.checked ? [...input.weekdays, day] : input.weekdays.filter(item => item !== day))} />{name}</label>)}</div></fieldset>}
    <label>Priority<select value={input.priority} onChange={e => change("priority", e.target.value as HabitInput["priority"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    <label>{input.type === "task" ? "Completion deadline (optional)" : "Start time"}<input required={input.type === "event"} type="time" value={input.time} onChange={e => change("time", e.target.value)} /></label>
    {input.type === "event" && <label>End time<input required type="time" value={input.end || ""} onChange={e => change("end", e.target.value)} /><small>An earlier end time means the following day.</small></label>}
    <p className="hint">{habit ? "Changes apply from today onward. Previously recorded results are preserved." : "The start date uses your configured local time zone. Past start dates allow retrospective review."}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="detail-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">{busy ? "Saving..." : habit ? "Save changes" : "Save habit"}</button></div>
  </fieldset></form></Dialog>;
}
