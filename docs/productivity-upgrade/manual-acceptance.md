# Manual acceptance guide — student portal, calendar and PIP

**Begin at `/studashboard` in the running application from this checkout.** Use an ordinary student account and local/staging data. The new feature set has not been deployed to production by this assignment. For local database setup, use the existing [developer database guide](../../for_Developers/DATABASE.md); do not reset a shared database. If the development server is already running, refresh it after it picks up these source changes. Otherwise use the repository’s normal `npm run dev` workflow after configuring local database URLs.

Restart an already-running Python productivity service before the live PIP cases so it reloads the shared tool definitions and prompt (`npm run dev:ai` is the existing local launcher). No new production environment variables or migrations are needed for this upgrade.

Follow A → B → C → D → E → F → G → H. D and E are critical persistence journeys. Tests can be repeated independently when their dependencies are met. Record any failure using the **Test ID**, exact local/staging URL, observed behavior, and the complete error reference. Do not post credentials or tokens.

## Shared sample data

Choose **D**, an upcoming weekday, and **D+1**, the following date. Enter actual dates wherever a prompt says `[D]`; do not send the literal placeholder. Use the timezone shown by the app, **Africa/Lagos** for the examples. On 16 November 2026, D can be 17 November 2026; choose a later date if that is no longer future.

| Record | Sample | Allocation | Deadline / recurrence |
| --- | --- | --- | --- |
| Category | UAT Study | — | Existing personal category |
| Task | UAT Study EIE 342 | D, 09:00–10:30 | Optional deadline D, 18:00 |
| Event | UAT Project Team Meeting | D, 11:00–12:00 | One personal event |
| Event habit | UAT Daily Revision | D, 06:30–07:00 | Daily, starting D |
| Overlap task | UAT Assignment | D, 09:30–10:00 | Deliberately overlaps the first task |

Check existing official classes before choosing free event times. If these examples conflict with real commitments, use another local/staging date or explicitly test the conflict workflow. No automated check created production test records. Ordinary event removal uses **Archive event**; it is not a new hard-delete feature. PIP is currently non-streaming: a final response is expected, not simulated token-by-token output.

## Student Portal

### A01 — Marketplace loading

**Test ID:** A01

**Feature:** Marketplace loading

**Starting location:** /studashboard

**Dependencies:** Signed-in ordinary student; throttle a local/staging connection if the route is instant

**Priority:** High

**Steps**

1. Click Marketplace once.
2. While navigation is pending, inspect the Marketplace icon.
3. Wait for the destination to finish.

**Expected result:** Only its icon pulses orange and announces opening; Marketplace opens and the pulse stops.

**Failure indicators:** No feedback during a delayed transition, wrong colour, frozen loading, or multiple navigations.

### A02 — E-Learning loading

**Test ID:** A02

**Feature:** E-Learning loading

**Starting location:** /studashboard

**Dependencies:** Same account as A01

**Priority:** High

**Steps**

1. Click E-Learning.
2. Inspect the icon while pending.
3. Wait for the dashboard.

**Expected result:** Green icon pulse; destination is /e-learning/student/dashboard; loading ends.

**Failure indicators:** Wrong route, full-screen navigation spinner, or persistent pulse.

### A03 — Productivity loading

**Test ID:** A03

**Feature:** Productivity loading

**Starting location:** /studashboard

**Dependencies:** Same account as A01

**Priority:** High

**Steps**

1. Click Productivity Layer.
2. Inspect the icon while pending.
3. Wait for the workspace.

**Expected result:** Blue icon pulse; Productivity Layer opens.

**Failure indicators:** Wrong colour, no pending feedback on a delayed route, or stuck pulse.

### A04 — Repeat clicks and return navigation

**Test ID:** A04

**Feature:** Repeat clicks and return navigation

**Starting location:** /studashboard

**Dependencies:** Desktop browser; restore normal network speed afterward

**Priority:** High

**Steps**

1. Delay navigation using browser network throttling.
2. Rapidly click one card twice and try another card while pending.
3. Let navigation finish and use browser Back.
4. Navigate again.

**Expected result:** Only one transition starts while pending; returning to the hub leaves usable cards.

**Failure indicators:** Repeated route pushes or a permanently disabled card after Back.

### A05 — Results and CGPA removal

**Test ID:** A05

**Feature:** Results and CGPA removal

**Starting location:** /studashboard, then E-Learning dashboard

**Dependencies:** Student role; staff result workflows are outside this visibility removal

**Priority:** High

**Steps**

1. Inspect hub cards and E-Learning dashboard.
2. Open full and collapsed student sidebar.
3. Visit /e-learning/student/academic-records/results, /gpa-cgpa and /academic-history using their full academic-records paths.

**Expected result:** No Results/CGPA student cards, widgets or menu group; old student academic-record views return to the protected dashboard.

**Failure indicators:** Visible placeholder/coming-soon replacement, CGPA widget or result table.

## E-Learning

### B01 — Back to Marketplace link

**Test ID:** B01

**Feature:** Back to Marketplace link

**Starting location:** /e-learning/student/dashboard

**Dependencies:** Student session

**Priority:** High

**Steps**

1. Find Back to Marketplace near the top of the sidebar.
2. Click it.
3. Repeat from a mobile drawer.

**Expected result:** Returns to /studashboard, where all three apps are available.

**Failure indicators:** Navigates directly into the store, invents another homepage, or is absent on mobile.

### B02 — Exact Dashboard destination

**Test ID:** B02

**Feature:** Exact Dashboard destination

**Starting location:** A student course or Study Zone page

**Dependencies:** Student session; any accessible E-Learning page

**Priority:** High

**Steps**

1. Click Dashboard in the sidebar.
2. Check the address.
3. Repeat with collapsed sidebar.

**Expected result:** /e-learning/student/dashboard is reached and only that exact dashboard has its active state.

**Failure indicators:** E-Learning root redirect, wrong portal or inconsistent rail destination.

### B03 — Responsive sidebar

**Test ID:** B03

**Feature:** Responsive sidebar

**Starting location:** /e-learning/student/dashboard

**Dependencies:** Desktop and approximately 390px mobile viewport

**Priority:** Medium

**Steps**

1. Collapse and expand the desktop sidebar.
2. At mobile width open the drawer.
3. Use the return link and reopen navigation.

**Expected result:** Return icon remains labelled in the rail; mobile links work and drawer closes after navigation.

**Failure indicators:** Clipped return link, inaccessible icon or drawer blocking the destination.

## Study Zone

### C01 — Stuart naming

**Test ID:** C01

**Feature:** Stuart naming

**Starting location:** Study Zone and an accessible course workspace

**Dependencies:** Accessible course; live answer needs the existing Study Zone provider

**Priority:** High

**Steps**

1. Open the study assistant.
2. Inspect header, input label, empty state and status messages.
3. Send an ordinary learning question if its provider is configured.

**Expected result:** Visible assistant name is Stuart, including accessibility labels and error guidance.

**Failure indicators:** New user-facing Stuwart spelling or accidentally renamed API paths causing errors.

### C02 — Classroom Stuart compatibility

**Test ID:** C02

**Feature:** Classroom Stuart compatibility

**Starting location:** An accessible classroom session

**Dependencies:** Local/staging classroom with a lesson; provider required for a real answer

**Priority:** High

**Steps**

1. Open the lesson assistant.
2. Send a question about the selected lesson.
3. Close and reopen it.

**Expected result:** Stuart label, retained lesson context and persisted conversation; classroom controls keep working.

**Failure indicators:** Broken /stuwart technical endpoint, lost history or classroom/video interference.

### C03 — Independent assistant identities

**Test ID:** C03

**Feature:** Independent assistant identities

**Starting location:** Study Zone, then Productivity Layer

**Dependencies:** Student session

**Priority:** High

**Steps**

1. Inspect Stuart in Study Zone.
2. Open Ask PIP in Productivity Layer.

**Expected result:** Study Zone says Stuart; productivity says PIP with its own robot and conversation.

**Failure indicators:** Cross-renamed assistants or a shared conversation appearing across domains.

## Event Management

### D01 — Create a category and event

**Test ID:** D01

**Feature:** Create a category and event

**Starting location:** Productivity Layer → Schedule Manager

**Dependencies:** Healthy local/staging Core and E-Learning databases; unoccupied slot

**Priority:** Critical

**Steps**

1. Choose New sub-category and create UAT Study if absent.
2. Choose Create event.
3. Enter UAT Project Team Meeting, description Discuss project milestones, category UAT Study, date D, 11:00–12:00.
4. Save event.

**Expected result:** One confirmed event appears in the correct date/time range; form closes after confirmation.

**Failure indicators:** Timetable timeout, phantom card, missing category or duplicate event.

### D02 — Event persistence

**Test ID:** D02

**Feature:** Event persistence

**Starting location:** Schedule Manager on date D after D01

**Dependencies:** D01 completed

**Priority:** Critical

**Steps**

1. Refresh the page.
2. Return to date D.
3. Open UAT Project Team Meeting.

**Expected result:** Exactly one saved event retains title, description, category and 11:00–12:00.

**Failure indicators:** Missing event, duplicate rows or time/date drift.

### D03 — Edit an event

**Test ID:** D03

**Feature:** Edit an event

**Starting location:** UAT Project Team Meeting details

**Dependencies:** D01; keep the new slot free

**Priority:** Critical

**Steps**

1. Choose Edit event / set backup.
2. Change title to UAT Updated Project Meeting and time to 12:00–13:00.
3. Save.
4. Refresh and reopen.

**Expected result:** The same event moves and updated details persist; no duplicate original remains active.

**Failure indicators:** Old and new copies, unchanged slot or lost fields.

### D04 — Remove and restore using archive

**Test ID:** D04

**Feature:** Remove and restore using archive

**Starting location:** UAT Updated Project Meeting details

**Dependencies:** D03; this system uses archive rather than a new hard-delete endpoint

**Priority:** High

**Steps**

1. Choose Archive event and confirm.
2. Inspect active date D.
3. Open History and restore the archived event.

**Expected result:** Archived event leaves active grid, retains history and can be restored once.

**Failure indicators:** Event remains active while archived or history is destroyed.

### D05 — Input validation and repeat submission

**Test ID:** D05

**Feature:** Input validation and repeat submission

**Starting location:** Schedule Manager → Create event

**Dependencies:** Disposable local/staging category and event title UAT Validation

**Priority:** High

**Steps**

1. Try saving an empty title.
2. Try equal start/end times.
3. Enter valid fields and click Save repeatedly while pending.

**Expected result:** Invalid input receives understandable feedback; valid submission saves only once; entered data is retained on failure.

**Failure indicators:** Generic success for invalid data, duplicate records or erased draft.

### D06 — Conflict with an allocated task

**Test ID:** D06

**Feature:** Conflict with an allocated task

**Starting location:** Schedule Manager on date D

**Dependencies:** E01; official timetable must be reachable

**Priority:** Critical

**Steps**

1. First complete E01.
2. Create UAT Overlap Meeting at 09:30–10:30 on D.
3. Inspect the conflict warning.
4. Choose another slot or explicitly check Keep this time and show the conflict, then save.

**Expected result:** Allocated task is identified; explicit overlap choice is required for the conflicting event; retained overlap is visible.

**Failure indicators:** Task omitted from conflict check, silent override or phantom event after rejection.

### D07 — Original timetable failure regression

**Test ID:** D07

**Feature:** Original timetable failure regression

**Starting location:** Schedule Manager → Create event

**Dependencies:** Working academic DB; production connection capacity is a separate prerequisite

**Priority:** Critical

**Steps**

1. With healthy local/staging academic data, save UAT Timetable Regression at a free time.
2. Verify it after refresh.
3. If it fails, retain the form and copy the complete new reference ID.

**Expected result:** Healthy dependency permits persistence; a real dependency failure is visible, reference-bearing and leaves no confirmed phantom event.

**Failure indicators:** Same connection timeout persists, failure disguised as success, or secret/raw-query leakage.

## Task Management

### E01 — Create an allocated task

**Test ID:** E01

**Feature:** Create an allocated task

**Starting location:** Productivity Layer → To-do List → New task

**Dependencies:** Local/staging student; date D chosen below

**Priority:** Critical

**Steps**

1. Enter UAT Study EIE 342, High priority and optional deadline D at 18:00.
2. Enable Allocate time on my schedule.
3. Set scheduled date D, start 09:00, end 10:30.
4. Save task.
5. Open Schedule Manager → All, Focus Mode off, date D.

**Expected result:** A blue Task card spans 09:00–10:30 without manually creating an event.

**Failure indicators:** Deadline mistaken for work time, no card or duplicate event copy.

### E02 — Deadline without an allocation

**Test ID:** E02

**Feature:** Deadline without an allocation

**Starting location:** To-do List → New task

**Dependencies:** Same account; allocated task E01 may coexist

**Priority:** High

**Steps**

1. Create UAT Deadline Only with deadline D at 15:00.
2. Leave Allocate time unchecked.
3. Inspect To-do List and calendar date D.

**Expected result:** Task is saved in To-do List and receives no guessed calendar duration.

**Failure indicators:** An invented time block appears or a deadline is required unnecessarily.

### E03 — Reschedule source task

**Test ID:** E03

**Feature:** Reschedule source task

**Starting location:** UAT Study EIE 342 task details

**Dependencies:** E01; task must still be unfinished

**Priority:** Critical

**Steps**

1. Edit its allocation to D+1, 14:00–15:30.
2. Save.
3. Inspect D and D+1 in Schedule Manager.
4. Refresh.

**Expected result:** Old day has no task block; new day has one 90-minute block with the same source task.

**Failure indicators:** Stale old position, duplicate event or lost task identity.

### E04 — Complete the scheduled task

**Test ID:** E04

**Feature:** Complete the scheduled task

**Starting location:** UAT Study EIE 342 in To-do List

**Dependencies:** E03; ordinary task outcomes are final

**Priority:** Critical

**Steps**

1. Mark the task complete.
2. Return to D+1 in the calendar.
3. Open its card.

**Expected result:** Task remains at its planned interval with Completed outcome, and opens the completed source record.

**Failure indicators:** Calendar loses the planned record or still claims it is unrecorded.

### E05 — Delete a scheduled task

**Test ID:** E05

**Feature:** Delete a scheduled task

**Starting location:** UAT Study EIE 342 details

**Dependencies:** E04 or another disposable ordinary allocated task

**Priority:** Critical

**Steps**

1. Choose Delete task and confirm.
2. Inspect its calendar day.
3. Refresh.

**Expected result:** Task is removed from active lists and calendar; audit remains in storage; no duplicate representation survives.

**Failure indicators:** Lingering active task/event copy or delete counted as completion.

### E06 — Remove time allocation only

**Test ID:** E06

**Feature:** Remove time allocation only

**Starting location:** A new unfinished UAT Allocation Removal task

**Dependencies:** Disposable ordinary task, not a habit-generated task

**Priority:** High

**Steps**

1. Create it with a working interval.
2. Edit and uncheck Allocate time on my schedule.
3. Save.
4. Inspect task and calendar.

**Expected result:** Task and deadline remain; calendar block disappears.

**Failure indicators:** Task deleted, deadline erased or stale calendar block remains.

### E07 — Account isolation

**Test ID:** E07

**Feature:** Account isolation

**Starting location:** Two separate ordinary student test accounts

**Dependencies:** Two local/staging accounts; never use another real student’s data

**Priority:** Critical

**Steps**

1. Create a uniquely named task in account A.
2. Copy its details hash.
3. Sign out and sign in as B.
4. Inspect task/calendar views and try the copied hash.

**Expected result:** B cannot see or modify A’s source task; no cached private content leaks.

**Failure indicators:** A’s task/card/name appears for B or B can change it.

## Schedule Manager

### F01 — Mixed activities on one day

**Test ID:** F01

**Feature:** Mixed activities on one day

**Starting location:** Schedule Manager → All → date D

**Dependencies:** Healthy DB; Focus Mode off; category UAT Study exists

**Priority:** Critical

**Steps**

1. Create a 09:00–10:30 allocated task and an 11:00–12:00 event.
2. In Habit Tracker create UAT Daily Revision, type Event, Daily, start D, 06:30–07:00.
3. Return to date D.

**Expected result:** All applicable source activities appear at their own times; no task needs an event duplicate.

**Failure indicators:** One activity overwrites another, missing event habit or duplicated occurrence.

### F02 — Overlapping cards

**Test ID:** F02

**Feature:** Overlapping cards

**Starting location:** To-do List, then Schedule Manager date D

**Dependencies:** F01; task overlaps are permitted and indicated

**Priority:** High

**Steps**

1. Create another allocated task UAT Assignment at 09:30–10:00.
2. Return to the grid.
3. Open both task cards.

**Expected result:** Overlapping cards use separate lanes, retain readable labels and show conflict indicators.

**Failure indicators:** One card covers/erases the other or opens the wrong record.

### F03 — Legend and source labels

**Test ID:** F03

**Feature:** Legend and source labels

**Starting location:** Schedule Manager above the grid

**Dependencies:** F01; official lecture requires approved registration/timetable

**Priority:** Medium

**Steps**

1. Read the legend.
2. Compare a task, event habit, personal event and available official lecture.
3. Inspect labels as well as colours.

**Expected result:** Tasks blue, habits green, events red, official classes purple; text identifies their kind.

**Failure indicators:** Legend/card mismatch or colour is the only distinction.

### F04 — Overnight allocation

**Test ID:** F04

**Feature:** Overnight allocation

**Starting location:** To-do List → New task

**Dependencies:** Choose dates visible within the selected calendar range

**Priority:** High

**Steps**

1. Create UAT Overnight at D 23:00–01:00.
2. Inspect day D and D+1, or a week containing both.

**Expected result:** One source task displays segments before and after midnight; source details retain the original interval.

**Failure indicators:** Wrong next day, missing continuation, full-day block or duplicate task rows.

### F05 — Timezone consistency

**Test ID:** F05

**Feature:** Timezone consistency

**Starting location:** Productivity Layer account settings

**Dependencies:** Ordinary allocated task; record original timezone before testing

**Priority:** High

**Steps**

1. Create a 09:00–10:30 Africa/Lagos task.
2. Change account timezone to UTC using existing settings.
3. Inspect the same instant on the grid.
4. Restore Africa/Lagos.

**Expected result:** UTC displays 08:00–09:30; source allocation is not rewritten just by viewing; restored zone returns correct display.

**Failure indicators:** Clock times treated as UTC without conversion or source time shifts repeatedly.

### F06 — Navigation and cache freshness

**Test ID:** F06

**Feature:** Navigation and cache freshness

**Starting location:** Schedule Manager day/week controls

**Dependencies:** At least one disposable allocated task

**Priority:** High

**Steps**

1. Switch Day/Week.
2. Navigate to another range and back.
3. Edit or delete a source task in To-do List.
4. Return without full-page reload.

**Expected result:** Date headings align, correct range loads and changed task cards refresh.

**Failure indicators:** Old range data reused incorrectly or stale task persists until a hard reload.

### F07 — Focus and category filters

**Test ID:** F07

**Feature:** Focus and category filters

**Starting location:** Schedule Manager on date D

**Dependencies:** An event and allocated task on D

**Priority:** Medium

**Steps**

1. Turn Focus Mode on.
2. Compare with All and Focus Mode off.
3. Mark a personal event Must complete on D and inspect again.
4. Select a category and return to All.

**Expected result:** Focus shows explicit must-complete events; allocated tasks appear in the combined All view with Focus off; category filtering remains scoped.

**Failure indicators:** All tasks disappear unexpectedly in All or high priority alone is treated as a must-complete event.

## PIP

### G01 — Launcher, ripple and robot

**Test ID:** G01

**Feature:** Launcher, ripple and robot

**Starting location:** Any Productivity Layer section

**Dependencies:** Student workspace loaded

**Priority:** High

**Steps**

1. Inspect Ask PIP.
2. Observe several two-second pulses.
3. Open the panel.
4. Inspect the header and greeting.

**Expected result:** Friendly PIP robot, blue/light surfaces and a subtle ripple; no fake action-shortcut buttons.

**Failure indicators:** Ask AI/Assistant branding, unrelated Stuart avatar, intrusive flashing or canned unsupported action controls.

### G02 — Conversation and close/reopen

**Test ID:** G02

**Feature:** Conversation and close/reopen

**Starting location:** Open PIP

**Dependencies:** At least one PIP conversation; no provider needed to type

**Priority:** High

**Steps**

1. Start a conversation if needed.
2. Type a draft.
3. Close and reopen PIP.
4. Switch to an existing conversation and return.

**Expected result:** Existing conversation and per-conversation draft remain; input focus is usable.

**Failure indicators:** Draft lost on minimization or unrelated conversation content appears.

### G03 — Readable Markdown

**Test ID:** G03

**Feature:** Readable Markdown

**Starting location:** PIP with configured AI service

**Dependencies:** Live Python/Gemini service; deterministic rendering/security is also covered by automated fixtures

**Priority:** High

**Steps**

1. Ask for a plan using a heading, numbered steps, bullets and a small table.
2. Inspect the reply.
3. Reload the conversation.

**Expected result:** Supported Markdown renders semantically and remains formatted in saved history; wide tables/code scroll inside the panel.

**Failure indicators:** Raw asterisks/heading markers, broken nested lists, unsafe executable HTML or page overflow.

### G04 — Conversation persistence

**Test ID:** G04

**Feature:** Conversation persistence

**Starting location:** PIP after a completed exchange

**Dependencies:** Existing saved conversation; healthy Core DB

**Priority:** High

**Steps**

1. Reload the page.
2. Open PIP.
3. Select the same conversation.
4. Inspect messages and saved-result links.

**Expected result:** Actual conversation and execution history persist for the same account.

**Failure indicators:** History replaced by a synthetic success message or lost after refresh.

### G05 — Natural-language scheduled task

**Test ID:** G05

**Feature:** Natural-language scheduled task

**Starting location:** PIP in a new conversation

**Dependencies:** Live Python/Gemini; replace [D] with an exact upcoming date

**Priority:** Critical

**Steps**

1. Send: Create a high-priority task titled UAT PIP Study EIE 342, allocate [D] from 09:00 to 10:30 in Africa/Lagos, with a deadline at 18:00.
2. Answer any clarification.
3. Open the saved task and calendar.

**Expected result:** Backend-confirmed task, correct interval on the grid and link to its source; one task, no disconnected event.

**Failure indicators:** Success claimed without a saved record, missing allocation or duplicate copy.

### G06 — Natural-language event creation

**Test ID:** G06

**Feature:** Natural-language event creation

**Starting location:** PIP; category UAT Study already exists

**Dependencies:** Live AI plus healthy Core/E-Learning dependencies

**Priority:** Critical

**Steps**

1. Send: Create UAT PIP Team Meeting on [D] from 13:00 to 14:00 in Africa/Lagos, category UAT Study, description Discuss project milestones, medium priority.
2. Review any required confirmation.
3. Inspect calendar.

**Expected result:** One confirmed personal event with the requested fields, correct date/time and source link.

**Failure indicators:** Invented category/ID, silent conflict override or text-only success without persistence.

### G07 — Retrieve the combined schedule

**Test ID:** G07

**Feature:** Retrieve the combined schedule

**Starting location:** PIP after F01 and G05

**Dependencies:** Live AI; known records on D

**Priority:** High

**Steps**

1. Ask what is scheduled on exact date D.
2. Compare returned tasks/events with the grid.
3. Ask for official classes if available.

**Expected result:** PIP uses backend task/event data and approved class facts, without inventing allocations.

**Failure indicators:** Allocated tasks omitted, stale/deleted records reported active or invented lectures.

### G08 — Confirmation and schedule removal

**Test ID:** G08

**Feature:** Confirmation and schedule removal

**Starting location:** PIP with UAT PIP Study EIE 342 saved

**Dependencies:** Live AI; an unambiguous unfinished ordinary task

**Priority:** Critical

**Steps**

1. Ask to remove its allocated working interval while keeping the task.
2. Inspect the proposal.
3. Verify no change before clicking.
4. Use Cancel, then request again and use Confirm.

**Expected result:** Preview clearly says allocation removal; Cancel preserves it; Confirm removes only the interval; task/deadline remain.

**Failure indicators:** Typed yes bypasses required UI confirmation, wrong task changed or task deleted.

### G09 — Honest unsupported recurrence/reminder handling

**Test ID:** G09

**Feature:** Honest unsupported recurrence/reminder handling

**Starting location:** PIP new conversation

**Dependencies:** Live AI; do not approve a changed recurrence unless intended

**Priority:** High

**Steps**

1. Ask to work out before 21:00 every two days.
2. Separately ask for a delivered reminder.
3. Inspect clarification and operation results.

**Expected result:** PIP explains supported recurrence/delivery limits and asks for a supported alternative; no false Habit saved or notification promise.

**Failure indicators:** Unsupported every-two-day recurrence claimed saved, or a reminder promised without a delivery feature.

### G10 — Provider failure and confirmed outcomes

**Test ID:** G10

**Feature:** Provider failure and confirmed outcomes

**Starting location:** Local/staging PIP only

**Dependencies:** Controlled local failure; do not stop shared production services

**Priority:** Critical

**Steps**

1. With a developer, make the local AI service unavailable and send a harmless read request.
2. Inspect feedback.
3. Restore service and reload conversation.
4. For an interrupted write, inspect saved cards/results before any retry.

**Expected result:** Clear failure and recoverable history; only durable confirmed changes get Saved cards; unknown outcomes offer recheck.

**Failure indicators:** Fabricated success, repeated mutation to discover status or loss of already confirmed operations.

### G11 — Voice draft preservation

**Test ID:** G11

**Feature:** Voice draft preservation

**Starting location:** PIP composer

**Dependencies:** AssemblyAI configuration, browser permission and secure/localhost origin

**Priority:** High

**Steps**

1. Allow microphone when configured.
2. Dictate a short draft.
3. Stop and review.
4. Edit it manually.
5. Cancel another recording.
6. Send only when ready.

**Expected result:** Voice remains editable, nothing auto-submits, and cancel preserves committed/manual text; errors allow typing.

**Failure indicators:** Automatic send, lost manual corrections or microphone continues after close.

### G12 — Expand, close and keyboard focus

**Test ID:** G12

**Feature:** Expand, close and keyboard focus

**Starting location:** Open PIP with a draft

**Dependencies:** Any student viewport

**Priority:** Medium

**Steps**

1. Use Expand and Restore size.
2. Press Escape.
3. Reopen using Ask PIP and tab through controls.

**Expected result:** Panel fits available viewport; draft survives; Escape returns focus to launcher; controls are keyboard accessible.

**Failure indicators:** Off-screen composer, trapped focus or lost conversation.

## Responsive UI

### H01 — Desktop layout

**Test ID:** H01

**Feature:** Desktop layout

**Starting location:** Portal, E-Learning and Productivity at about 1440×1000

**Dependencies:** Desktop browser

**Priority:** Medium

**Steps**

1. Open each updated view.
2. Inspect calendar headings/cards and PIP.
3. Use its expand control.

**Expected result:** Aligned grid and readable controls; PIP leaves usable workspace space and can expand.

**Failure indicators:** Clipped controls, overlapping header text or broken grid columns.

### H02 — Tablet layout

**Test ID:** H02

**Feature:** Tablet layout

**Starting location:** Same views at about 820×1100

**Dependencies:** Tablet or browser emulation

**Priority:** Medium

**Steps**

1. Open sidebar/drawer as offered.
2. Browse schedule dates.
3. Open and expand PIP.
4. Scroll messages and a table.

**Expected result:** Navigation, composer and schedule remain reachable; overflow stays in scrollable regions.

**Failure indicators:** Horizontal page overflow or hidden Send/Close controls.

### H03 — Mobile layout

**Test ID:** H03

**Feature:** Mobile layout

**Starting location:** Same views at about 390×844

**Dependencies:** Mobile device or emulation

**Priority:** High

**Steps**

1. Open mobile navigation.
2. Select Schedule Manager.
3. Scroll calendar horizontally/vertically.
4. Open a card.
5. Open PIP and use the composer.

**Expected result:** Day/date headings stay aligned, cards remain selectable, modal/PIP fit and native dialogs take precedence.

**Failure indicators:** Off-screen close button, unusable date controls or page-wide overflow.

### H04 — Reduced motion and accessibility

**Test ID:** H04

**Feature:** Reduced motion and accessibility

**Starting location:** OS/browser accessibility settings, then portal/PIP

**Dependencies:** Reduced-motion setting; restore original preference afterward

**Priority:** Medium

**Steps**

1. Enable reduced motion.
2. Trigger a portal transition and inspect Ask PIP.
3. Navigate controls with keyboard.
4. Review schedule category labels.

**Expected result:** Pulses stop animating while static feedback/labels remain; focus is visible and colours are not the only cue.

**Failure indicators:** Continuous motion despite preference, inaccessible icon-only control or invisible focus.

### H05 — Test-data cleanup

**Test ID:** H05

**Feature:** Test-data cleanup

**Starting location:** To-do List, Habit Tracker and Schedule History

**Dependencies:** Only data you created for this guide

**Priority:** High

**Steps**

1. Delete disposable UAT ordinary tasks.
2. Archive UAT events and habits using existing controls.
3. Confirm no unwanted active commitments remain.

**Expected result:** Active views are clean without resetting the database or deleting another account’s data.

**Failure indicators:** A test task/event persists as active after its source was removed.
