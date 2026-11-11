# To-do List milestone

## Ownership

- To-do List creates, edits, deletes and completes ordinary tasks. It also displays supplied task-type habit occurrences and records their completed or missed outcomes.
- Habit Tracker owns habit creation, definitions and recurrence. See [HABITS.md](HABITS.md) for the implemented tracker.
- Schedule manages personal events and time planning. Task creation, task completion, habit creation and habit-completion controls are absent. The dedicated Task Deadlines view and its entry points have been removed. Task deadlines remain in To-do forms, details, sorting, shared queries and analytics.
- Today is a read-only overview with navigation links, without mutation controls. Today is now implemented using shared selectors and stable task identifiers for dashboard selection. No dedicated Task Deadlines component remains.

The app remains a local prototype with Development student in Africa/Lagos. Client owner filtering is not server authorization.

## What works

Schedule Manager and To-do List share the single `/` route. Sidebar selection and View task use native type=button controls, updating the active-section state and exact task identifier. They do not read or write location/history when activated, and leave the pathname, query and existing hash unchanged. Optional externally supplied fragment links remain readable on initial load. There are no `/tasks` or nested task routes. Task data and operations are unchanged.

`/#tasks` has Active (the default), Pending, Completed and Missed tabs, new ordinary task creation, details, editing pending ordinary tasks, explicit completion/missed outcomes, confirmed deletion, a Sort by input and six deterministic sorting modes. Empty lists, no matches, loading, failed loading, saving, failed saving and retry are distinct states. Forms preserve input when a write fails. No reopening or undo-completion was added.

`/#tasks?task=<taskId>` opens that exact record after reload or navigation, without changing its outcome. Details show intended deadline separately from the actual completion timestamp and retain audit snapshots of edits. Deleted ordinary records are tombstoned, hidden from lists and retained for audit; direct links display their deleted state without mutation controls.

Active cards offer Complete only. Pending cards offer Complete and Mark missed. Completed and Missed cards show their recorded outcomes without outcome buttons, including habit cards. The card and operation use the same deadline classifier; stale controls cannot mark a future or undated task missed. Outcomes update the same record and move it into Completed or Missed without deletion. Intended deadlines remain separate from completedAt and missedAt. Repeated calls preserve the first outcome timestamp and one audit entry. Conflicting submissions are blocked while saving, and failed writes leave the previous confirmed state visible. Ordinary outcomes cannot be changed or reopened. The existing tracker integration operation for late habit completion is retained for compatibility, but Completed/Missed cards and task details expose no outcome controls.

Active and Pending are derived from the same stored unfinished records; neither is a new recorded outcome. A future or undated unfinished task is Active. A timed deadline moves it into Pending exactly at its local HH:mm; date-only deadlines move it at the next local midnight. Completed/Missed outcomes always take precedence. A deadline edit can move an unfinished task back to Active. No clock transition writes a record, audit entry or reschedule. Existing schema-one/two records retain their stored pending/completed/missed status and timestamps; no new migration or data rewrite is needed.

The open task view refreshes at aligned minute boundaries and immediately on focus or visibility return, avoiding a mount-relative one-minute delay at a deadline. Outcome saves keep the selected tab.

Each accessible status tab shows its total non-deleted task count; filters and sorting operate inside the selected tab. The list also shows the filtered result count. Arrow Left/Right wrap between tabs, Home/End select the first/last tab, and focus follows selection. Tab selection is local state separate from dashboard section selection and never changes the URL. Each status has its own empty state.

## Files and operations

| File | Responsibility |
| --- | --- |
| `src/features/tasks/domain.ts` | Task/source/audit types, input validation, deadline precision and overdue rules |
| `service.ts` | Create, update, delete, complete, exact-ID lookup, history and occurrence receipt |
| `queries.ts` | Combining filters, nonmutating sorting, exact task URLs and read-only daily summaries |
| `storage.ts` | Validated version-one browser repository and refresh notifications |
| `habits.ts` | Shared occurrence gateway for Habit Tracker |
| `TaskManager.tsx`, `TaskForm.tsx` | Task interface and dialogs using the existing application style |
| `TaskStatusTabs.tsx`, `TaskOutcomeActions.tsx` | Accessible four-tab navigation and distinct Complete / Mark missed controls |
| `src/app/page.tsx`, `src/features/workspace/Workspace.tsx` | One root route with in-page section and task selection |
| `tests/tasks.test.ts` | Task journey, outcome, query, storage and integration verification |

TaskService exposes `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `completeTask`, `markTaskMissed`, and `getHistory`. The last operation preserves the shared outcome-history query; the visible UI uses Completed and Missed tabs. Inputs never supply creation/completion timestamps or ownership. IDs use UUIDs. A delete is distinct from completion and preserves audit entries.

## One authoritative habit outcome

The minimal integration boundary is `HabitTaskGateway`, constructed with the same TaskService/repository used by To-do List:

```ts
// Called by the tracker adapter, not by the To-do UI.
const gateway = new HabitTaskGateway(taskService);
await gateway.receive({
  title: "Read twenty minutes",
  priority: "medium",
  habitId: registeredHabit.id,
  habitName: registeredHabit.name,
  occurrenceId: scheduledOccurrence.id,
  scheduledDate: scheduledOccurrence.date,
}, actualScheduledDates);
```

The tracker must supply actual scheduled dates, not dates invented by To-do List. Receipt rejects an occurrence outside that schedule or one whose deadline disagrees with its scheduled date. A stable owner/habit/occurrence key prevents duplicates and cannot be reused for a different date.

The received habit task record IS the occurrence outcome. To-do completion and `gateway.completeOccurrence(habitId, occurrenceId)` update that single record. The tracker reads `gateway.getOccurrence` for its cell and `gateway.totals(date)` for completed/scheduled/pending/missed totals. There is no second outcome flag to synchronize. The habit grid derives green from completed and red from missed; daily totals and read-only task summaries derive from the same status. The implemented tracker uses these same authoritative task records; see HABITS.md. `gateway.recordMiss` and To-do `markTaskMissed` share the same missed-outcome operation; elapsed time alone remains unrecorded. Late completion retains the prior missed audit, without adding scoring rules.

Habit fields are read-only in To-do List and cannot be edited or deleted through ordinary-task operations. Open habit selects the originating occurrence in Habit Tracker without navigation. Fixtures are confined to automated tests and never added to user storage. Habit creation and recurrence generation are implemented separately in src/features/habits using this shared task contract. Production integration should retain a shared authoritative backend.

## Persistence and recovery

Tasks retain the existing `productivity-layer.tasks.v1` storage key and now use `{version:2,tasks:[]}`. Version-one data is migrated in memory on load. Its known statuses were already pending/completed/missed: pending stays pending regardless of expired deadlines, completed retains its original timestamp, and explicit missed records receive missedAt from their existing missed audit timestamp. IDs, source relationships, deadlines, audit history and deletion tombstones are preserved. Loading alone does not overwrite version-one data; the next successful mutation saves the validated version-two dataset. The repository follows the existing load-before-save, validation, failed-write and stale-tab conventions. Invalid JSON, unsupported versions, malformed deadlines, source relationships, duplicate occurrence keys and inconsistent outcome/audit records cause a load error. Unreadable data is never silently replaced by an empty dataset. Unknown legacy statuses (including unverified labels such as active or unfinished) are treated as ambiguous and block loading with a recovery message; their raw records remain untouched. No guessed mappings, inferred missed outcomes or partial destructive replacements are used. Missing or conflicting audit evidence also fails validation without rewriting storage.

The existing `productivity-layer.schedule.v1` key is untouched, including when tasks are created/completed and when Schedule later saves. Existing schedule records need no migration. Legacy task/habit event snapshots remain read-only in Schedule; no speculative migration into real tasks/habits is performed.

On load failure, preserve/export the raw key in browser tools before manual repair. There is no destructive reset button. Failed writes preserve the previous saved records and entered form data. Service operations report success only after repository saving succeeds. Browser storage events, local task-change notifications and returning focus refresh read-only consumers. Storage remains browser-specific, without account synchronization or guaranteed simultaneous multi-tab transactions.

## Reversible assumptions and later decisions

- Deadlines are optional; undated tasks show **No deadline**. Supplying a time requires a date. Date-only deadlines never acquire an invented time.
- Date filters select one calendar date, rather than ranges. Creation dates are interpreted in the configured student timezone.
- A date-only unfinished task stays Active until that local day ends, then becomes Pending. Timed deadlines use their entered minute precision. Overdue changes a label only; it never completes, misses, deletes, moves or reschedules tasks.
- Deadline sorts put undated tasks last in both directions. On a shared date, date-only deadlines sort after timed deadlines in ascending order and before them in descending order. Creation timestamp then ID breaks remaining ties.
- Completed and missed ordinary tasks are read-only except for confirmed deletion. There is no reopening or restore action. Historical late-completion audit data and the tracker integration remain preserved; task cards with a recorded outcome do not offer further outcome actions.
- Deletion is a tombstone retaining audit records; retention/export policy remains a later decision.
- Editing individual habit occurrences, production identity/storage, and scoring rules remain later decisions.
- Scheduled work-session links, goals, reminders, accountability and a full offline sync system are outside this milestone.

## Run and review

Use Node.js 24+ in `C:\Productivity Layer\schedule-manager`:

```powershell
npm.cmd run dev
# Or, for the production server:
npm.cmd run build
npm.cmd start
```

Open http://localhost:3000/#tasks. Verification commands:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Manual review journey:

1. Create a future-deadline task and an undated task; both appear in Active. Complete one early and confirm its actual timestamp remains in Completed after reload.
2. Reload and open a specific task with View task. Edit a deadline and try each Sort by option. Shared query filters remain supported; the management UI continues to expose only Sort by.
3. Leave a future-deadline task open at 14:59 for a 15:00 deadline. At 15:00 it belongs in Pending without any new history. Returning from an idle/background tab or reloading must classify it the same way. Editing that unfinished deadline back into the future returns it to Active.
4. Mark another pending task missed, inspect its unchanged intended deadline and missed-outcome timestamp in Missed, and reload. An arrived/overdue task must stay Pending until an explicit action or a future deadline edit. Check a date-only deadline at the next local midnight. Check Arrow Left/Right, Home/End, Enter/Space and focus behavior on the tabs.
5. Delete another ordinary task, checking Cancel and Confirm. Inspect the preserved deleted record through its prior link.
6. Confirm the dedicated Task Deadlines view is absent. In Schedule, open a personal event: Backup shows its date/time or exactly No backup time set, and event/backup details have no visible timezone label. Task deadlines and deadline analytics remain available in To-do.
7. Test failed storage access/writes and retry without losing the entered draft. Keep browser data backed up before deliberately corrupting it.

Automated tests cover the service/persistence journey and habit integration through test-only occurrences. No browser automation tools were available; desktop/mobile layout, keyboard navigation, dialog focus and the full interactive browser journey remain unverified.

## Task card and dialog interactions

Cards in all four tabs have a whole-card native details button with an accessible task-specific label and a visible focus outline. Its absolute hit area covers the card, while sibling outcome buttons sit above it. No button contains another button. Enter/Space activates the focused details button. Card details select the exact task through dashboard state without changing the URL; the separate View task control has been removed from To-do cards.

Complete appears directly on Active cards. Pending cards offer Complete and Mark missed. Neither outcome button is shown on Completed/Missed cards. Their callbacks stop propagation and do not open details. Saving locks competing submissions, and failed writes preserve the previously confirmed record. Mark missed is accepted only once an unfinished deadline arrives, using the same shared classifier as the card; deadline passage alone still never records an outcome.

Task details contain information/audit history and only the permitted Edit task and Delete task actions: pending stored ordinary tasks (both Active and Pending views) may be edited and deleted; recorded ordinary outcomes permit deletion only. Habit fields cannot be edited or deleted here, and deleted records have no task actions. Completion/missed controls are absent from details. Native dialog close controls and Escape dismissal are preserved.


## Current habit refinement rules

Active/Pending scope unfinished habit tasks to today. Completed/Missed retain recorded habit history with All time/Today/This week/This month scheduled-date filtering, applied only to habit records. Counts match that scope. Edit habit opens the source editor; To-do details still have no outcome controls. Optional deadlines and intentional tracker corrections use the same authoritative task record and preserve the original audit plus an outcomeChanges chain. See HABITS.md, which supersedes earlier conflicting habit-specific rules in this document.
