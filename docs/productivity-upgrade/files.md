# Categorized file modification catalog

This catalog lists actual changes/new files in the working checkout. It does not count inspected-only files. There are no deleted files or database model/migration edits. Naming-only rows deliberately preserve technical `StuwartPanel` / `ClassroomStuwart` identifiers, lowercase endpoint paths and existing `stewart` configuration/storage contracts.

The previous uncommitted event/signature work was preserved. `services/productivity-layer/operations.ts` contains both the prior lecturer-lookup fix and this assignment’s new task-commitment wiring; its row below describes the new addition rather than claiming the old fix was newly invented.

## AI and PIP integration

| File | Change and reason |
| --- | --- |
| [akadverse-productivity-ai/app/agent/prompts.py](../../akadverse-productivity-ai/app/agent/prompts.py) | Name PIP, distinguish deadlines from allocations, request missing times, and explain unsupported recurrence/reminder behavior honestly. |
| [akadverse-productivity-ai/app/tools/definitions.json](../../akadverse-productivity-ai/app/tools/definitions.json) | Add shared scheduledSlot tool fields and clearSchedule update option; retain the same tool names and validation allowlist. |
| [services/productivity-layer/assistant/tools.ts](../../services/productivity-layer/assistant/tools.ts) | Project allocated fields in task results, preserve/remove allocations on confirmed updates, and return scheduled tasks in list_schedule. |
| [src/features/productivity/assistant/AssistantPanel.tsx](../../src/features/productivity/assistant/AssistantPanel.tsx) | PIP identity, own avatar, expansion, readable history, saved-result cards, proposal allocation details, retained voice/confirm/recheck and visible refresh failures. |
| [src/features/productivity/assistant/PipAvatar.tsx](../../src/features/productivity/assistant/PipAvatar.tsx) | Create a distinct friendly inline SVG robot usable at multiple sizes; no external imagery. |
| [src/features/productivity/assistant/PipMarkdown.tsx](../../src/features/productivity/assistant/PipMarkdown.tsx) | Render GFM safely; skip HTML, reject unsafe schemes and remote images, protect external links and contain tables/code. |

## Documentation and visual artifacts

| File | Change and reason |
| --- | --- |
| [docs/productivity-layer-user-and-testing-guide.md](../../docs/productivity-layer-user-and-testing-guide.md) | Update the existing handbook for scheduled source tasks, PIP and links to current verification/UAT. |
| [docs/productivity-upgrade/README.md](../../docs/productivity-upgrade/README.md) | Entry point to audit, report, verification evidence and manual testing. |
| [docs/productivity-upgrade/audit.md](../../docs/productivity-upgrade/audit.md) | Record architecture and confirmed gaps before implementation. |
| [docs/productivity-upgrade/files.md](../../docs/productivity-upgrade/files.md) | This categorized catalog of actual changed/new files. |
| [docs/productivity-upgrade/implementation-report.md](../../docs/productivity-upgrade/implementation-report.md) | Explain final behavior, decisions, models, API data flow and limitations. |
| [docs/productivity-upgrade/manual-acceptance.md](../../docs/productivity-upgrade/manual-acceptance.md) | 49 independent sequential manual cases with steps, expected behavior, failure indicators, dependencies and priority. |
| [docs/productivity-upgrade/screenshots/pip-desktop.png](../../docs/productivity-upgrade/screenshots/pip-desktop.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/pip-mobile.png](../../docs/productivity-upgrade/screenshots/pip-mobile.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/pip-tablet.png](../../docs/productivity-upgrade/screenshots/pip-tablet.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/portal-e-learning.png](../../docs/productivity-upgrade/screenshots/portal-e-learning.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/portal-marketplace.png](../../docs/productivity-upgrade/screenshots/portal-marketplace.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/portal-productivity.png](../../docs/productivity-upgrade/screenshots/portal-productivity.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/schedule-desktop.png](../../docs/productivity-upgrade/screenshots/schedule-desktop.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/schedule-mobile.png](../../docs/productivity-upgrade/screenshots/schedule-mobile.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/screenshots/schedule-overlap.png](../../docs/productivity-upgrade/screenshots/schedule-overlap.png) | Generated isolated browser-fixture screenshot; no live student or provider success implied. |
| [docs/productivity-upgrade/verification.md](../../docs/productivity-upgrade/verification.md) | Commands, selection reasons, observed outcomes, initial failures, baseline lint findings and external verification limits. |

## Tests, verification scripts and configuration

| File | Change and reason |
| --- | --- |
| [next-env.d.ts](../../next-env.d.ts) | Updated automatically by next build to reference production-generated route and root-parameter types. |
| [package.json](../../package.json) | Register scheduling/rendering tests and explicit portal/calendar browser test commands; no new dependencies. |
| [scripts/verify-marketplace-ui.ts](../../scripts/verify-marketplace-ui.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [scripts/verify-platform-changes.cjs](../../scripts/verify-platform-changes.cjs) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [scripts/verify-portal-navigation.cjs](../../scripts/verify-portal-navigation.cjs) | New isolated hub transition browser flow, colour checks, repeat-click/cancellation checks and screenshots. |
| [scripts/verify-productivity-assistant.cjs](../../scripts/verify-productivity-assistant.cjs) | Add Markdown/security, confirmed-card, expansion, ripple, reduced-motion and three-viewport browser assertions/screenshots. |
| [scripts/verify-productivity-integration.ts](../../scripts/verify-productivity-integration.ts) | Extend existing real password-session/Next.js/localhost PostgreSQL flow with scheduled-task API/calendar assertions and no event-copy check. |
| [scripts/verify-productivity-schedule.cjs](../../scripts/verify-productivity-schedule.cjs) | New isolated real TaskForm/TaskService/calendar browser acceptance flow and overlap/responsive screenshots. |
| [scripts/verify-stewart-attachment-e2e.ts](../../scripts/verify-stewart-attachment-e2e.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [scripts/verify-stewart-capture.ts](../../scripts/verify-stewart-capture.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [scripts/verify-stewart-learning.ts](../../scripts/verify-stewart-learning.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [scripts/verify-stewart-study.ts](../../scripts/verify-stewart-study.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [tests/elearning/platform-navigation.test.tsx](../../tests/elearning/platform-navigation.test.tsx) | Assert hidden student results links and the hub return link in full/rail navigation. |
| [tests/elearning/stewart-http.test.ts](../../tests/elearning/stewart-http.test.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [tests/platform/panel.browser.tsx](../../tests/platform/panel.browser.tsx) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |
| [tests/platform/portal-runtime.browser.tsx](../../tests/platform/portal-runtime.browser.tsx) | Controlled router/session boundary for the hub browser fixture; no real identity or provider request. |
| [tests/platform/portal.browser.tsx](../../tests/platform/portal.browser.tsx) | Mount the real student hub in the isolated navigation browser fixture. |
| [tests/productivity-ai/panel.browser.tsx](../../tests/productivity-ai/panel.browser.tsx) | Exercise formatted saved replies and backend-confirmed result cards in the existing PIP browser fixture. |
| [tests/productivity-ai/persistence.db.test.ts](../../tests/productivity-ai/persistence.db.test.ts) | Add real local PIP allocation/list_schedule/confirmation-gated removal coverage. |
| [tests/productivity-ai/rendering.test.tsx](../../tests/productivity-ai/rendering.test.tsx) | Verify semantic Markdown, protected links, blocked HTML/unsafe schemes/remote images and PIP avatar identity. |
| [tests/productivity/lifecycle-client.test.ts](../../tests/productivity/lifecycle-client.test.ts) | Verify deliberate schedule invalidation and confirmed allocation merges into Today/calendar without another event or read. |
| [tests/productivity/persistence.db.test.ts](../../tests/productivity/persistence.db.test.ts) | Add real local task allocation/edit/completion/deletion and event conflict/edit/archive persistence coverage. |
| [tests/productivity/schedule.browser.tsx](../../tests/productivity/schedule.browser.tsx) | Mount the real allocation form and timetable with a local TaskService repository; no production persistence claims. |
| [tests/productivity/scheduling.test.ts](../../tests/productivity/scheduling.test.ts) | Verify source lifecycle, timezone/midnight geometry, validation, overlap lanes, task-aware conflict search and Today legacy deduplication. |
| [tests/revision-questions/learning.db.test.ts](../../tests/revision-questions/learning.db.test.ts) | Update the visible Stuart name/accessible browser selectors or fixture text; retain technical API/component identifiers. |

## Services and persistence

| File | Change and reason |
| --- | --- |
| [services/e-learning/ai-ingest/client.ts](../../services/e-learning/ai-ingest/client.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/classroom/stuwart.ts](../../services/e-learning/classroom/stuwart.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/revision-questions/learning-context.ts](../../services/e-learning/revision-questions/learning-context.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/student/stewart/attachment-store.ts](../../services/e-learning/student/stewart/attachment-store.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/student/stewart/chat.ts](../../services/e-learning/student/stewart/chat.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/student/stewart/conversations.ts](../../services/e-learning/student/stewart/conversations.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/student/stewart/explain.ts](../../services/e-learning/student/stewart/explain.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/e-learning/student/stewart/rate-limit.ts](../../services/e-learning/student/stewart/rate-limit.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [services/productivity-layer/operations.ts](../../services/productivity-layer/operations.ts) | Extend the prior event fix with source task commitments for schedule/habit replanning conflict checks. |
| [services/productivity-layer/repository.ts](../../services/productivity-layer/repository.ts) | Load scheduled source tasks alongside required linked tasks for event conflict validation; no event copy. |
| [services/productivity-layer/validation.ts](../../services/productivity-layer/validation.ts) | Parse the optional task slot through existing server-side slot validation. |
| [services/productivity-layer/views.ts](../../services/productivity-layer/views.ts) | Read owner-scoped scheduled tasks for visible calendar ranges, including timezone/overnight margins. |

## Existing backend API adapters

| File | Change and reason |
| --- | --- |
| [src/app/api/e-learning/classroom/[sessionId]/stuwart/route.ts](../../src/app/api/e-learning/classroom/[sessionId]/stuwart/route.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/api/e-learning/stewart/chat/route.ts](../../src/app/api/e-learning/stewart/chat/route.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/api/e-learning/stewart/shared.ts](../../src/app/api/e-learning/stewart/shared.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |

## Pages, navigation and Study Zone components

| File | Change and reason |
| --- | --- |
| [src/app/e-learning/_components/Sidebar.tsx](../../src/app/e-learning/_components/Sidebar.tsx) | Add the portal return link to full/mobile navigation and collapsed rail. |
| [src/app/e-learning/_components/classroom/ClassroomStuwart.tsx](../../src/app/e-learning/_components/classroom/ClassroomStuwart.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/_components/classroom/LessonEditor.tsx](../../src/app/e-learning/_components/classroom/LessonEditor.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/_components/nav-config.ts](../../src/app/e-learning/_components/nav-config.ts) | Remove student Results/GPA/CGPA/academic-history presentation; keep staff navigation and exact dashboard route. |
| [src/app/e-learning/student/academic-records/academic-history/page.tsx](../../src/app/e-learning/student/academic-records/academic-history/page.tsx) | Keep the protected route but redirect its hidden student result presentation to the dashboard; preserve backend services/models. |
| [src/app/e-learning/student/academic-records/gpa-cgpa/page.tsx](../../src/app/e-learning/student/academic-records/gpa-cgpa/page.tsx) | Keep the protected route but redirect its hidden student result presentation to the dashboard; preserve backend services/models. |
| [src/app/e-learning/student/academic-records/results/page.tsx](../../src/app/e-learning/student/academic-records/results/page.tsx) | Keep the protected route but redirect its hidden student result presentation to the dashboard; preserve backend services/models. |
| [src/app/e-learning/student/dashboard/page.tsx](../../src/app/e-learning/student/dashboard/page.tsx) | Remove the student CGPA card and its database request; keep course/registration overview. |
| [src/app/e-learning/student/study-zone/[courseId]/loading.tsx](../../src/app/e-learning/student/study-zone/[courseId]/loading.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/[courseId]/page.tsx](../../src/app/e-learning/student/study-zone/[courseId]/page.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/DocumentViewer.tsx](../../src/app/e-learning/student/study-zone/_components/DocumentViewer.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/LearningSources.tsx](../../src/app/e-learning/student/study-zone/_components/LearningSources.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/LectureBoard.tsx](../../src/app/e-learning/student/study-zone/_components/LectureBoard.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/StudyWorkspace.tsx](../../src/app/e-learning/student/study-zone/_components/StudyWorkspace.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/StuwartPanel.tsx](../../src/app/e-learning/student/study-zone/_components/StuwartPanel.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/stewart.ts](../../src/app/e-learning/student/study-zone/_components/stewart.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/_components/study-selection.ts](../../src/app/e-learning/student/study-zone/_components/study-selection.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/e-learning/student/study-zone/page.tsx](../../src/app/e-learning/student/study-zone/page.tsx) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |
| [src/app/studashboard/page.tsx](../../src/app/studashboard/page.tsx) | Replace clickable div cards with accessible buttons; track router transitions, fence repeat clicks, expose status feedback, and describe the actual productivity tools. |

## Styling and animations

| File | Change and reason |
| --- | --- |
| [src/app/globals.css](../../src/app/globals.css) | Theme-coloured portal icon pulse with reduced-motion fallback. |
| [src/features/productivity/styles.css](../../src/features/productivity/styles.css) | Semantic task/habit/event/class colours and legend; light PIP design, Markdown typography, responsive panel and two-second reduced-motion-aware ripple. |

## Productivity frontend and domain components

| File | Change and reason |
| --- | --- |
| [src/features/productivity/client.ts](../../src/features/productivity/client.ts) | Invalidate affected schedule caches after task mutations. |
| [src/features/productivity/schedule/ScheduleManager.tsx](../../src/features/productivity/schedule/ScheduleManager.tsx) | Combine task/event/class entries, display semantic legend, synchronize legacy task sources, avoid duplicates and open task details. |
| [src/features/productivity/schedule/ScheduleTimetable.tsx](../../src/features/productivity/schedule/ScheduleTimetable.tsx) | Label each activity type in card tags, tooltips and accessible names so semantic colour is not the only cue. |
| [src/features/productivity/schedule/domain.ts](../../src/features/productivity/schedule/domain.ts) | Accept optional additional task commitments in manual conflict checks and smart free-slot search. |
| [src/features/productivity/schedule/timetable.ts](../../src/features/productivity/schedule/timetable.ts) | Project allocated source tasks with stable namespaced display IDs and explicit taskId links; reuse existing interval geometry. |
| [src/features/productivity/tasks/TaskForm.tsx](../../src/features/productivity/tasks/TaskForm.tsx) | Expose allocation toggle/date/start/end fields and timezone-correct editing. |
| [src/features/productivity/tasks/TaskManager.tsx](../../src/features/productivity/tasks/TaskManager.tsx) | Show allocated working time in source details and audit history. |
| [src/features/productivity/tasks/domain.ts](../../src/features/productivity/tasks/domain.ts) | Add optional scheduledSlot validation and immutable audit snapshots, preserving deadline/outcome semantics. |
| [src/features/productivity/today/TodayView.tsx](../../src/features/productivity/today/TodayView.tsx) | Render source-task timetable rows/links and include allocations in the schedule count. |
| [src/features/productivity/today/selectors.ts](../../src/features/productivity/today/selectors.ts) | Include scheduled tasks and prevent legacy linked-event double counts or deleted source display. |
| [src/features/productivity/workspace/WorkspaceShell.tsx](../../src/features/productivity/workspace/WorkspaceShell.tsx) | Pass authenticated student name to PIP for a dynamic greeting. |
| [src/features/productivity/workspace/create-cache.ts](../../src/features/productivity/workspace/create-cache.ts) | Merge confirmed allocations into relevant Today and calendar ranges, including future deadlines. |
| [src/lib/stewart/config.ts](../../src/lib/stewart/config.ts) | Correct whole-word user-facing Stuart naming in labels, prompts, errors or comments; preserve technical contracts. |

## Pre-existing pending work retained

These files were already changed before this broader assignment and were not rewritten as unrelated work.

| File | Retained work |
| --- | --- |
| [docs/elearning/revision-signature-diagnostics.md](../../docs/elearning/revision-signature-diagnostics.md) | Earlier webhook diagnostic/deployment report; preserved. |
| [services/e-learning/revision-questions/security.ts](../../services/e-learning/revision-questions/security.ts) | Earlier microsecond UTC timestamp fix; preserved without changing HMAC rules. |
| [services/productivity-layer/academics.ts](../../services/productivity-layer/academics.ts) | Earlier display-vs-conflict timetable cache and lecturer-name suppression fix; retained by this assignment. |
| [tests/productivity/academics.test.ts](../../tests/productivity/academics.test.ts) | Earlier conflict/display cache regression; included in selected productivity coverage. |
| [tests/productivity/operations.test.ts](../../tests/productivity/operations.test.ts) | Earlier event-save regression and owner/service tests; preserved and executed. |
| [tests/revision-questions/protocol.test.ts](../../tests/revision-questions/protocol.test.ts) | Earlier microsecond timestamp tests; preserved. |
| [docs/productivity-event-save-timeout.md](../../docs/productivity-event-save-timeout.md) | Earlier concrete timeout analysis; preserved. |

## Database/API summary

No Prisma schema, generated Prisma implementation, migration, SQL index, physical foreign key, environment variable or cron definition was modified. Existing APIs retain their paths and identity boundaries. Optional `data.scheduledSlot`, additive shared tool arguments and a bounded `list_schedule.tasks` result are documented in the [implementation report](implementation-report.md).
