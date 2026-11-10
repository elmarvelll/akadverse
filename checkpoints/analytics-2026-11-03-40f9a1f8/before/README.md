# Productivity Layer

A visual planner for a student's scheduled time. The app uses a development student in Africa/Lagos, browser persistence, and explicitly labelled sample academic data.

## To-do List milestone

Open `/#tasks`, or choose To-do List from the sidebar. Ordinary tasks support creation, viewing, editing, deletion with confirmation, explicit Complete / Mark missed actions, combined date/priority filters, six sort modes and Pending / Completed / Missed tabs. `/#tasks?task=<taskId>` opens the exact task. See [TASKS.md](TASKS.md) for the integration contract, assumptions, manual journey and recovery notes.

Ownership rules: tasks are created and completed in To-do List; habits are created and managed in the future Habit Tracker, where habit completion may also be recorded. Today is a read-only overview with links when it is implemented. Schedule manages personal-event planning, with read-only task deadlines and exact View task links. Task/habit creation and task completion controls are absent from Schedule.

Task data retains the `productivity-layer.tasks.v1` key and now has a version-two schema with safe version-one migration. Schedule storage is unchanged. Existing statuses/timestamps and audits are retained; ambiguous legacy statuses block loading without modifying the saved data. Habit tasks are authoritative occurrence records, accessed through `HabitTaskGateway`, not independent completion copies. No sample habit tasks are inserted into real user data. Today and a full Habit Tracker are not present in this workspace.

## Run and verify

Use Node.js 24 or later.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd start
```

Open http://localhost:3000.

## Planning behavior

- Create a sub-category before creating an event. Event forms require one of the current student's existing categories. Legacy uncategorized records remain readable, but edits require selecting a category.
- All and category buttons filter the same records. An academic category can also include official timetable sessions.
- Scheduled events, tasks and habit practices all appear. Completing an activity in its own tracker does not remove its planned time from the schedule. Archived activities are hidden; historical records are preserved.
- New events ask for an intended date and start/end time, with no scheduling-mode selector. Ordinary edits use the same time fields. The schedule has no completion action or productivity scoring panel.
- After an event ends, the student can explicitly mark it missed. This records the attempt without moving it, even when a backup exists. Replan event then offers smart or manual rescheduling. Cancelling preserves the missed attempt and its slot. Time passing alone never marks an event missed.
- Smart rescheduling is restricted to explicitly missed events awaiting replanning. It finds the earliest free slot on the selected date within the chosen window and duration, checking every category and official class. It excludes elapsed times today. If nothing fits, the miss stays unchanged; choose another day, widen the window, or switch to manual.
- Manual scheduling keeps the selected time. A clash initially blocks saving and lists the overlapping commitments. The student can explicitly confirm keeping that slot. Both affected cards then display the conflict, including official classes. Category filtering does not hide conflicts with other categories. Adjacent intervals do not overlap.
- Completed activities still reserve their recorded time. Archived events, cancelled sessions and dropped courses do not block scheduling.
- Official lectures cannot be edited, moved, archived, completed or given a backup through personal-event operations. Smart scheduling never moves lectures. A personal catch-up is a separate activity.
- The optional focus filter remains based on an explicit date commitment rather than priority. Same-day events only; overnight events are unsupported.

## Manual walkthrough

1. With no categories, select Create event. Create a category first, then select Create event again.
2. Create a personal event in an existing sub-category. Tasks are created through the To-do List and habits through their future tracker. The current category is preselected when creating an event from its filter.
3. Enter an intended date and time directly. Try a weekday 09:30-10:00 slot, overlapping the sample class. Review the warning and explicitly choose whether to keep it.
4. Create a past event and mark it missed through Details. Confirm it stays in place. Open Replan event, choose Smart or Manual, and select a future date. Smart rescheduling with a 60-minute duration and an 08:30-13:00 window avoids the 09:00-10:30 class and all other activities.
5. Click All, then each sub-category button. Check that only matching records and applicable classes appear. Existing completed records remain visible in the timeline list.
6. Open Details for a personal activity. It has no Complete action. An elapsed pending event offers Mark missed; a missed event offers Replan event. Official lectures have neither action.
7. Review a clash on both affected cards, including while filtering to only one category. Open History to inspect prior plans and outcomes.

The workspace contains the earlier schedule prototype rather than Awesome's timeline design. It has no Agenda mode or current-time line to remove. This change implements the requested logic and supporting filter/conflict controls; a full timeline redesign is separate.

## Architecture and integrations

- `domain.ts`: shared records, visual schedule selectors, category validation, conflict indexing, serialized mutations, manual confirmation and smart slot search.
- `adapters.ts`: development identity, sample classes, PortalClient contract and PortalAcademicProvider.
- `storage.ts`: asynchronous repository, version-one validation, stale-tab detection and non-destructive failures. Existing version-one records remain readable; task sources now carry taskId.
- `Forms.tsx` and `ScheduleManager.tsx`: planning dialogs, source/category filters, read-only outcomes, conflict feedback and history.
- `tests/schedule.test.ts`: planning, shared-record, history, provider and persistence tests.

Legacy schedule task/habit snapshots retain their source identifiers and remain readable, with their personal-event mutation controls hidden. They are not silently converted into new tasks or fabricated habits. New To-do records use the task repository; Schedule derives deadline summaries from those exact records, rather than creating duplicate scheduled work sessions. Browser storage changes and returning to the app refresh the views. A full Habit Tracker, recurrence generator and external synchronization still require later integration.

The app continues to use sample academic data. To connect a real portal, inject an authenticated PortalClient through PortalAcademicProvider and replace the sample provider in ScheduleManager. The adapter refreshes registrations and sessions together to reflect changes, cancellations and dropped courses. Production authentication and server authorization are not implemented.

Shared completion is retained for owning activity modules. Recording a miss and rescheduling are separate operations; backups never trigger automatic movement. The provisional productivity helper remains for a future analytics consumer. Completion and scoring are not exposed as schedule actions.

## Persistence and limits

Storage key: `productivity-layer.schedule.v1`. Failed/corrupt reads do not replace saved records. Back up raw browser storage before manual recovery. Failed writes leave saved records intact. Storage is local to this browser, with no account synchronization or transactional multi-tab guarantee. Stale writes are detected where possible.

Dates and times are explicit local values with an IANA timezone. Cross-zone conversion and overnight events are unsupported. Backups must be later than the event and preserve duration.

Automated checks cover domain and persistence behavior. Actual browser interaction, mobile layout, keyboard navigation and dialog focus still need manual review.
