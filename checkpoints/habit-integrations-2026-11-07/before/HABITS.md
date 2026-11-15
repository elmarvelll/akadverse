# Habit Tracker

Select **Habit Tracker** in the sidebar. Schedule Manager, To-do List and Habit Tracker use the same dashboard state and root route; selecting sections, habits, occurrences, months or feedback periods does not write the URL.

## Rules and records

- Create a Task or Event habit with a name, optional description, priority, daily/selected-weekday frequency and required times. At least one selected weekday is required. Event ranges use existing same-day schedule-slot validation. No new dependencies, optional date ranges, life areas or per-occurrence editing were added.
- The first eligible date is the creation date in the configured local timezone (currently Africa/Lagos). Every settings revision has an effective local date. Edits, archiving and restoring apply from **tomorrow**, keeping today's context as well as past schedules. Repeated edits for the same effective day retain their audit entries; the latest applies. The details dialog shows settings history.
- The stable occurrence key is `habitId:originalLocalDate`. Only needed dates are generated. Startup prepares creation-month through current-month in month-sized batches, and Schedule prepares additional dates as selected. The tracker loads the displayed month and selected feedback week. To-do generates the new local day's occurrences when its open clock crosses midnight. Reloading and regeneration reuse identifiers.
- `productivity-layer.habits.v1` stores validated version-one habit rules and revision history. Outcomes are **not** stored there. Task occurrences are existing version-two task records, and event occurrences are existing version-one schedule records. Original storage keys and migrations remain in place. No sample habits or replacements of existing saved data are introduced.
- A task occurrence is created through `TaskService.receiveHabitOccurrence`. To-do and tracker outcomes use the same TaskService operations. Future unrecorded instances withdrawn by a recurrence/type change keep their records and audits with optional `habitWithdrawn`; task lists, counts, summaries and analytics exclude them. Reinstatement reuses the record. Existing records without that optional field need no migration.
- Event occurrences use the schedule's existing event shape/source, selectors and conflict detection. Completed events retain their planned time. Generated future events no longer scheduled are archived with history; restoring a rule reuses them. Recorded outcomes remain untouched, including early outcomes on future dates. Type changes cannot generate a second active record over an already recorded outcome.
- Habit task fields cannot be edited/deleted in To-do. **Open habit** selects its original occurrence in the tracker. Schedule offers originating-section navigation for imported activity and retains **no completion controls**. No Today section exists in this project; none was invented. Future Today controls can use `WorkspaceButton` with `section="habits"`, `habitId` and `occurrenceDate`.

## Grid, outcomes and feedback

Dates are rows, habits are columns, and row totals count completed/scheduled occurrences. No-schedule rows say so. Before creation, non-matching weekdays and archived future dates are black; scheduled unrecorded dates stay neutral even after their time passes. Completed is green, explicit missed is red, and future rows are labelled planned. Every cell has a text label, date and habit in its accessible name. Tab reaches controls; arrows move between cells, Home/End move across a row, and Enter/Space use native buttons. The table scrolls horizontally with sticky date and header associations.

Task occurrences follow the existing four-tab timing rule: Complete before or after the deadline, Mark missed only when the deadline arrives. The operation reloads the current record and repeats the deadline check. Recorded task outcomes offer no further tracker buttons; the existing programmatic missed-habit-to-completed compatibility operation is preserved. Event Complete is available for an unrecorded occurrence; Mark missed waits until its scheduled end. Clock transitions never record outcomes.

Event misses use `ScheduleService.recordMissedAttempt`, preserving the original slot and timestamp without moving anything. A separate Replan event form offers the existing smart/manual operations, checks whole-duration conflicts against events/classes and preserves the original habit date. Manual clashes block saving and can be resolved by changing the slot; smart no-fit feedback allows manual replanning. Completing after a reschedule preserves the real timestamp but shows an amber **Review** cell. That completion earns neither a green-grid numerator nor feedback credit; reviewed occurrences are separately flagged and excluded from the due/completed/missed/unrecorded feedback counts until the credit policy is decided.

Monthly feedback uses the displayed month. Weekly feedback uses Monday–Sunday around the selected date. Each habit is compared only with its own due occurrences, at its task deadline or original event end. Future/unscheduled dates are excluded. Completed, explicit missed and unrecorded remain separate; no due occurrences yields an explicit empty state. Count-backed messages indicate keeping up or needing attention; there are no invented scores.

## Persistence, failure and limitations

Repositories retain validation, load-before-save, stale-tab checks and confirmed-save behavior. Invalid rules block loading without rewriting the saved JSON. Outcome failures leave the previous confirmed status visible and allow retry. Habit forms preserve input if a rule write fails. If a rule write succeeds but projection refresh fails, the UI reports that the rule was saved and asks for a load retry; it does not encourage creating a duplicate habit. Generation is idempotent so partially completed projections can be retried safely.

Rules, tasks and schedules are separate localStorage writes, **not one transaction**. A quota failure may save a rule or part of its generated instances before another projection fails. Their IDs make retry safe, and errors remain visible. This standalone browser setup has no account sync or server authorization and should be replaced with a shared backend transaction when connected to the portal. Legacy imported habit references with no saved recurrence rule are preserved; their definitions are not guessed or fabricated.

## Verification and manual review

Automated coverage exercises daily/Monday-Wednesday-Friday recurrence across month boundaries; reload deduplication; early task completion; exact-deadline misses; both directions of shared task outcomes; preserved timestamps; elapsed neutral cells; due-only feedback; frequency/time/type revisions; reversible archiving; event slots/conflicts, explicit miss, replanning and flagged late completion; failed writes/retry; corrupt and stale storage; exact grid-cell activation, accessible state labels, row totals and keyboard focus movement; and native sidebar selection with unchanged pathname/query/hash.

For manual review at http://localhost:3000:

1. Create a daily Task habit and a Monday/Wednesday/Friday habit. Inspect their grid dates, black cells, future labels and totals. Change month and reload: no duplicates should appear.
2. Open a linked task in To-do, complete it early, and return to the tracker. Its original date should be green. On an arrived deadline, record a miss from either section and confirm the other shows the same timestamp/outcome.
3. Create two overlapping Event habits; find their Habit labels, times, priorities and conflict badges in Schedule. Record outcomes in the tracker. Schedule must have no Complete controls.
4. Edit frequency/time or archive a habit. Today and earlier dates plus recorded outcomes should stay intact; future unrecorded instances should change. Restore and reload to verify persistence.
5. Record an event miss, replan manually or smartly, then complete it. Check original/current times, missed history and the Review state, excluded from feedback credit.
6. Switch feedback week/month and inspect missed versus unrecorded counts. Use Tab, arrows, Enter/Space and Escape, and check mobile horizontal scrolling.

Actual browser pointer behavior, native-dialog focus restoration, responsive appearance and assistive-technology output still require manual review; no browser automation tool is available in this environment. Academic sessions remain explicitly labelled sample data.


## Today-only To-do habit cards

The To-do display scope (src/features/tasks/todo.ts) includes a generated task only when its original scheduled date equals today in the student's configured timezone and the habit revision effective on that date schedules a Task occurrence. Cards, all four tab counts, sorting and empty states share that scope. Duplicate source aliases are deduplicated by owner/habit/original date. Ordinary tasks retain their existing behavior. Missing habit definitions are not guessed; their records remain in storage but do not create a To-do card.

The restriction is display-only: full records still feed tracker history and historical analytics, and future stored occurrences are retained. Opening an out-of-scope occurrence through an existing task reference offers Review in Habit Tracker instead of exposing a stale To-do outcome control. No schema migration, deletion, automatic miss or outcome copy was introduced. Shared completion operations are unchanged.

The existing aligned-minute clock recalculates the scope at local midnight and deadline boundaries. Focus and visibility resume refresh the clock, identity/timezone, records and rules. Habit-rule storage events and same-window habit notifications reload rules; local-day, timezone and rule changes also trigger idempotent generation of the needed date. The standalone identity still has no timezone settings UI; a replacement identity provider's new timezone is picked up on refresh.

Regression tests cover all four statuses, monthly future suppression, Monday/Wednesday/Friday rules, rule revisions, stable-date deduplication, ordinary tasks, date-only deadlines, midnight and cross-timezone boundaries, explicit shared outcomes, reload deduplication and preserved tracker history. Actual browser suspension/focus timing remains a manual browser check.
