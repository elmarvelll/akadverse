# AkadVerse Productivity Layer: user guide and testing handbook

**Audience:** students, product reviewers, and anyone helping test AkadVerse.  
**Reviewed:** 15 November 2026, local `productivity-layer-integration` branch.  
**Status:** a guide to the current implementation, not a claim that every test below has passed on your deployment.

The Productivity Layer is a student's personal workspace for deciding what to do, organising time, building recurring habits, and reviewing progress. It brings personal plans and eligible official classes into one place while keeping each record connected to the feature that owns it.

For example, you can create a task called “Submit chemistry assignment”, reserve a personal event called “Work on chemistry”, and create a recurring reading habit. These are different records: completing the assignment does not automatically complete the work session or the habit.

## Contents

1. [Getting started](#1-getting-started)
2. [Understanding the four sections](#2-understanding-the-four-sections)
3. [Today](#3-today)
4. [To-do List](#4-to-do-list)
5. [Habit Tracker](#5-habit-tracker)
6. [Schedule Manager](#6-schedule-manager)
7. [Analytics and progress](#7-analytics-and-progress)
8. [Account settings, saving, and reliability](#8-account-settings-saving-and-reliability)
9. [What is outside the current feature set](#9-what-is-outside-the-current-feature-set)
10. [Preparing to test](#10-preparing-to-test)
11. [Quick acceptance check](#11-quick-acceptance-check)
12. [Detailed manual test cases](#12-detailed-manual-test-cases)
13. [Reporting a problem](#13-reporting-a-problem)
14. [Developer reference](#14-developer-reference)

## 1. Getting started

Sign in with a student account, then open `/studashboard/productivity-layer` on the AkadVerse website. The workspace checks the signed-in account against the backend. A lecturer or administrator account does not gain access simply by opening this URL.

You need a working internet connection to save changes. Records belong to your account and are stored by AkadVerse; they are not just a list stored in that browser. Refreshing the page or signing in again should retain confirmed changes.

Open **Account settings** to check your timezone. The default is `Africa/Lagos`; the settings can suggest the device timezone. Save the timezone you actually want to use before checking deadlines or calendar dates.

The desktop sidebar can collapse. On smaller screens, use the navigation menu. **Back to Akadverse** returns to the main student dashboard.

## 2. Understanding the four sections

| Section | Main question it answers | Typical activity |
| --- | --- | --- |
| Today | What needs my attention today? | Review focus events, tasks, habits, and classes. |
| To-do List | What must I finish? | Create tasks, record completion, or explicitly record a missed deadline. |
| Habit Tracker | What do I want to repeat? | Define a routine and record each scheduled occurrence. |
| Schedule Manager | When will I do it? | Plan personal events around habits and official classes. |

A **task** is an item to finish. An **event** reserves a time slot. A **habit** is a repeating rule that generates individual occurrences. An **occurrence** is one scheduled instance of a habit, such as Monday's reading session.

A task-type habit appears in To-do List when eligible. An event-type habit appears in Schedule Manager. These are linked views of the same occurrence, not independent copies. Manage the recurring rule and correct its outcomes in Habit Tracker.

## 3. Today

Today combines useful information from the other sections:

- Open-task count and a count of tasks completed today.
- Habits completed compared with habits scheduled today.
- Items on today's schedule, including personal events, event habits, and available official classes.
- **Focus for today**, drawn from events explicitly marked **Must complete**.
- Task and habit entries that open their relevant detail views.

The task preview is bounded; it is not an unlimited replacement for To-do List. A notice explains when more tasks are available elsewhere.

High priority and **Must complete** mean different things. A high-priority event is important; it only becomes a focus event when you explicitly choose **Must complete**.

If official timetable data cannot be loaded, the page should explain that separately. An unavailable class list must not be presented as proof that you have no classes. Your personal records should remain useful where the page supports a separate retry.

Nothing becomes completed just because its time passes. The application records outcomes when you explicitly choose a supported outcome action.

## 4. To-do List

### Creating and editing tasks

Choose **New task**, enter a title, and save. A task supports:

| Field | Meaning |
| --- | --- |
| Title | Required, up to 200 characters after trimming. |
| Description | Optional additional details, up to 10,000 characters. |
| Priority | Low, Medium, or High. |
| Intended completion date | Optional local calendar date. |
| Intended completion time | Optional time; requires a date. |

A task without a deadline is valid. A task with a date but no time remains active throughout that date. You can edit an unfinished ordinary task. Save feedback should tell you whether the backend confirmed the change.

### Active, Pending, Completed, and Missed

**Pending in the visible task tabs means an unfinished item whose intended completion time has arrived. It does not mean the application has recorded a failure.**

| Situation | Visible status |
| --- | --- |
| Ordinary unfinished task with no deadline | Active |
| Unfinished task with a future deadline | Active |
| Date-only deadline is today | Active throughout today |
| Date-only deadline was yesterday | Pending |
| Timed deadline has arrived | Pending |
| You explicitly complete the task | Completed |
| You explicitly record an eligible missed deadline | Missed |

Internally, unfinished tasks use a stored status called `pending`. Developers should distinguish that stored value from the clock-dependent **Active/Pending** tabs.

You can complete an ordinary task before its deadline. **Mark missed** becomes available only when its deadline has arrived. An undated ordinary task has no elapsed deadline to mark missed.

Recorded outcomes for ordinary tasks are final in the current interface. There is no ordinary-task reopen or outcome-correction workflow. Habit occurrences have their own correction workflow in Habit Tracker.

### Finding and reviewing work

You can sort by creation date, intended completion date, or priority, in the offered ascending/descending directions. Lists are paginated, with up to 100 entries per page.

Completed and Missed views offer habit-history periods such as Today, This week, This month, and All time. This filter applies to habit records; it should not silently remove ordinary task history.

Open a task to review details and recorded history. Delete is available for ordinary tasks and requires confirmation. Deletion removes the task from normal work views while retaining backend audit information. It does not count as completion, and the current UI does not offer restore.

### Habit tasks in this list

Unresolved habit tasks scheduled for today can appear in Active or Pending. Future habit projections must not inflate today's workload. Review unresolved past habit dates in Habit Tracker. Historical completed or missed habit occurrences can still appear in the history tabs.

A habit task's detail view offers links to its habit. Changing one occurrence's outcome must not create a duplicate task or rewrite the entire habit rule.

## 5. Habit Tracker

### Defining a habit

Choose **Add habit**. Supply a name, optional description, priority, start date, optional end date, and a frequency:

- **Daily:** scheduled each day within its date range.
- **Specific weekdays:** scheduled on the weekdays you select; at least one is required.

Choose the habit type:

| Type | Time fields | Where occurrences appear |
| --- | --- | --- |
| Task | Optional deadline time | To-do List and Habit Tracker |
| Event | Start and end times | Schedule Manager and Habit Tracker |

Names support up to 100 characters. An event ending earlier on the clock than it starts is treated as an overnight event ending the next day. Equal start and end times are invalid; they do not mean a 24-hour event.

Each occurrence has a stable identity connected to the habit and its original date. Repeated loading should not create multiple copies of Monday's occurrence.

### Reviewing the month

Select a habit and use the monthly grid. Previous/next month and current-month controls let you inspect dates. Dates distinguish scheduled, unscheduled, completed, missed, and unrecorded states. Open a scheduled day to inspect its details.

The grid supports keyboard navigation, including arrow keys, Home, End, and Enter. Available controls depend on the selected date and the occurrence's timing.

### Recording and correcting outcomes

Future occurrences cannot receive outcomes. Today's task occurrence can be completed early. A task occurrence can be marked missed once its timed deadline has passed, or once its date is in the past. An untimed task occurrence cannot be marked missed during its own day.

An event occurrence can be completed once its start has arrived. It can be marked missed once its end has arrived, including the following day's end for an overnight slot.

Eligible past occurrences can be reviewed. Recorded habit outcomes can be changed or cleared using the available actions. A correction asks for confirmation and retains a history of the change. Clearing an outcome means it is unrecorded again; it does not delete the habit.

Editing the habit creates a revision effective from today. Earlier recorded results should remain intact. Archiving stops applicable unrecorded projections while keeping history. Restoring resumes the rule according to its current settings and effective date; it does not erase earlier outcomes.

### Replanning an event habit

After recording an event occurrence as missed, use **Replan event** where available:

- **Manual:** choose a new future date and time slot.
- **Smart:** provide a permitted window and let the scheduling logic find the first fitting free slot while preserving duration.

If no slot fits, expect an explanation and choose another window. The system must not silently overlap existing personal events or official classes. Replanning preserves the original occurrence date and missed-attempt history.

### Habit feedback

Weekly and monthly feedback summarises due occurrences, completions, misses, and unrecorded results. Future scheduled dates are not failures. A zero-due period should not be treated as a 0% achievement failure.

The interface contains a “Needs review” presentation state, but the current outcome calculation does not produce that state. Do not make automatic review-credit behaviour an acceptance requirement for this branch; the companion technical audit records this inconsistency.

## 6. Schedule Manager

### Categories and personal events

Create a **sub-category** before creating an ordinary personal event. Examples include Study, Health, or Personal. Category names support up to 60 characters and are unique for your account without regard to letter case. A category can be flagged academic. The built-in Academics view remains distinct from a personal category with that name.

A personal event has a title, description, category, local date, start/end times, priority, and **Must complete** choice. The form asks for a detailed description. Titles support up to 100 characters. Event slots can run overnight; equal start/end times are invalid.

Saving an ordinary personal event is a manual scheduling action. Smart placement is a replanning workflow, not a general AI planner for new events.

### Day, week, filters, and focus

Switch between Day and Week, move backward or forward, choose a date, or return to Today. Filters let you inspect the combined schedule, Academics, and available personal categories.

**Focus Mode** concentrates on explicit **Must complete** events. It does not simply mean “show every high-priority event”. When moving an event to another date, make the focus decision for that new plan rather than assuming the previous day's focus carries over.

### Conflicts

A proposed slot can conflict with personal events, event habits, or official classes. The application should identify the conflict. Where the form permits keeping a manual conflict, it requires an explicit choice such as **Keep this time and show the conflict on the schedule**.

Changing the proposed slot should clear that permission so a previous decision does not silently authorise a different overlap. A smart search should find a free slot or explain that none fits.

### Backup slots

An optional backup is a later slot of the same duration. A backup is a stored alternative plan, not an automatic move or a notification. The existence of a backup does not mean the event was rescheduled.

### History and archive

Open an event to inspect its slot, source, focus choice, backup, and available history. Ordinary personal events can be edited and archived. Archived events can be restored through History. Archiving does not complete the event or delete the category.

The current Schedule Manager does **not** expose a general Complete or Mark missed button for ordinary personal events. Although the backend has a personal-event missed-attempt operation, do not expect a UI action that is absent. Linked habit outcomes belong in Habit Tracker. This is a current capability boundary worth recording during review.

### Official classes

Official entries come from eligible approved course registration and approved timetable data for the relevant semester. They are read-only here. Details can include the course, lecturer, venue, and timetable context.

Official campus times are interpreted in `Africa/Lagos` and converted for the student's configured timezone. **Plan a personal catch-up** opens a personal event form; it does not change or cancel the official class.

A student without eligible timetable data may correctly see no classes. A failed timetable request is a different condition and should display an error rather than silently looking empty.

## 7. Analytics and progress

Open the Analytics tab within To-do List or Schedule Manager. Habit feedback is shown within Habit Tracker. There is no separate analytics item in the main four-section navigation.

Select **This week**, **This month**, or a custom inclusive date range. Weeks run Monday to Sunday. Custom ranges are limited to 366 days; an invalid range should leave the last valid result available with feedback.

### Task analytics

| Measure | How to read it |
| --- | --- |
| Current workload | Current Active/Pending work; it is not restricted to an old historical chart range. |
| Period status | Current statuses of ordinary tasks created in the period and eligible habit tasks scheduled in the period. It is not a reconstruction of what the database looked like on each past day. |
| Completion trend | Uses actual completion timestamps, even when the task was created earlier. |
| Deadline performance | Uses elapsed deadlines; undated work has no deadline performance to calculate. |

Future unresolved habit projections should not inflate the current task workload. Recorded historical habit work remains useful history.

### Schedule analytics

Planned time is based on scheduled slots. It is **not measured time spent studying** and is not proof of attendance.

Daily occupied time merges overlaps so a one-hour overlap is not counted twice in the overall occupied duration. Overnight events are split across their local calendar days. Separate life-area totals may overlap each other, so adding every area together can exceed the overall occupied hours.

Missed-attempt and rescheduling figures come from explicit recorded actions. Repeated misses can make attempt counts larger than the number of distinct events. A normal edit is not automatically a missed attempt or a reschedule. Official timetable changes are not personal rescheduling actions.

Read any partial-data warning. A chart with unavailable inputs should not imply a trustworthy zero. Chart legends and accessible tabular values help you check what each figure means.

## 8. Account settings, saving, and reliability

### Timezone

A timezone affects what “today” means and how timed slots display. Save it through Account settings. Changing your computer timezone alone is not a substitute for changing the account preference.

When testing a timezone change, verify absolute event times display consistently and check boundaries around midnight. Date-only task deadlines are local calendar intentions; do not assume every stored date shifts like a timed event.

### Save feedback

Save notices distinguish work in progress, confirmed success, and failure. Success should appear only after confirmation from the backend. Success notices expire; errors remain available until dismissed. Hovering or focusing a notice can pause its dismissal.

Closing a pending notice does not cancel the request. Retry controls reuse request identity where implemented to avoid duplicate writes. A lost connection after sending a request can leave the outcome unknown: reload and inspect the record before manually creating the same item again.

Already-loaded information may remain visible during a connection failure. That does not make this an offline editing system. There is no promised offline-write queue with later synchronisation.

### Accounts and privacy

Signing out or switching accounts clears the mounted workspace and its account-scoped read cache. Another student's records must never flash into view or remain actionable. A client-supplied account identifier is not permission to access that account.

## 9. What is outside the current feature set

These should not be mistaken for failing existing buttons:

| Requested behaviour | Current boundary |
| --- | --- |
| Floating Gemini Productivity Assistant | Implemented in this change; requires the Core migration and separately running Python service. Live generation is subject to the verification limits below. |
| Voice input in this workspace | Shared AssemblyAI code has been restored for the assistant; requires server configuration and browser microphone permission. |
| Push, email, or scheduled deadline reminders | Not implemented by the in-app save notices. |
| Automatically marking overdue work missed | Outcomes require explicit supported actions. |
| Automatically moving an event into its backup | A backup is a saved alternative only. |
| Editing official classes or recording attendance | Official timetable entries are read-only. |
| General Complete/Mark missed for personal events in Schedule Manager | No current UI action; habit outcomes are handled by Habit Tracker. |
| Reopening a completed ordinary task | No current ordinary-task correction flow. |
| Full offline editing and automatic later sync | Not supported. |
| Collaboration, shared tasks, or assigning tasks to classmates | Not part of this personal workspace. |
| Visible import/export controls in Account settings | Backend import exists, but the current account panel exposes timezone settings. |

The [AI assistant audit](productivity-ai-assistant-audit.md) records the pre-implementation findings. The [service README](../akadverse-productivity-ai/README.md) describes the implemented integration and setup.

### 9.1 Using the Productivity Assistant

After the developer installs the migration, configures both services, and restarts the app, choose **Assistant** in the workspace. Start a new conversation or select an earlier one. You can minimise it and continue navigating without losing the current draft. Conversations and actual tool results are saved to your account.

Try requests such as:

- “Show my pending tasks.”
- “Create a high-priority task called Revise chemistry, due tomorrow.”
- “Make a daily reading habit starting today.”
- “Show my schedule for tomorrow.”
- “Change the reading task's priority to Medium.”

The assistant asks for missing details and should clarify ambiguous names. Edits and sensitive actions produce a saved proposal naming the record and proposed fields. Inspect it, then use **Confirm** or **Cancel**. Proposals expire after ten minutes; a changed record needs a new proposal. Typing “yes” does not bypass these controls.

**Operation results** distinguish confirmed, not completed, awaiting confirmation, and unknown outcomes. A lost connection can occur after a write commits. Use Reload and, where offered, **Recheck outcome** before asking for another copy. Multi-step requests may partially succeed. Confirming a proposal saves that proposal; ask for any remaining steps afterward.

Use the microphone to dictate into the editable draft. Partial words appear while recording. Stop to finalise; Cancel releases the microphone and preserves committed/manual text. Nothing is submitted to the assistant until you press **Send**. Audio goes to AssemblyAI, while Python/Gemini receive text. Typing remains available if microphone access fails.

You can load older conversations/messages and delete a conversation through a separate confirmation. Deleting chat also removes its unconfirmed proposals; already-saved tasks, habits, and events remain in the workspace. Changing accounts clears the panel, draft, and in-memory history.

This is implemented code, but deployment and real-provider tests have separate requirements. See the [verification report](productivity-ai-verification.md) before marking live AI or microphone acceptance tests passed.

## 10. Preparing to test

Use an agreed test environment and your own disposable records. Prefix titles with `PL TEST` so they are easy to find. Do not delete another person's real work to test deletion.

Record:

- Website/environment and deployed commit if known.
- Student account label, without passwords or session tokens.
- Account timezone, device timezone, and current local date/time.
- Browser/version and approximate screen size.
- Whether this account has eligible official timetable data.

Use two separate student accounts for ownership checks and a non-student account for access checks. Keep each account in a separate browser profile or sign out between tests.

For time-sensitive tests, choose a deadline a few minutes ahead and keep the relevant page active while it passes. For past habit tests, create a disposable habit with a past start date and select an eligible past date. Do not change a shared server clock.

Mark every case **Pass**, **Fail**, **Blocked**, or **Not run**. “Blocked: no approved timetable data” is more accurate than failing a class-display test with an ineligible account.

## 11. Quick acceptance check

Allow about 10–15 minutes, excluding timetable setup and timed waits.

- [ ] Sign in as a student and open the workspace.
- [ ] Confirm the timezone and visit all four sections.
- [ ] Create one ordinary task; refresh and find it again.
- [ ] Complete it and find it in Completed.
- [ ] Create one daily task habit for today; see one occurrence in To-do List.
- [ ] Complete that occurrence and verify Habit Tracker agrees.
- [ ] Create a category and a personal event today; verify Today shows the saved event.
- [ ] Edit the event and verify the saved change after refresh.
- [ ] Open both analytics panels and check labels and empty/error states.
- [ ] Archive the test personal event and restore it from History.
- [ ] Open the workspace on a narrow screen and use the navigation menu.
- [ ] Sign out; confirm records are no longer available to that session.

These boxes are intentionally unchecked. They are a worksheet, not results from this documentation review.

## 12. Detailed manual test cases

Each row gives the action followed by the expected result. Use a fresh fixture when a case records a final ordinary-task outcome.

### Access, navigation, and account isolation

| ID | Steps | Expected result |
| --- | --- | --- |
| A01 | Open the workspace signed out. | Sign-in flow; no student records exposed. |
| A02 | Open it as a non-student. | Access is refused or redirected; no usable student workspace. |
| A03 | As Student A, visit Today, Schedule Manager, To-do List, Habit Tracker, then return. | Correct view each time; navigation is clear and existing view state is preserved appropriately. |
| A04 | Create an A-only task. Sign out, sign in as Student B, and open the workspace. | A's task is absent; no stale A data flashes or remains actionable. |
| A05 | Refresh an open task/habit/event detail link, then use browser Back/Forward. | Selection and section recover without creating records or losing ownership checks. |
| A06 | Save another valid account timezone, reload, inspect a known timed event, then restore your original zone. | Preference persists; displayed event time agrees with the selected zone. |

### Ordinary tasks

| ID | Steps | Expected result |
| --- | --- | --- |
| T01 | Create `PL TEST undated`, no deadline, description, Medium priority; refresh. | Exactly one persisted Active task with the saved fields. |
| T02 | Try an empty/whitespace title and a title over the limit. | Clear validation; no saved blank or oversized task. |
| T03 | Create a task due tomorrow; edit its title and priority. | It remains Active and the saved edit persists. |
| T04 | Create a task due today with no time. | Active during today; not automatically Missed. Check next-day behaviour separately. |
| T05 | Create a task due a few minutes ahead; keep the page active until the deadline passes. | Moves from Active to Pending; no recorded missed outcome yet. |
| T06 | On an eligible elapsed-deadline task, choose Mark missed. | Moves to Missed with a recorded outcome; refresh retains it. |
| T07 | Complete a future-deadline ordinary task. | Moves to Completed immediately; details show actual completion time. |
| T08 | Open a completed ordinary task. | No unsupported ordinary-task reopen/edit-outcome action is offered. |
| T09 | Create tasks with distinct priorities/dates; exercise every sort direction. | Ordering matches the selected field; missing deadlines are handled consistently. |
| T10 | Start deleting a disposable ordinary task; cancel, then repeat and confirm. | Cancel retains it; confirmation removes it from work views without counting it as completed. |
| T11 | With more than 100 eligible records in a prepared test account, use next/previous pages. | Correct counts and page changes; no duplicate or missing boundary item. |

### Habits and shared occurrences

| ID | Steps | Expected result |
| --- | --- | --- |
| H01 | Create a daily task habit starting today with no deadline. | One occurrence for today in Habit Tracker and eligible To-do List; refresh does not duplicate it. |
| H02 | Complete today's habit task from To-do List, then inspect its calendar day. | Both views agree on the same completed occurrence. |
| H03 | Open an unresolved past habit date. | Review is available in Habit Tracker; it does not inflate today's unresolved habit task list. |
| H04 | Create a habit on selected weekdays with an end date; inspect scheduled and unscheduled dates. | Only selected days within the date range are scheduled. |
| H05 | Open a future scheduled occurrence and attempt to record an outcome. | Future outcomes are unavailable/rejected; no future credit is recorded. |
| H06 | On an untimed task habit today, look for Mark missed. | It is unavailable until the date is past; Complete can be available today. |
| H07 | On an eligible past occurrence, record missed, then change it to completed and confirm. | Current outcome changes; correction history and timestamps remain. |
| H08 | Clear that habit outcome using the confirmation flow. | Becomes unrecorded; occurrence and correction history remain. |
| H09 | Edit a habit name/timing after an earlier occurrence has a recorded outcome. | New settings apply from today; earlier recorded result is preserved. |
| H10 | Archive a habit and inspect history; restore it. | History remains; applicable unrecorded projections stop/resume without duplicate identities. |
| H11 | Create an event habit and inspect Schedule Manager. | A linked event appears; rule editing/outcome recording routes to the owning habit. |
| H12 | Open an event occurrence before start, after start, and after end using suitable fixtures/waits. | Completion requires start; missed requires end; future-date guard still applies. |
| H13 | Create an overnight event habit, for example 23:00–01:00. | Displays as overnight; it is not eligible to mark missed at 23:30 before the next day's 01:00 end. Use controlled test fixtures if waiting is impractical. |
| H14 | Record an eligible event habit missed, then manually replan into a future free slot. | New slot saves; original occurrence date and missed attempt remain in history. |
| H15 | Replan a missed habit event with a smart window that has room, then one with no room. | First gets a fitting free slot of the same duration; second explains no fit without silently overlapping. |
| H16 | Inspect weekly/monthly feedback with future, completed, missed, and unrecorded occurrences. | Due denominator excludes future work; counts match eligible dates; no-due state is meaningful. |

### Schedule, focus, and official data

| ID | Steps | Expected result |
| --- | --- | --- |
| S01 | Create category `PL TEST Study`, then try the same name with different letter case. | First saves; duplicate is rejected without adding another category. |
| S02 | Create a described personal event in that category today. Refresh and open Today. | Exactly one event persists and is visible on the correct date in both views. |
| S03 | Try missing category, empty required form fields, and equal start/end times. | Validation explains what to fix; no invalid event saves. |
| S04 | Create a high-priority event without Must complete; compare with a low-priority Must complete event. | Focus follows the explicit choice, not priority alone. |
| S05 | Move a focus event to another date and review the form's focus decision. | New plan uses the explicit choice; previous plan/history is retained. |
| S06 | Create overlapping personal events and decline conflict permission. | Overlap is explained and not silently accepted. |
| S07 | Where offered, explicitly accept the conflict; then change the proposed time before saving. | Keeping a conflict requires the current explicit choice; changing slot clears earlier permission. |
| S08 | Add a valid later backup of equal duration; refresh. Try an invalid-duration backup. | Valid backup persists without moving the main slot; invalid backup is rejected. |
| S09 | Use Day/Week, next/previous, Today, category and Academics filters. | Dates/filters match their labels; event details identify their source. |
| S10 | Archive a disposable personal event; open History and restore. | Removed from active schedule while archived, restored without duplication; history remains. |
| S11 | With eligible approved timetable data, inspect an official class. | Correct course/time and available details; no official edit/delete controls. |
| S12 | From an official class, choose Plan a personal catch-up and save a separate event. | Personal record is created; official entry is unchanged. |
| S13 | Use a configured test failure for official timetable retrieval. | Visible unavailable/partial-data feedback; retry works when restored; personal data is not misrepresented as lost. |

### Analytics, failure handling, and accessibility

| ID | Steps | Expected result |
| --- | --- | --- |
| Q01 | Open both analytics tabs for an empty period and a period with known records. | Clear empty state or meaningful labelled values; no invented outcomes. |
| Q02 | Set custom dates, reverse them, then try a range over 366 days. | Invalid input gets feedback and does not replace the last valid result with misleading charts. |
| Q03 | Complete today a task created earlier; choose today's range. | Completion trend includes the actual completion; creation-cohort status and current workload retain their distinct meanings. |
| Q04 | Compare two overlapping one-hour events with a half-hour overlap. | Overall occupied time is 1.5 hours, not 2; separate area totals may still differ. |
| Q05 | Inspect a two-hour overnight event across both local dates. | Planned duration is split across days, not doubled or placed wholly on the wrong day. |
| Q06 | In a test environment, delay a save, activate Save twice, then refresh. | Pending feedback and one logical mutation; no duplicate record from the same pending action. |
| Q07 | In a test environment, fail a save request and use Retry after restoring connectivity. | Error stays available; no false success; final saved result is confirmed and not duplicated. |
| Q08 | Dismiss a pending notice while the request is delayed. | Dismissal does not falsely imply cancellation; final state agrees with the server. |
| Q09 | Reload after confirmed saves; sign out/in on the same account. | Saved records remain available from the backend. |
| Q10 | Use a narrow phone-sized screen with an open form/dialog. | Navigation, fields, actions, notices, and scrolling remain reachable without hidden critical controls. |
| Q11 | Use only keyboard: skip link, navigation, modal, habit grid, Save, Cancel. | Visible focus, correct labels, sensible dialog focus handling, and return to the trigger. |
| Q12 | Enable reduced motion and inspect charts/notices with accessibility tools. | Essential information remains readable without relying only on animation, colour, or pointer hover. |

Tests requiring a prepared large dataset, controlled failures, overnight timing, or eligible official data may be Blocked until a developer provides a safe fixture. Record the dependency instead of treating an unexecuted test as passed.

## 13. Reporting a problem

Use this template in the agreed issue tracker. Attach a screenshot only after checking it contains no sensitive information.

```markdown
### Productivity Layer issue
- Test ID:
- Environment / commit:
- Browser and device:
- Account label / role (no credentials):
- Account timezone:
- Local date and time:
- Section:
- Test record title or safe identifier:

Steps to reproduce:
1.
2.
3.

Expected:
Actual:
Reproduces after refresh? Yes / No
Visible error and reference ID:
Screenshot / recording, if safe:
Impact: blocks access / incorrect record / wrong display / minor usability
```

Treat cross-account exposure, incorrect destructive actions, or false success on a failed write as urgent. For slow loading, record whether the issue affects personal data, official classes, or both, and include any reference ID. Never paste API keys, database URLs, browser cookies, or full authenticated request headers.

## 14. Developer reference

The implementation behind this guide is in:

- [Workspace and navigation](../src/features/productivity/workspace/Workspace.tsx).
- [Today](../src/features/productivity/today/TodayView.tsx).
- [Tasks](../src/features/productivity/tasks/TaskManager.tsx).
- [Habits](../src/features/productivity/habits/HabitTracker.tsx).
- [Schedule](../src/features/productivity/schedule/ScheduleManager.tsx).
- [Analytics](../src/features/productivity/analytics/AnalyticsPanel.tsx).
- [Account settings](../src/features/productivity/AccountTools.tsx).
- [API route](../src/app/api/productivity/route.ts) and [operation dispatcher](../services/productivity-layer/operations.ts).
- [Core Prisma schema](../prisma/schema.prisma).

Existing package scripts include:

```sh
npm run test:productivity
npm run typecheck
npm run lint
```

Database, HTTP integration, performance, and browser notification scripts also exist in [package.json](../package.json). They require suitable local services, credentials, or a disposable database; read the script before running it against any shared environment.

Related implementation notes: [integration](productivity-integration.md), [analytics eligibility](productivity-analytics-eligibility.md), [save notices](productivity-notifications.md), [account loading](productivity-account-loading.md), and [release notes](productivity-release.md).

This document was checked against source code. Its manual test checklist still needs execution on the target deployment; documentation review does not establish that a restarted server, a migration, or a GitHub merge is healthy.
