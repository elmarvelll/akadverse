"use client";
import { feedback, outcome, type Habit, type Occurrence } from "./domain";

export function HabitFeedback({ habit, habits, occurrences, monthOccurrences, now, period, weekDate, showToday, onPeriod, onWeekDate, onOpen, onRule }: {
  habit: Habit; habits: Habit[]; occurrences: Occurrence[]; monthOccurrences: Occurrence[]; now: { date: string; time: string };
  period: "week" | "month"; weekDate: string; showToday: boolean;
  onPeriod: (period: "week" | "month") => void; onWeekDate: (date: string) => void; onOpen: (item: Occurrence) => void; onRule: (id: string) => void;
}) {
  const counts = feedback(occurrences, habit.id, now), name = habit.revisions.at(-1)!.name;
  const rate = counts.due ? Math.round(counts.completed / counts.due * 100) : 0;
  return <aside className="habit-consistency-panel" aria-label="Habit feedback">
    <header className="habit-consistency-heading">
    <p className="habit-panel-eyebrow">Your progress</p>
    <h2>Consistency summary</h2>
    </header>
    <div className="habit-consistency-content" role="region" aria-label="Consistency summary details" tabIndex={0}>
    <div className="habit-feedback-controls">
      <label>Period<select value={period} onChange={event => onPeriod(event.target.value as "week" | "month")}><option value="month">Displayed month</option><option value="week">Selected week</option></select></label>
      {period === "week" && <label>Week containing<input type="date" value={weekDate} onChange={event => { if (event.target.value) onWeekDate(event.target.value); }} /></label>}
    </div>
    <p className="habit-consistency-summary">{counts.due ? <>You completed <strong>{counts.completed} of {counts.due}</strong> eligible occurrences for <strong>{name}</strong>; <strong>{counts.missed}</strong> missed, <strong>{counts.unrecorded}</strong> with no recorded outcome.</> : <>No eligible occurrences yet for <strong>{name}</strong>.</>}</p>
    <div className="habit-completion-label"><span>Completion rate</span><strong>{counts.due ? `${rate}%` : "—"}</strong></div>
    <progress className="habit-completion-progress" value={counts.completed} max={counts.due || 1} aria-label={`${name} completion rate`} />
    {counts.review > 0 && <p className="notice">{counts.review} rescheduled completion(s) need review and are excluded from feedback counts.</p>}
    <details className="habit-feedback-explanation"><summary>How progress is counted</summary><p>Counts include past scheduled dates and today&apos;s elapsed or explicitly recorded occurrences. Future dates are excluded. Untimed unrecorded tasks become elapsed after their local day ends.</p></details>
    {showToday && <div className="habit-today-list"><h3>Today&apos;s habits</h3>{habits.map(item => {
      const occurrence = monthOccurrences.find(row => row.habitId === item.id && row.date === now.date);
      const state = occurrence ? outcome(occurrence) : "unscheduled";
      const label = state === "unrecorded" ? "Open" : state === "unscheduled" ? "Not scheduled" : state === "review" ? "Review" : state === "completed" ? "Done" : "Missed";
      return <div className="habit-today-row" key={item.id}><span>{item.revisions.at(-1)!.name}</span><button type="button" className={`habit-today-status habit-calendar-${state}`} disabled={!occurrence} aria-label={`${item.revisions.at(-1)!.name} today: ${label}`} onClick={() => { if (occurrence) onOpen(occurrence); }}>{label}</button></div>;
    })}</div>}
    <div className="habit-consistency-footer"><span>Settings and archiving</span><button type="button" onClick={() => onRule(habit.id)}>Manage habit →</button></div>
    </div>
  </aside>;
}
