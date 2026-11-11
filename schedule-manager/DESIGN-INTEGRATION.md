# Figma interface integration

Implemented on branch `integration/figma-productivity`, starting from `5df093c`. No commit or deployment was made. The previously untracked `figma-reference` export is preserved unchanged.

## Reference inspection and adaptation

The reference is a separate React/Vite/Tailwind application. Its `ProductivityPortal.tsx` composes the shell and imports `TodayScreen`, `TasksScreen` and `HabitsScreen` from `screens.tsx`. For its active timetable it imports **student/ScheduleManager.tsx**, rather than the alternative `ScheduleScreen` in `screens.tsx`. `src/imports/InteractiveScheduleManagerDesign.tsx` is the static generated drawing, not the working portal's timetable. Both were inspected; the rendered portal and student manager informed this integration.

| Reference | Working adaptation |
| --- | --- |
| `ProductivityPortal.tsx` | `WorkspaceShell.tsx`: 64px header, 240px sidebar / 72px collapsed, selected blue navigation, contained content and mobile drawer |
| `components.tsx` | `Design.tsx`, `figma.css`: native ProdButton/StatusPill adaptations, local vector icons, shadows, inputs, badges and accessible existing dialogs |
| `screens.tsx` TasksScreen / ActivityCardRow | Existing TaskManager, TaskCard, TaskForm and four status tabs, with the exported compact activity treatment |
| `screens.tsx` HabitsScreen | HabitSummaryCards and styled HabitGrid/Tracker; counts come from existing feedback calculations |
| `student/ScheduleManager.tsx` | ScheduleTimetable and timetable layout: real day/week ranges, 72px hour axis, tinted event cards, overlap columns and visible clash markers |
| `screens.tsx` TodayScreen | TodayView plus pure selectToday: live overview and exact-record navigation |
| `flowsAndMatrices.tsx` | Mobile sizing, interaction and accessibility references; no acceptance/demo pages are exposed |
| `src/styles` | Dashboard-scoped styles plus self-hosted Inter/Plus Jakarta Sans and accompanying OFL licences |

No Vite entry point, HTML file, React Router, mock arrays, design-page controls, state-preview switches, invented streaks, hardcoded dates, simulated offline/sync/conflict states, or unrelated portal modules were imported into production. Existing dependencies and package/lock files are unchanged. `figma-reference` is excluded from Next TypeScript and ESLint checks; all actual application code and tests remain checked strictly.

The export's reusable JSX/styles were adapted to native Next client components. Existing native dialogs and established service operations were retained instead of replacing their focus, persistence and failure handling with preview animations. Fonts are served locally; application screens do not depend on a runtime Google Fonts request. Main colours are `#185CFF`, `#0F172A`, `#475569`, `#F7F8FA`, white and the export's soft status tints.

## Completed stages

1. **Shell:** one persistent shell replaces duplicate per-module chrome. Sidebar selection still uses WorkspaceNavigation state, with no URL/history writes. Skip-to-content also uses focus rather than changing the hash. Mobile navigation hides its closed links and makes content inert while open; resizing cleans up the drawer state. Native button labels preserve keyboard access when collapsed.
2. **To-do:** compact ActivityCardRow styling uses a completion checkbox button, title/source, priority dot, deadline and source pill. Completed titles are struck through. Details, completion and explicit missed actions remain separate native sibling controls; actual records, task sorting, four tabs/counts and habit history periods remain. Ordinary Edit/Delete and source Edit habit are preserved. Actual outcome timestamps remain available in task details. Failed saves keep inputs and confirmed records intact.
3. **Habits:** compact blue/white cards show real eligible completion counts. Selecting a card displays its seven-column monthly calendar; a separate pencil/Edit habit button opens the existing prefilled editor. Actual recurrence descriptions appear below each name, and Manage habit retains archive/restore access. Rounded green/pink/gray date tiles, weekday headings, month controls, a legend and the adjacent consistency panel follow the reference. Real month lengths, recurrence, recorded outcomes, corrections, archiving and feedback remain authoritative.
4. **Schedule:** the exported week interface now uses current configured-local dates and real projections. Day and Monday–Sunday week navigation load applicable habit events and academic sessions. Partial academic failures are reported without hiding personal/habit events. Adjacent intervals share a column; overlapping intervals receive independent columns and existing conflict detection still checks hidden categories. No event is moved automatically. Academic entries use an education icon and are labelled sample until a portal provider is connected. Existing categories, event forms, backups, history, archive and replanning operations remain.
5. **Today:** read-only live task, habit and timetable sections. Focus comes only from explicit must-complete schedule commitments, never priority. Tasks link by task ID; habits by habit/date; events/classes by their existing IDs. No task/habit creation, outcome buttons, checkboxes or fabricated progress are present.
6. **Responsive polish:** desktop/tablet/mobile typography and spacing, sticky matrix labels, contained horizontal scrolling, compact timetable events, focus/hover/disabled/error states, reduced-motion support and sidebar drawer/collapse behavior.

## Data and behavior preserved

No storage migration, new domain store or duplicate outcome field was introduced. Existing browser keys, IDs, original occurrence dates, correction chains, timestamps and audit histories remain authoritative. Presentational rows reference those records. The small `eventOutcome` extraction lets the timetable and tracker read the same current event outcome without rewriting it.

Task-habit Active/Pending remain today-only; Completed/Missed retain history and scheduled-date filters. Untimed tasks preserve the existing local-day rule. Future/past unresolved tasks do not flood To-do. Timed tasks transition at equality; time never records a miss. Tracker retrospective/current/future action permissions and intentional corrections remain enforced by existing shared operations. Event habits remain visible on the viewed future schedule dates. Today and Schedule have no outcome controls. The removed Task Deadlines section and Agenda view were not reintroduced.

## Deliberate design adjustments and assumptions

- The Habit Tracker now follows the export's selected-habit attendance calendar. Its demonstration-only 28-day month, invented statuses and click-to-cycle behavior are replaced with actual dates, shared outcomes and the existing occurrence dialogs. Calendar and feedback stack on mobile.
- Four task tabs and historical habit filters replace the export's incomplete unresolved-task preview flow.
- Today cards navigate instead of completing activities. Task details retain permitted management actions only; habit management goes to the source editor.
- Production has the four core sidebar items, not unimplemented goals, study groups, accountability, reminder or component-gallery links.
- The existing root default remains Schedule Manager. Today is the first sidebar item and can also be opened with an incoming `#today` fragment; section changes never write that fragment.
- Direct timetable access replaces the export's preview landing/enter-workspace flow. Day/week views are implemented; there is no Agenda or draggable editing behavior. Event changes use the existing forms.
- Hover/focus and reduced-motion-safe CSS are retained; optional spring animations and simulated synchronization are deferred.
- The two design fonts are self-hosted with Inter body text and Plus Jakarta Sans headings. Monospace showcase text and unused photo/screenshot assets are not shipped.
- A category literally named Academics is labelled `Academics (category)` alongside the separate Academics system filter to avoid indistinguishable controls.

## Verification

Baseline: the existing 112 tests passed. Final: **115 tests pass**, lint has no warnings, standalone TypeScript checking and the Next production build pass. The build still has only `/` and the framework not-found route. Test output retains the existing Node experimental-TypeScript notice and TSX test-harness key warnings; there are no test failures.

New focused tests cover real visible date/week ranges across year boundaries, nonmutating overlap placement, adjacency, duplicate display IDs, Today ownership, actual timing and explicit focus rules. Existing recurrence, storage, outcome/correction, history, midnight/timezone, conflict, analytics, navigation, keyboard-tab and card/action tests remain passing.

An isolated headless Edge profile completed **31 browser assertions** against the production build with no captured runtime exceptions or console errors. These include failed-create input preservation, failed completion retaining confirmed state, keyboard Enter details, task edit/delete/complete/miss, optional deadlines, explicit event times, future action rejection, today-only habit cards, shared corrections/history filters, future M/W/F timetable projections, conflict confirmation/indicators, backup fallback/no timezone in event details, read-only Today, exact-task navigation, unchanged pathname/query/hash, reload deduplication, mobile overflow and drawer behavior, and 72px desktop collapse.

Integrated screens were rendered and visually inspected at 1440×1000 and 390×844 against the source-defined export layout, tokens and components. Screenshots and `browser-results.json` are in `../checkpoints/figma-integration-2026-11-10`. The full unrelated Vite portal was not run and no automated pixel-diff comparison was performed. These checks do not replace a real-device or screen-reader audit.

Remaining standalone limits: development identity, browser-local persistence, sample academic provider and no account/cloud synchronization. Storage writes across domain keys are still not transactional. Real portal integration is a separate task; there are no simulated success/sync controls pretending it is connected.

## Exact commands

From `C:\Productivity Layer\schedule-manager`, using Node 24+:

```powershell
npm.cmd run dev
```

Production and verification:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run start -- --hostname 0.0.0.0 --port 3000
```

Open http://localhost:3000. Use the actual application directory; do not run the reference Vite application as the replacement.

## Reverse only this integration

The checkpoint at `C:\Productivity Layer\checkpoints\figma-integration-2026-11-10` contains before copies, a changed-file manifest and a hash-guarded rollback script. Its `ROLLBACK.md` gives the check-only and explicit apply commands. Guards stop before making changes if later work or backups no longer match. The untracked reference folder is never touched. No rollback was applied during verification.

Code rollback is separate from data rollback. This integration introduced no schema change; the checkpoint already contains compatible habit outcome/correction readers from the prior milestone. Reverting only these source changes retains all newly created tasks/events/habits and their outcomes. Do not delete browser storage, restore old data snapshots, reset Git or blanket-clean untracked files to undo the interface.
