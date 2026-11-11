"use client";
import type { KeyboardEvent } from "react";
import { outcome, type Habit, type Occurrence } from "./domain";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function HabitGrid({ habit, dates, occurrences, today, onOpen }: { habit: Habit; dates: string[]; occurrences: Occurrence[]; today: string; onOpen: (item: Occurrence) => void }) {
  const byDate = new Map(occurrences.filter(item => item.habitId === habit.id).map(item => [item.date, item]));
  const offset = dates.length ? new Date(dates[0] + "T12:00:00Z").getUTCDay() : 0;
  const trailing = (7 - (offset + dates.length) % 7) % 7;
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const column = (offset + index) % 7;
    const steps: Record<string, number> = { ArrowDown: 7, ArrowUp: -7, ArrowLeft: -1, ArrowRight: 1, Home: -column, End: 6 - column };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(dates.length - 1, index + steps[event.key]));
    event.currentTarget.closest(".habit-calendar-grid")?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
  }
  return <div className="habit-calendar-grid" role="group" aria-label={`${habit.revisions.at(-1)!.name} monthly calendar`}>
    <p className="sr-only">Arrow keys move between dates. Home and End move within a week. Enter opens a scheduled occurrence.</p>
    {weekdays.map(day => <div key={day} className="habit-weekday" aria-hidden="true">{day}</div>)}
    {Array.from({ length: offset }, (_, index) => <span key={`before-${index}`} className="habit-calendar-blank" aria-hidden="true" />)}
    {dates.map((date, index) => {
      const item = byDate.get(date), state = item ? outcome(item) : "unscheduled";
      const label = state === "unrecorded" ? date > today ? "Planned, no outcome" : "Scheduled, no outcome" : state === "unscheduled" ? "Not scheduled" : state === "review" ? "Completion needs review" : state;
      return <button key={date} type="button" data-day={index} className={`habit-calendar-day habit-calendar-${state}${date > today ? " is-future" : ""}${date === today ? " is-today" : ""}`} aria-label={`${habit.revisions.at(-1)!.name}, ${date}: ${label}`} aria-current={date === today ? "date" : undefined} aria-disabled={!item} title={`${date}: ${label}`} onKeyDown={event => keyboard(event, index)} onClick={() => { if (item) onOpen(item); }}>
        <span>{Number(date.slice(-2))}</span>
        {state === "completed" && <span className="habit-day-symbol" aria-hidden="true">✓</span>}
        {state === "missed" && <span className="habit-day-symbol" aria-hidden="true">×</span>}
        {state === "review" && <span className="habit-day-symbol" aria-hidden="true">!</span>}
      </button>;
    })}
    {Array.from({ length: trailing }, (_, index) => <span key={`after-${index}`} className="habit-calendar-blank" aria-hidden="true" />)}
  </div>;
}
