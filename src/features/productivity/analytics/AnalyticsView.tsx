import { Columns, HorizontalBars, StackedBar, numberLabel } from "./Charts";
import type { scheduleAnalytics, taskAnalytics } from "./calculations";

export function ScheduleAnalyticsView({ result }: { result: ReturnType<typeof scheduleAnalytics> }) {
  return <div className="analytics-grid">
    <article className="analytics-card"><h2>Planned time by life area</h2><HorizontalBars rows={result.areas} /></article>
    <article className="analytics-card"><h2>Daily planned workload</h2><p className="analytics-total">{numberLabel(result.totalHours)} <span>planned hours</span></p><Columns rows={result.daily.map(row => ({ date: row.date, value: row.hours }))} unit="planned hours" label="Occupied planned hours by day" /></article>
    <article className="analytics-card"><h2>Missed &amp; rescheduled</h2><p className="hint">Recorded actions in this period</p><dl className="analytics-metrics"><div><dt>Missed attempts</dt><dd>{result.missedAttempts}</dd></div><div><dt>Events missed</dt><dd>{result.missedEvents}</dd></div><div><dt>Events rescheduled</dt><dd>{result.rescheduledEvents}</dd></div></dl>{result.attemptsByArea.length > 0 && <details><summary>View by sub-schedule</summary><div className="analytics-table"><table><thead><tr><th>Current sub-schedule</th><th>Attempts</th><th>Events missed</th><th>Events rescheduled</th></tr></thead><tbody>{result.attemptsByArea.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.attempts}</td><td>{row.missedEvents}</td><td>{row.rescheduledEvents}</td></tr>)}</tbody></table></div></details>}{!result.missedAttempts && !result.rescheduledEvents && <p className="muted">No recorded misses or reschedules in this period.</p>}</article>
  </div>;
}
export function TaskAnalyticsView({ result }: { result: ReturnType<typeof taskAnalytics> }) {
  return <div className="analytics-grid">
    <article className="analytics-card"><h2>Current workload</h2><p className="hint">All ordinary tasks · Today’s habit tasks</p><dl className="analytics-metrics"><div><dt>Active tasks</dt><dd>{result.workload.active}</dd></div><div><dt>Pending tasks</dt><dd>{result.workload.pending}</dd></div></dl>{!result.workload.active && !result.workload.pending && <p className="muted">No open tasks.</p>}</article>
    <article className="analytics-card"><h2>Period status breakdown</h2><p className="hint">Ordinary: created in range · Habits: scheduled in range</p><StackedBar rows={result.statuses} total={result.createdTotal} label="Current status of eligible tasks in this period" /></article>
    <article className="analytics-card"><h2>Completion trend</h2><p className="analytics-total">{result.completedTotal} <span>tasks completed</span></p><Columns rows={result.daily.map(row => ({ date: row.date, value: row.count }))} unit="tasks completed" label="Tasks completed by day" /></article>
    <article className="analytics-card"><h2>Deadline performance</h2><p className="hint">Passed deadlines in this period</p><StackedBar rows={result.deadline} total={result.eligibleTotal} label="Outcomes for elapsed deadlines" /></article>
  </div>;
}
