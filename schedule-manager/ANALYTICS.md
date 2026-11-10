# Schedule and To-do analytics

Open Schedule Manager or To-do List in the dashboard and select **Analytics** in its main content area. **Schedule** or **Tasks** returns to management. The To-do Active, Pending, Completed and Missed tabs, its Sort by control, and all saved records are preserved. Analytics navigation and date controls use local React state; they do not change the pathname, query string or hash. No sidebar item or additional route is introduced.

There are exactly three analytics in each section. All calculations are read-only and shared through `src/features/analytics/calculations.ts`. No database, package, lockfile, storage key, schema or data migration changed. Charts use HTML/CSS and accessible tables instead of an added dependency.

## Definitions

| Section | Analytic | Definition and population |
| --- | --- | --- |
| Schedule | Planned time by life area | Scheduled intervals intersecting the selected period, grouped once by current sub-schedule. Overlaps merge within each area. Personal and habit event records and applicable official classes are included. Unassigned events have their own group. Horizontal bars show planned hours, with durations and included-entry counts in a table. |
| Schedule | Daily planned workload | All included intervals merge across areas, then split at each student-local midnight. Columns include zero-hour days and the chart shows total occupied planned hours. Overlapping different areas may make the sum of area hours exceed this overall union. Neither chart reports actual time spent or treats unscheduled time as free time. |
| Schedule | Missed and rescheduled events | Missed audit entries whose action timestamps fall in the period, distinct events with those misses, and distinct personal events with a recorded missed-flow reschedule in the period. Rescheduling requires a changed next slot and a prior explicit missed entry for the same planned attempt. Ordinary edits and official timetable changes are excluded. Breakdown uses current area assignments. |
| To-do | Task status breakdown | Current Active/Pending/Completed/Missed view status of tasks created in the selected period. Undated tasks are included. Future and undated unfinished tasks are Active; arrived-deadline unfinished tasks are Pending, using the same shared classifier as management. This is a current cohort snapshot, not a historical status reconstruction. The stacked bar, counts and percentages use this creation-date denominator. |
| To-do | Completion trend | Tasks completed on each local day, using their original completion timestamps, regardless of creation or deadline date. Undated tasks count; zero-completion days are included. Repeated completion calls and duplicate occurrences do not add successes. |
| To-do | Deadline performance | Current outcomes for tasks whose intended deadlines fall in the selected period and have passed at the current instant. Mutually exclusive buckets are completed on time, completed late, explicitly missed, still pending/overdue, and Unclassified. Tasks without a deadline and deadlines not yet passed are excluded. Completion exactly at the deadline is on time. |

Timed deadlines mean their entered local HH:mm instant (seconds zero). Date-only deadlines end at the last millisecond before the next local midnight. A completed task with no reliable completion timestamp is Unclassified for eligible deadlines and excluded from the completion trend. No outcome or deadline is changed by analytics. Existing late-completion rules for habit tasks are preserved.

Percentages use largest-remainder rounding to one decimal place, so displayed categories reconcile to 100.0% for a nonempty population. An empty denominator displays zero counts and zero percentages, never NaN or an invented result.

## Shared controls and timezone

- **This week** uses Monday through Sunday in the configured student timezone. Monday is the documented week-start assumption.
- **This month** uses the entire current local calendar month, including future planned dates. Deadline performance still excludes deadlines not yet passed.
- **Custom date range** uses inclusive local dates, with an exclusive boundary at midnight after the end date. Invalid/reversed ranges retain the previous valid charts. Custom ranges are limited to 366 days to bound browser work and timetable queries.
- The range, timezone and distinct chart populations appear beside the controls. Each section retains its current management selection while Analytics is open; returning to management restores its status/filter selection.

Local-to-instant conversion uses IANA timezone rules. Days may span 23 or 25 hours across DST. Nonexistent local event times are excluded and flagged; ambiguous wall times choose the earlier instant consistently. Analytics can split overnight source intervals even though the current event editor only permits same-day events. Official sessions are retrieved for the period plus its preceding day to cover a session continuing past midnight. Calls are bounded to four concurrent requests.

## Deduplication and exclusions

Personal events deduplicate by stable ID; habit events and habit tasks deduplicate by owner, habit ID and occurrence ID. Ordinary tasks deduplicate by stable ID. The most recently updated representation is used. Official sessions deduplicate by source identifier and session date; cancellation/drop wins if conflicting duplicate representations are supplied.

Archived personal entries, deleted tasks, cancelled official sessions and dropped registrations are excluded according to their existing removal conventions. Outcome history on archived personal events is excluded consistently with this current included-record population; it remains stored for audit. Tasks not owned by the configured student are excluded.

Personal events use exactly one current area. Official classes use the flagged academic sub-schedule; when multiple areas are flagged academic, the stable first ID is used once. Without an academic sub-schedule, classes use **Academics**. Old audit snapshots do not record past area assignments, so attempt breakdowns cannot reconstruct those assignments.

## Updates, retrieval and limitations

Calculations consume the current shared records; there are no manually maintained analytic counters. Existing storage-change/focus refreshes update event/task props. Returning focus refreshes official-session retrieval; re-entering Analytics fetches current period data. The clock refreshes at aligned minute boundaries and on visibility/focus return, updating deadline eligibility and Active/Pending classification. Loading, empty, partial, failed retrieval, retry and invalid-range feedback are explicit.

The application still uses its clearly labelled sample academic provider. Analytics reuses that provider through ScheduleService; it does not claim a live school portal connection. Failed daily timetable lookups produce a partial-data warning with retry; personal records and successful classes remain usable, but planned totals may be incomplete.

Only actual missed/rescheduled audit entries count. Missing timestamps, orphan reschedule entries and incomplete attempt history are flagged and never replaced by inferred outcomes. No earlier missed attempts are manufactured. Records that the existing repositories reject as malformed still produce the existing non-destructive loading error; analytics does not bypass validation or repair them. The reusable calculations additionally handle missing historical timestamps from a future compatible data source.

Task charts include linked occurrences as tasks, but no Habit Tracker analytics or grid is built. Today remains a read-only consumer. Analytics has no record-changing controls, task completion is still in To-do List, and Schedule has no completion controls. These charts are not an overall productivity score.

## Verification and review

Run Node.js 24+ in the application directory:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck
```

Typechecking follows the build here because Next regenerates `.next/types` while building; running those two commands simultaneously can cause a generated-file race.

Tests cover interval merging, duplicate events/classes/occurrences, local midnight and period clipping, DST, multiple attempts versus distinct events, missed-flow proof, cross-period completions, date-only deadlines and equality, future/undated deadlines, missing timestamps, zero periods, reconciled percentages, bounded partial timetable retrieval and repeated real completion calls. Existing task/status/selection/persistence tests remain part of the suite.

Current verification: 78 tests passed, including the shared Active/Pending analytics classifier, ESLint passed, production build passed, and standalone TypeScript checking passed. No checks required dependency or lockfile changes.

Manual review: open Analytics in both sections, exercise period presets/custom validation, inspect chart tables, return to management, change a permitted record, and reopen Analytics. Confirm the counts refresh, the URL stays unchanged, Active/Pending/Completed/Missed and Schedule still work, and saved data survives reload. No browser automation tools are available; full desktop/mobile visual review and interactive keyboard checks remain unverified.

## Checkpoint and reversal

Git is installed but this application is not a Git repository, so no branch, commit identifier or analytics commit can be created safely. The verified backup approach is used instead.

Checkpoint: `C:\Productivity Layer\checkpoints\analytics-2026-11-03-40f9a1f8`.

Before edits, SHA-256-verified copies of both manager components, globals.css and README.md were saved under `before/`. The final manifest records these originals, the new analytics files and their post-change hashes. `ROLLBACK.md` and the guarded `rollback.ps1` in that checkpoint provide exact reversal commands. No environment files were copied. Generated build outputs are regenerated rather than restored.

No dependencies or stored data formats changed, so reversal requires no lockfile or data migration. Restoring an entire backup could overwrite later edits; the script refuses changed-after-checkpoint files so those edits can be merged manually. Do not execute rollback during this implementation. Nothing is pushed or deployed.
