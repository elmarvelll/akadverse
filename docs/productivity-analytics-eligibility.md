# Analytics and habit workload eligibility

## Cause

The To-do display already used `todoTasks` to limit unresolved habit projections to
today. The paginated PostgreSQL aggregate also already applied the scheduled-date
rule. However, `taskStatusCounts` and `queryTasks` accepted every stored projection,
and task analytics classified the complete generated dataset using ordinary task
status and creation timestamps. Generating a month could therefore inflate analytics
Active counts even while the tab aggregate was correct.

## Changes

- `tasks/domain.ts` defines `isTaskListEligible`: exclude deleted/withdrawn records;
  unresolved habit tasks require `source.scheduledDate` to equal the student's local
  date. Ordinary tasks and explicit historical outcomes keep their existing behaviour.
- `tasks/queries.ts` and `tasks/todo.ts` share this rule. The To-do scope retains its
  latest habit-rule, ownership and logical-occurrence checks. Backend SQL is unchanged
  and documents its equivalent predicate.
- `analytics/calculations.ts` uses the same eligibility for current workload and
  period statuses. Ordinary status cohorts still use creation date; habit cohorts
  use scheduled date. `createdTotal` is retained as the existing response field for
  the status cohort's total. Completion timestamps and elapsed-deadline history are
  unchanged, including past unresolved occurrences in historical overdue figures.
- `AnalyticsView.tsx` reuses existing bars, columns, legends and accessible data tables.
  Current Active/Pending statistics are explicitly independent of the historical range.
  Calculation definitions move into native keyboard-accessible details, while values,
  units, date-range scope, legends, warnings and empty states stay visible.
- `AnalyticsPanel.tsx` rolls week/month presets with the local date, preserves custom
  ranges and pauses listeners/timers for inactive sections. No polling is added.
- `TaskManager.tsx` refreshes cached analytics records on relevant invalidation, active
  day/timezone changes and return from inactivity instead of each periodic snapshot.
  Confirmed local task changes adjust known tab totals while the normal authoritative
  refresh completes. Cached deadline/midnight adjustments use the shared eligibility.

No occurrences are deleted, no outcomes are inferred from a missed deadline, and habit
consistency calculations, ordinary future deadlines, authentication and ownership
checks are unchanged. There are no sidebar count consumers in this checkout.

## Validation

Seven focused tests cover a generated 31-day month, deadline arrival, untimed tasks,
midnight/timezone selection, completions and corrections, historical elapsed deadlines,
ordinary future tasks, withdrawn/deleted projections, weekday/archive To-do scope,
owner isolation and collapsed presentation with accessible charts and empty states.

The localhost-only persistence suite additionally generates a future month, checks its
records remain stored and compares SQL tab counts with full-data client and analytics
counts. Both database tests passed. No shared/live database was modified by these tests.
