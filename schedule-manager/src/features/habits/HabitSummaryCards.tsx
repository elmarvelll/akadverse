"use client";
import { feedback, type Habit, type Occurrence } from "./domain";
import { Icon } from "../workspace/Design";
import { habitScheduleDescription } from "./presentation";

// Compact selected cards adapted from the export's HabitsScreen. Its invented
// streaks/rates are replaced with the same elapsed-occurrence feedback as grid.
export function HabitSummaryCards({ habits, occurrences, now, activeHabitId, onSelect, onEdit }: { habits: Habit[]; occurrences: Occurrence[]; now: { date: string; time: string }; activeHabitId?: string; onSelect: (id: string) => void; onEdit: (id: string) => void }) {
  return <div className="habit-overview-cards">{habits.map((habit, index) => {
    const settings = habit.revisions.at(-1)!, counts = feedback(occurrences, habit.id, now);
    const rate = counts.due ? Math.round(counts.completed / counts.due * 100) : undefined;
    return <article key={habit.id} className={`habit-overview-card ${activeHabitId === habit.id ? "featured" : ""}`}>
      <button type="button" className="habit-card-select" onClick={() => onSelect(habit.id)} aria-pressed={activeHabitId === habit.id} aria-label={`Show calendar for ${settings.name}`} />
      <div className="habit-overview-top"><span className={`habit-card-icon habit-tint-${index % 3}`}><Icon name={settings.type === "event" ? "calendar" : "task"}/></span><span className="habit-rate">{rate === undefined ? "No eligible occurrences" : `${rate}% completion`}</span></div>
      <div className="habit-card-name"><strong>{settings.name}</strong><button type="button" className="habit-card-edit" onClick={event => { event.stopPropagation(); onEdit(habit.id); }} aria-label={`Edit habit: ${settings.name}`} title={`Edit habit: ${settings.name}`}><Icon name="pencil"/><span>Edit habit</span></button></div>
      <span className="habit-summary-type">{habitScheduleDescription(settings)}{settings.archived ? " · Archived" : ""}</span>
      <span className="habit-card-bottom"><span>{counts.completed}/{counts.due} eligible completed</span><span>View calendar →</span></span>
      <span className="habit-card-progress" aria-hidden="true"><span style={{ width: `${rate || 0}%` }}/></span>
    </article>;
  })}</div>;
}
