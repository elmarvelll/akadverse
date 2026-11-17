# Verification ledger

## Selection strategy

The selected tests cover changed domain/cache logic, owner-scoped event/task persistence, real assistant tool execution, real NextAuth/API requests, safe rendering, navigation and responsive browser behavior. Unrelated Marketplace, payment, revision-generation and provider-heavy attachment suites were not indiscriminately run. Browser fixtures are explicitly isolated component tests; they are not substitutes for the real local database and HTTP checks or proof of live provider behavior.

## Passing checks

| Command / check actually executed | Purpose and selection reason | Observed result |
| --- | --- | --- |
| `npm run test:productivity` | Existing focused productivity suite: auth/ownership, transactions, errors, task/habit lifecycle, cache races, notifications, task eligibility and new scheduling tests. | Last full selected run: **69 tests passed**. After the final Today/legacy/cache correction, the affected two files were rerun separately as described below. |
| `node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/productivity/scheduling.test.ts tests/productivity/lifecycle-client.test.ts` | Final delta: direct task lifecycle/geometry, invalid slots/DST, overlap lanes, additional conflict commitments, Today legacy deduplication, confirmed merges and stale response protection. | **19 tests passed**. This includes a sixth scheduling regression added after the 69-test run. Counts overlap with the full suite and must not be added as independent total coverage. |
| `npm run test:productivity:ai` | Existing PIP auth/delegation/tool/confirmation and shared speech unit coverage. | **24 tests passed** at that execution. The new rendering test was then added to this script and executed directly, below; do not claim an unexecuted 26-test run of the updated script. |
| `node --import tsx --experimental-test-module-mocks --test tests/productivity-ai/rendering.test.tsx` | New PIP semantic Markdown, GFM structures, external link protection, HTML/unsafe-scheme/image blocking and avatar identity. | **2 tests passed**. |
| `node --import tsx --experimental-test-module-mocks --test tests/elearning/platform-navigation.test.tsx tests/elearning/classroom-stuwart-route.test.ts tests/elearning/stewart-learning-response.test.ts` | Relevant student routing, classroom ownership boundaries and existing learning-answer rendering affected by the naming/sidebars. | **22 tests passed**. This includes the new result-visibility/return-link assertion. |
| `node --import tsx --experimental-test-module-mocks --test tests/elearning/platform-navigation.test.tsx` | Follow-up targeted check of the new student visibility/return-link assertions. | **4 tests passed**. Overlaps the previous command. |
| `node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/productivity/persistence.db.test.ts tests/productivity-ai/persistence.db.test.ts` | Real local PostgreSQL: event create/replay/edit/archive/conflicts, source task range reads, concurrency, owner FKs, habits, AI receipts, confirmation and rollback/reconciliation. | **16 tests passed**. Local-only database guards and cleanup were used. |
| `node --import tsx --experimental-test-module-mocks --test --test-name-pattern='calendar task through PIP' tests/productivity-ai/persistence.db.test.ts` | New real local PIP test: create a task allocation, retrieve it via list_schedule, preview removal and apply only through Confirm. | **1 test passed**, added after the 16-test run. No event copy created. |
| `node --import tsx --experimental-test-module-mocks --test --test-name-pattern='scheduled task allocations' tests/productivity/persistence.db.test.ts` | Focused development of the new source-task persistence/range regression. | **1 test passed** after correcting the assertion described below; subsequently covered by the 16-test command. |
| `cd akadverse-productivity-ai && .venv/bin/python -m pytest -q tests` | Shared tool schema/SDK declarations, strict validated execution loop, provider/backend failures, timeout logging, auth binding and bounded request behavior. | **48 tests passed**. No real Gemini request was made. |
| `node scripts/verify-productivity-assistant.cjs` | Real Chromium with isolated HTTP fixtures: conversation/send/draft/confirmation/cancel/account isolation, semantic Markdown safety, saved cards, expansion, ripple, reduced motion and bounds. | **17 checks passed** in the final run, including desktop/tablet/mobile bounds, asynchronous composer focus and focus return on close. |
| `node scripts/verify-productivity-schedule.cjs` | Real Chromium with the actual TaskForm, TaskService and timetable components over an in-memory source repository; geometry, overlaps, edit/move, complete/delete and responsive bounds. | **9 checks passed**; rerun after repairing the fixture's lint issue. Responsive and overlap screenshots saved. This does not claim DB persistence; the separate real-DB checks cover it. |
| `node scripts/verify-platform-changes.cjs` | Existing isolated Chromium sidebar/classroom journeys: exact dashboard routing, full/rail/mobile navigation, classroom assistant/history/error behavior and reduced motion. | **9 checks passed**. Visible selectors now use Stuart; technical /stuwart path remains. |
| `node scripts/verify-portal-navigation.cjs` | Actual portal component with controlled router/session boundaries: three card colours, React transition state, same-frame repeat prevention, cancellation recovery and reduced motion. | **8 checks passed**. This is not a production network-navigation latency benchmark. |
| `npm run test:productivity:http` | Starts a real production-mode Next.js server against local databases; uses ordinary password sessions, not a fabricated authenticated UI. Exercises actual protected routes, source-task allocation/calendar APIs, event persistence, ownership, receipt replay, timezones, logout and fresh-session reload. | **Passed**. Existing Productivity/E-Learning/Marketplace routes returned successfully. Source-task calendar assertion passed without an event copy. Temporary local accounts/server were cleaned up. |
| `npm run typecheck` | Installed Next.js route generation plus project TypeScript compilation, including the added test fixtures. | **Passed** after the new test result unions were narrowed correctly. |
| `npm run build` | Normal Core + E-Learning Prisma generation and optimized Next.js 16.3.3 integration build. | **Passed** during integration. A final build of the frozen tree is recorded below. No migration/reset was run. |
| `node --check scripts/verify-productivity-assistant.cjs`, `node --check scripts/verify-productivity-schedule.cjs`, `node --check scripts/verify-portal-navigation.cjs` | Syntax checks for browser verification scripts before launching their isolated fixtures. | **Passed**. |
| `git diff --check` | Detect accidental patch whitespace/errors. | **Passed** after removing newly introduced documentation trailing whitespace. |

## Lint, including the repository-wide failure

`npm run lint` was executed. Its recorded result was **3 errors and 14 warnings**. The errors are:

1. `tests/marketplace/browser/panel.tsx:13:45` — `react-hooks/immutability`.
2. `tests/platform/panel.browser.tsx:23:149` — `react-hooks/refs` (two diagnostics).

Both affected files were checked from committed `HEAD` using `git show HEAD:<path> | npx eslint --stdin --stdin-filename <path>`. The same three errors reproduced without this assignment's code. The Marketplace file is untouched; the platform fixture only changes its visible Stuart text, not the flagged ref expression. Unrelated infrastructure was not rewritten merely to silence lint.

A newly unused GraduationCap import caused by the student menu removal was removed. The new calendar fixture initially used refs during render and was repaired to keep render data in React state with a separate repository closure; no rule suppression was added.

A programmatic ESLint CLI invocation over **77 changed JS/TS source/test files** then completed with **0 errors and 2 pre-existing unused-variable warnings** in `scripts/verify-platform-changes.cjs`. It excluded the known baseline `tests/platform/panel.browser.tsx` errors and generated `next-env.d.ts`; those exclusions are disclosed, not reported as a clean full-repository run. The last eight-file source/test delta for Today/cache/task-ID metadata and the final PIP/calendar accessibility delta were linted separately with **no diagnostics**.

## Initial failures and what happened

- **Cache expectation:** the first selected productivity run had 62 passes / 1 failure. Its old assertion expected a task completion to leave the Schedule cache valid. The new required behavior invalidates that view, so the test was corrected to expect the necessary fresh read. Later full runs passed 68 and then 69 tests as new scheduling coverage was added.
- **Local DB sandbox:** the first persistence attempt could not reach localhost from the restricted execution context. Docker's local healthy database was verified through the normal approval path, and the test ran against the existing local-only database. No remote database fallback was used.
- **Range assertion:** an initial DB assertion incorrectly required a moved task to disappear from the entire preloaded snapshot. The server intentionally preloads a wider date margin for timezone/overnight display. The assertion now checks that the task leaves the displayed day through the calendar selector; persistence/range tests subsequently passed.
- **Test TypeScript:** the new PIP DB test initially accessed a union's result without narrowing. Explicit result-presence assertions fixed the type error; its runtime DB test and final typecheck passed.
- **Fixture lint:** new calendar fixture ref usage was corrected, and the affected browser check was rerun successfully. The unrelated committed baseline errors remain reported above.
- **Temporary approval-review interruption:** one proposed portal-test command was not executed because approval review hit an account usage limit. After the user asked to continue, the normal approval retry succeeded. No approval bypass was used, and the portal browser test passed.
- **Documentation whitespace:** one modified Markdown line retained a trailing hard-break space sequence; the new line was cleaned and diff checks passed.

## What has not been verified or claimed

- No new deployment of the broader portal/calendar/PIP upgrade.
- No live Gemini generation or live AssemblyAI microphone/transcription test.
- No production database migration, reset, secret/environment change or test records.
- No successful event save for the originally affected production student; session-pool exhaustion can still require infrastructure remediation.
- No every-N-day habit recurrence, delivered reminders, simulated streaming or ordinary personal-event completion feature.
- No full provider-heavy attachment, payment, or unrelated repository test run.
- No production load benchmark or claim that the new JSON range lookup has a dedicated physical index.

## Visual artifacts

All images are isolated local browser component fixtures and contain fake test labels, not real students:

- PIP: [desktop](screenshots/pip-desktop.png), [tablet](screenshots/pip-tablet.png), [mobile](screenshots/pip-mobile.png).
- Schedule: [overlapping activities](screenshots/schedule-overlap.png), [desktop](screenshots/schedule-desktop.png), [mobile](screenshots/schedule-mobile.png).
- Portal transitions: [Marketplace](screenshots/portal-marketplace.png), [E-Learning](screenshots/portal-e-learning.png), [Productivity](screenshots/portal-productivity.png).

The PIP, overlapping schedule and portal loading screenshots were visually inspected; automated browser assertions verify the listed geometry and viewport checks. They should be supplemented by the [manual acceptance guide](manual-acceptance.md) in the running app.

## Final frozen-tree build

**Passed.** The final `npm run build` after the PIP focus and calendar type-label changes completed successfully, including Prisma generation, Next.js compilation/type validation and route output. This is the final application source verification, not a deployment claim.
