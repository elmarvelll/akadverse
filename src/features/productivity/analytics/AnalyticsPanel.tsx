"use client";
import { productivityErrorMessage } from "../errors";
import { useEffect, useState } from "react";
import type { Dataset, OfficialClass, ScheduleService, Student } from "../schedule/domain";
import { millisecondsToNextMinute, type Task } from "../tasks/domain";
import { loadAcademicRange, presetRange, rangeDays, type DateRange } from "./periods";
import { scheduleAnalytics, taskAnalytics } from "./calculations";
import { ScheduleAnalyticsView, TaskAnalyticsView } from "./AnalyticsView";

type Props = { student: Student } & ({ kind: "schedule"; data: Dataset; academic: Pick<ScheduleService, "getOfficialClasses"> } | { kind: "tasks"; tasks: Task[] });
export function AnalyticsPanel(props: Props) {
  const [clock, setClock] = useState<Date>(), [range, setRange] = useState<DateRange>();
  const [preset, setPreset] = useState<"week" | "month" | "custom">("week");
  const [draft, setDraft] = useState<DateRange>({ start: "", end: "" }), [validationError, setValidationError] = useState("");
  const [academicResult, setAcademicResult] = useState<{ key: string; rows: OfficialClass[]; failedDates: string[]; errors?: string[]; error?: string }>();
  const [retry, setRetry] = useState(0);
  const timezone = props.student.timezone, academic = props.kind === "schedule" ? props.academic : undefined;
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (!active) return; const now = new Date(), initial = presetRange("week", timezone, now); setClock(now); setRange(initial); setDraft(initial); }).catch(error => { if (active) setValidationError(productivityErrorMessage(error, "Analytics could not start because the saved timezone or date could not be read. Check your timezone in Account & import and reload.")); });
    let timer: number;
    const tick = () => { setClock(new Date()); timer = window.setTimeout(tick, millisecondsToNextMinute(new Date())); };
    const focus = () => { setClock(new Date()); setRetry(value => value + 1); };
    const visible = () => { if (document.visibilityState === "visible") setClock(new Date()); };
    timer = window.setTimeout(tick, millisecondsToNextMinute(new Date()));
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }, [timezone]);
  const start = range?.start, end = range?.end, rangeKey = start && end ? `${start}:${end}` : "";
  useEffect(() => {
    if (!academic || !start || !end) return;
    let active = true;
    loadAcademicRange({ start, end }, date => academic.getOfficialClasses(date)).then(result => { if (active) setAcademicResult({ ...result, key: `${start}:${end}` }); }).catch(error => { if (active) setAcademicResult({ key: `${start}:${end}`, rows: [], failedDates: [], error: productivityErrorMessage(error, "Analytics could not be calculated. Reload the records and choose a valid date range.") }); });
    return () => { active = false; };
  }, [academic, start, end, retry, props.student.id]);
  if (!clock || !range) return validationError ? <section className="error" role="alert">{validationError} <button onClick={() => window.location.reload()}>Reload analytics</button></section> : <section className="analytics-loading" role="status">Preparing analytics…</section>;
  function choose(value: "week" | "month" | "custom") {
    setPreset(value); setValidationError("");
    if (value !== "custom") { try { const selected = presetRange(value, timezone, clock!); setRange(selected); setDraft(selected); } catch (error) { setValidationError(productivityErrorMessage(error, "This analytics period could not be calculated. Check your saved timezone and reload.")); } }
  }
  let calculationError = "", warnings: string[] = [];
  let taskResult: ReturnType<typeof taskAnalytics> | undefined, scheduleResult: ReturnType<typeof scheduleAnalytics> | undefined;
  const loading = props.kind === "schedule" && academicResult?.key !== rangeKey;
  const retrievalError = academicResult?.key === rangeKey ? academicResult.error : undefined;
  try {
    if (props.kind === "tasks") { taskResult = taskAnalytics(props.tasks, props.student.id, range, timezone, clock); warnings = taskResult.warnings; }
    else if (!loading && !retrievalError) { scheduleResult = scheduleAnalytics(props.data, academicResult?.rows || [], props.student.id, range, timezone); warnings = scheduleResult.warnings; }
  } catch (error) { calculationError = productivityErrorMessage(error, "Analytics could not be calculated. Reload the records and choose a valid date range."); }
  return <section className="analytics-panel" aria-label={props.kind === "schedule" ? "Schedule analytics" : "To-do analytics"}>
    <div className="analytics-controls">
      <div role="group" aria-label="Analytics period" className="analytics-period-buttons">{([ ["week", "This week"], ["month", "This month"], ["custom", "Custom date range"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={preset === value} onClick={() => choose(value)}>{label}</button>)}</div>
      {preset === "custom" && <form className="analytics-range-form" onSubmit={event => { event.preventDefault(); try { rangeDays(draft); setRange({ ...draft }); setValidationError(""); } catch (error) { setValidationError(productivityErrorMessage(error, "Analytics could not be calculated. Reload the records and choose a valid date range.")); } }}><label>Start date<input type="date" required value={draft.start} onChange={event => setDraft({ ...draft, start: event.target.value })} /></label><label>End date<input type="date" required value={draft.end} onChange={event => setDraft({ ...draft, end: event.target.value })} /></label><button type="submit">Apply range</button></form>}
      {validationError && <p className="error" role="alert">{validationError} Charts retain the last valid range.</p>}
      <p><strong>{range.start} to {range.end}</strong> · {timezone} · Monday starts the week. Maximum custom range: 366 days.</p>
      <p className="hint">Each chart states its population: planned slots, recorded actions, task creation, completion timestamps or passed deadlines. Analytics do not change outcomes.</p>
    </div>
    {loading && <p className="analytics-loading" role="status">Loading applicable timetable sessions for this period…</p>}
    {(retrievalError || calculationError) && <p className="error" role="alert">Analytics could not be fully retrieved or calculated: {retrievalError || calculationError} <button type="button" onClick={() => { setClock(new Date()); setRetry(value => value + 1); }}>Retry analytics</button></p>}
    {props.kind === "schedule" && academicResult?.key === rangeKey && !!academicResult.failedDates.length && <p className="notice" role="alert">Partial data: official timetable retrieval failed for {academicResult.failedDates.length} local day(s). {academicResult.errors?.[0]} Figures include personal records and successfully retrieved classes only; planned totals may be incomplete. <button type="button" onClick={() => setRetry(value => value + 1)}>Retry timetable data</button></p>}
    {!!warnings.length && <div className="notice" role="status"><strong>Partial historical data</strong><ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
    {taskResult && <TaskAnalyticsView result={taskResult} />}
    {scheduleResult && <ScheduleAnalyticsView result={scheduleResult} />}
  </section>;
}
