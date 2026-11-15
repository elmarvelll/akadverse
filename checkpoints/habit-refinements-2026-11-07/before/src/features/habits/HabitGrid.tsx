"use client";
import type { KeyboardEvent } from "react";
import { formatDate } from "../schedule/Forms";
import { outcome, type Habit, type Occurrence } from "./domain";
export function HabitGrid({ habits, dates, occurrences, today, onOpen, onHabit }: { habits: Habit[]; dates: string[]; occurrences: Occurrence[]; today: string; onOpen: (item: Occurrence) => void; onHabit: (id: string) => void }) {
  const byKey = new Map(occurrences.map(item => [`${item.habitId}:${item.date}`, item]));
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) {
    let nextRow = row, nextColumn = column;
    if (event.key === "ArrowDown") nextRow++;
    else if (event.key === "ArrowUp") nextRow--;
    else if (event.key === "ArrowLeft") nextColumn--;
    else if (event.key === "ArrowRight") nextColumn++;
    else if (event.key === "Home") nextColumn = 0;
    else if (event.key === "End") nextColumn = habits.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.closest("table")?.querySelector<HTMLButtonElement>(`[data-cell="${Math.max(0, Math.min(dates.length - 1, nextRow))}:${Math.max(0, Math.min(habits.length - 1, nextColumn))}"]`)?.focus();
  }
  return <div className="habit-grid-scroll" role="region" aria-label="Monthly habit grid; scroll horizontally for more habits" tabIndex={0}><table className="habit-grid"><caption>Dates down the left, habits across the top. Arrow keys move between cells; Enter opens a scheduled occurrence.</caption><thead><tr><th scope="col">Date</th>{habits.map(habit => <th scope="col" key={habit.id}><button onClick={() => onHabit(habit.id)}>{habit.revisions.at(-1)!.name}</button></th>)}<th scope="col">Completed / scheduled</th></tr></thead><tbody>{dates.map((date, row) => {
    const scheduled = occurrences.filter(item => item.date === date), completed = scheduled.filter(item => outcome(item) === "completed").length;
    return <tr key={date} className={date > today ? "habit-future" : ""}><th scope="row">{formatDate(date)}{date === today && <small>Today</small>}{date > today && <small>Planned</small>}</th>{habits.map((habit, column) => {
      const item = byKey.get(`${habit.id}:${date}`), state = item ? outcome(item) : "unscheduled";
      const label = state === "unrecorded" ? date > today ? "Planned, no outcome" : "Scheduled, no outcome" : state === "unscheduled" ? "Not scheduled" : state === "review" ? "Completion needs review" : state;
      return <td key={habit.id}><button type="button" data-cell={`${row}:${column}`} className={`habit-cell habit-${state}`} aria-label={`${habit.revisions.at(-1)!.name}, ${date}: ${label}`} aria-disabled={!item} onKeyDown={event => keyboard(event, row, column)} onClick={() => { if (item) onOpen(item); }}>{state === "completed" ? "Done" : state === "missed" ? "Missed" : state === "unscheduled" ? "—" : state === "review" ? "Review" : "Open"}</button></td>;
    })}<td>{scheduled.length ? <>{completed}/{scheduled.length}{date > today && <small>planned</small>}</> : <span className="muted">No habits scheduled</span>}</td></tr>;
  })}</tbody></table></div>;
}
