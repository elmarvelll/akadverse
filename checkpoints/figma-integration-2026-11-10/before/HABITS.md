# Habit Tracker

This document describes the current refinement milestone and supersedes earlier today-only outcome-history, tomorrow-effective edit and no-corrections rules.

## Responsibilities and navigation

Habit Tracker creates/edits recurring Task or Event habits, archives/restores them, records and corrects outcomes, and shows history/feedback. Task occurrences appear in To-do; event occurrences appear in the existing date-based Schedule view. They share their source records, not copied outcomes. Native sidebar buttons and Edit habit/Open habit actions use dashboard selection state without changing the URL. Today is not implemented in this standalone project; no new overview or route was added. Task Deadlines stays removed.

## Creation, recurrence and editing

Add habit offers a name, optional description, priority, Task/Event type, daily/selected-weekday frequency, required start date and optional inclusive end date. Task completion time is optional. Event start/end times must be entered explicitly and use existing same-day positive-duration validation. The form explains the destination and never invents event times. A past start date enables retrospective review; a future start date produces planned cells only. At least one selected weekday is required.

Existing rules without startDate default to their original creation date; existing time values stay unchanged. Existing tomorrow-effective revisions retain their original effective dates until a new edit supersedes them. New edits and archive/restore changes are clearly effective from today. The latest eligible appended revision applies, including when it supersedes an older future-effective revision. Past dates and already recorded outcomes are protected. Editing an archived habit does not restore it implicitly.

The stable identity is owner/habit/original local date. No multiple-slot recurrence model is introduced. Startup/To-do generate today's task only; Schedule generates events for its selected date without creating an entire month of new task records. The tracker can materialize its displayed month for grid/history. Existing future records are retained. Withdrawn unrecorded task projections use habitWithdrawn, and withdrawn event projections use archiving; neither is deleted. Restoring reuses IDs. Recorded instances keep a habitSettings snapshot, so subsequent recurrence changes do not rewrite their displayed context. Legacy records without a snapshot remain readable.

## To-do behavior

Active and Pending contain only today's scheduled task-habit occurrences. Active offers Complete; Pending offers Complete and Mark missed at the exact deadline. Untimed tasks remain Active for their local day. Time never records a miss. Yesterday's unrecorded instances leave actionable tabs and stay reviewable in the tracker.

Completed and Missed retain recorded habit occurrences across dates. A compact Habit history selector offers All time (default), Today, This week (Monday-Sunday), and This month, filtering by original scheduled date. Ordinary tasks are unaffected by this habit-specific selector. Counts, results and empty states use the same scope. Historical analytics always receive the full dataset. Recorded timestamps are displayed separately from deadlines.

Cards open exact-task details using a native full-card button and sibling outcome buttons; no View Task button or nested controls were added. Details contain no outcome actions. Habit items offer Open habit and Edit habit, which opens the source editor directly. Ordinary Edit/Delete permissions are unchanged.

## Tracker actions and corrections

Future dates have no outcome actions. Today's task can be completed immediately; Mark missed requires its deadline. Untimed current-day tasks cannot be marked missed. Past unrecorded tasks support retrospective Complete/Mark missed.

Event habits can be completed from their scheduled start and marked missed from their end. Past unrecorded events allow retrospective actions. A rescheduled event must reach its actual new start/end before those actions; replanning preserves the original date and missed outcome. Nothing is marked missed automatically.

Intentional corrections in the tracker support Completed to Missed, Missed to Completed and clearing to Unrecorded, subject to the same timing guards. Each correction asks for confirmation. The task/event record's current fields are updated only after a confirmed save, while outcomeChanges appends the prior outcome/timestamps, new outcome/timestamps, an ID and actual correction time. Original completion/miss audits remain intact. Same-outcome repeats preserve the first current timestamp. Saving locks prevent competing UI submissions; repository failures leave confirmed state intact and allow retry.

Clearing today returns the task to Active/Pending according to its deadline; clearing a past task leaves it in tracker review. After clearing, card completion still uses the same record and extends its audit chain. Explicit completed rescheduled events receive credit on their original scheduled date in this milestone; their actual completion timestamp and moved slot remain visible. The earlier provisional Review exclusion is superseded.

## Grid, feedback and Schedule

Dates are rows; habits are columns. Green/Done means completed, red/Missed means explicit missed, neutral/Open means unrecorded, and black means not scheduled. Text/accessible labels accompany every state. Today is highlighted. Planned future cells have distinct text and dashed styling and offer no recording actions. Black cells have no activation action. Arrow keys/Home/End move focus between cells; native controls support Enter/Space. Sticky dates/headers and horizontal scrolling support smaller screens. Row totals count completed/scheduled occurrences only. Empty states distinguish no habits, no scheduled period and no eligible feedback.

Weekly/monthly feedback uses shared original-date records once per occurrence. Its denominator includes past scheduled occurrences and today's elapsed or explicitly recorded occurrences, excluding future/unscheduled dates. Untimed unrecorded tasks become elapsed only after their day ends. Counts distinguish completed, explicit missed and unrecorded; completion rate is completed/eligible times 100. Zero eligible displays No eligible occurrences yet. Corrections update counts/rates from current outcomes; historical audits are not extra occurrences.

Event habits appear in the existing timetable/event ordering, participate in duration conflicts and remain visible on future selected dates. No new timetable view was added. Details show Habit, original date, current start/end, historical recurrence and backup time or No backup time set; no timezone is shown in the description. Schedule has no Complete, Mark missed or checkbox outcome controls, including the earlier personal-event missed button. Existing data/service history and replanning for already missed events are preserved; habit outcome entry belongs in the tracker.

## Persistence and compatibility

Existing browser keys remain: habits version one, tasks version two with the existing version-one migration, and schedule version one. Optional startDate/endDate, habitSettings and outcomeChanges fields extend the existing records. No new parallel outcome store, destructive migration, reset or load-time rewrite was introduced. Validators check correction chains and their current state while retaining original audits. Duplicate source aliases are resolved by original date; conflicting outcomes are reported without automatic cleanup. Historical analytics deduplicate original-date identities and retain full history.

Dates use configured student timezones, not server/browser calendar dates. Local-midnight/deadline timers are aligned to minutes; focus/visibility resume and relevant storage notifications refresh views. Schedule reprojects on date/rule/timezone changes. Future unrecorded slots adopt the refreshed configured timezone; recorded/past contexts and IDs remain stable. The standalone identity remains Development student/Africa-Lagos by default, without a timezone-settings screen or live portal integration.

Rules and projections are separate localStorage writes, not a cross-key transaction. Partial generation can be retried idempotently; quota/access/stale-tab failures are surfaced. This prototype has no account sync/server authorization. A portal backend should preserve these shared identities and use transactional storage.

## Validation and review

Focused tests cover dates/frequency, optional deadlines, exact timing, future rejection, retrospective outcomes, current and past corrections/clears, correction replay validation, failed saves, source snapshots, archiving, history filters, unchanged ordinary tasks, feedback eligibility and timezone-preserving identities. Existing navigation, card/action, grid, analytics, recurrence, conflict and persistence tests continue to pass.

A headless Edge check ran in an isolated browser-check profile, with only test fixtures. It exercised creation, one active card, task-card completion without opening a dialog, source editor navigation, historical filters, shared clearing, explicit event times, event correction, schedule details/no outcome controls, Escape dismissal, full-URL preservation, reload deduplication and mobile horizontal scrolling. Screenshots and browser-check-results.json are in the source checkpoint. This is not a full screen-reader, real-device or long-suspension audit.

## Code rollback versus data rollback

The source checkpoint is C:/Productivity Layer/checkpoints/habit-refinements-2026-11-07. ROLLBACK.md explains guarded UI-only and full-source reversal. Hash checks stop if later work has changed a file. No rollback is applied automatically.

Do not restore old localStorage to undo code: it would erase new user outcomes. Once corrections have been recorded, old strict readers may reject their current-state/audit combination. Prefer UI-only rollback while keeping the compatible model/storage/service code, or prepare a forward compatibility patch. A full old-source rollback can require that patch to read corrected records. Keep all current user data and correction history; there is no recommended destructive data rollback.

Live midnight verification also passed while the isolated browser stayed open: the grid advanced to November 8, only the new day's task was actionable, and yesterday's unresolved record remained unchanged. See browser-midnight-results.json in the checkpoint.
