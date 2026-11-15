"use client";
import { useRef, useState } from "react";
import { Dialog } from "../schedule/Forms";
import type { Habit, HabitInput } from "./domain";
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function HabitForm({ habit, onClose, onSave }: { habit?: Habit; onClose: () => void; onSave: (input: HabitInput) => Promise<void> }) {
  const [input, setInput] = useState<HabitInput>(() => habit?.revisions.at(-1) || { name: "", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "18:00", end: "19:00" });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""); const saving = useRef(false);
  function change<K extends keyof HabitInput>(key: K, value: HabitInput[K]) { setInput(previous => ({ ...previous, [key]: value })); }
  return <Dialog title={habit ? "Edit habit" : "Create habit"} onClose={() => { if (!saving.current) onClose(); }}><form onSubmit={async event => {
    event.preventDefault(); if (saving.current) return; saving.current = true; setBusy(true); setError("");
    try { await onSave(input); onClose(); } catch (error) { setError((error as Error).message); } finally { saving.current = false; setBusy(false); }
  }}><fieldset disabled={busy} className="habit-form-fields">
    <label>Name<input required maxLength={100} value={input.name} onChange={e => change("name", e.target.value)} /></label>
    <label>Description (optional)<textarea maxLength={10000} value={input.description} onChange={e => change("description", e.target.value)} /></label>
    <label>Type<select value={input.type} onChange={e => change("type", e.target.value as HabitInput["type"])}><option value="task">Task</option><option value="event">Event</option></select></label>
    <label>Frequency<select value={input.frequency} onChange={e => change("frequency", e.target.value as HabitInput["frequency"])}><option value="daily">Daily</option><option value="weekdays">Selected weekdays</option></select></label>
    {input.frequency === "weekdays" && <fieldset><legend>Scheduled weekdays (choose at least one)</legend><div className="habit-weekdays">{weekdays.map((name, day) => <label key={day}><input type="checkbox" checked={input.weekdays.includes(day)} onChange={e => change("weekdays", e.target.checked ? [...input.weekdays, day] : input.weekdays.filter(item => item !== day))} />{name}</label>)}</div></fieldset>}
    <label>Priority<select value={input.priority} onChange={e => change("priority", e.target.value as HabitInput["priority"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    <label>{input.type === "task" ? "Intended completion time" : "Start time"}<input required type="time" value={input.time} onChange={e => change("time", e.target.value)} /></label>
    {input.type === "event" && <label>End time<input required type="time" value={input.end || ""} onChange={e => change("end", e.target.value)} /></label>}
    <p className="hint">{habit ? "Changes apply from tomorrow. Today, past dates and recorded outcomes stay unchanged." : "The first eligible date is today in your configured local time zone."}</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="detail-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">{busy ? "Saving..." : "Save habit"}</button></div>
  </fieldset></form></Dialog>;
}
