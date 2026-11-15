# Productivity shared loading lifecycle

Implemented in the active `productivity-layer-staging` checkout. Existing account-loading fixes are retained. No deployment, push, schema change, database URL change, dependency addition or host styling change was made.

## Why sections reloaded

Workspace preparation depended on the selected section and reran account lookup and recurrence initialization on every switch. Sections unmounted, discarded their data, and independently loaded overlapping datasets. The client deduplicated pending reads but retained no completed shared view data. Initial calendar timezone/month effects repeated initialization. Core and analytics code were imported together.

A further actual write trigger was found: habit event slots were compared with JSON.stringify. PostgreSQL JSONB can return keys in a different order, causing unchanged slots to append an edit on later reads. Slots now compare date, start, end and timezone values. The database regression test asserts that repeated initialization leaves stored task/event JSON and audit history unchanged.

## New lifecycle

AccountWorkspace owns the in-memory user cache above section selection. One `workspace.initial` request authenticates once and prepares shared preferences, categories, habit definitions, Today data, current habit month/consistency inputs, initial calendar week, task tab counts and the first 100 records of all four task tabs. Overlapping records are shared; page membership uses IDs. Generation covers only the current month plus the visible week. New projections and changed existing projections use bounded batch SQL inside the existing owner lock, rather than one network round trip per instance.

One subsequent `official.range` request prepares the initial academic date range and serves the overlapping Today widget. It reuses a request-local timetable source and deduplicates pending/ready overlapping ranges. It holds no Core account transaction while calling the academic database. Normal preparation has one data request in flight at a time.

Core component code belongs to the route bundle; analytics remains lazy. Only selected or previously visited views mount. Visited views retain tabs, filters, dates and state; internal navigation saves/restores scroll where practical. Hidden views pause polling, subscriptions and dialogs. Shell identity comes from the shared response rather than another account request. Today is the default; explicit section/item links remain supported.

Additional months/weeks, changed filters/sorts and history pages load on demand. All task tabs and schedule history use pages of 100. Full analytics loads only when explicitly opened. Today caps its task listing at 100 while showing authoritative aggregate totals and linking to the paginated list.

Freshness is 60 seconds, anchored to the server snapshot time so reading a cached value cannot extend freshness forever. Usable stale content stays visible during refresh. Active views update their clock at minute boundaries; task/Today deadline counts revalidate, while calendar views use normal expiry. Focus/reconnect can refresh. Local-date/timezone keys handle midnight; timezone preference changes immediately update the shared identity. A failed view pauses automatic retry and exposes a local retry. Partial task-history or academic failures do not blank usable sections.

Mutations invalidate affected section tags. In-flight invalidated responses cannot overwrite newer data. Logout/account changes clear cached data and pending state; account epochs reject old responses. The database remains authoritative. Existing NextAuth, current server-side student/ownership checks, explicit outcomes, recurrence identity, owner transaction locking and write retry receipts remain intact. No localStorage authentication or persistence was added.

## Measurements

Local Windows/Edge production build, simulated 150ms network latency, ordinary password session, local PostgreSQL, synthetic fixture with 60 completed tasks, 10 open tasks and two daily habits. These are single-run observations including browser-driver overhead, not live-site guarantees. Data requests mean `/api/productivity`; asset counts are tracked separately.

| Measurement | Before | After |
| --- | ---: | ---: |
| Shell visible | 909ms | 213ms |
| First usable view | 1474ms, Schedule | 1157ms, Today |
| Shared initial preparation | No shared phase | 1315ms |
| Initial API requests | 15 | 2 |
| Section click to content | 559-1125ms | 16-41ms |
| API requests across comparable entry/five switches | 60 | 2 |
| Prepared switches: API / JS / CSS requests | Repeated API reads | 0 / 0 / 0 |
| First task-tab pages | Fetched on section initialization | All four ready, no tab requests |
| Peak initial data-request concurrency | Not recorded | 1 |

See before.json and after.json for per-section timings, operation names and payload sizes. The final normal initial payload is 202186 bytes and uses 19 Core SQL statements. Initial payload is larger because it now prepares all default views and task pages; the old initial payload only prepared Schedule. Across the old five-switch journey, payload was 874285 bytes and 759 Core SQL statements. Canonical task records still include their audit data, so very long individual audit trails can increase payload size.

A second browser fixture with 600 completed and 260 open tasks plus two habits also passed: preparation 1320ms, two initial requests, zero switch requests, and on-demand additional historical pages. The database suite separately exercises 760 ordinary tasks across all four statuses, date ranges, timezone reconciliation and concurrent month initialization.

Benchmark caveat: the original baseline helper constructed its academic URL incorrectly and its timetable calls failed. The final helper uses URL.pathname and explicitly asserts that academic preparation has no failed dates. The Core datasets and simulated network are comparable; this is not a controlled before/after benchmark of academic-provider latency. The final fixture has no registered courses, so successful empty academic data is expected; registered-course scope is covered by existing academic adapter tests.

The benchmark waits, outside measured time, if setup would place the short navigation journey across a minute refresh boundary. Deadline/midnight behavior is checked separately. Aborted requests from deliberate full reloads are cleared from browser-driver tracking; they are not classified as application request loops.

## Validation

Passed: 43 Productivity unit tests; two real local PostgreSQL persistence tests; TypeScript/build checks; ESLint; production browser journey; real production HTTP authentication/persistence/logout checks. Browser acceptance covers the four-section sequence twice, all prepared task tabs, early navigation during preparation, injected task-history preparation failure with other sections usable, another month and return to its cache, extra historical records in the larger fixture, real form save reflected in Today, rapid switching and logout protection. Unit tests cover midnight, cache expiry, mutation races, initial-load races and account switching. No real shared account fixture or benchmark records were created.

The full repository run passed 265 of 267 tests, with two failures in existing email-outbox tests. A separate worker recheck also exposed existing AI-ingest/email worker failures. Those unrelated features were left unchanged; the whole repository suite is not claimed clean.

The earlier shared-database latency remains an infrastructure limitation; these measurements use localhost. Large mutation/full analytics transactions still use the existing domain path. This change does not prove that the live provider's latency or capacity is fixed. Existing development server/database processes remain available; temporary benchmark servers/browsers and fixture users are cleaned up.

## Run and reproduce

Reload the existing Productivity Layer once, wait for `Workspace ready`, then switch Today -> To-do List -> Schedule Manager -> Habit Tracker -> Today and repeat. Switching before preparation finishes remains supported. A failed part exposes a localized retry.

```
npm run typecheck
npm run test:productivity
npm run test:productivity:db
npm run build
npm run test:productivity:http
npm run test:productivity:performance -- lifecycle-final
```

The performance script needs Windows Edge and local schemas on 127.0.0.1:5433. It forces test connections to localhost and keeps diagnostics under ignored `.local-development`. Set `PERF_COMPLETED_TASKS=600` and `PERF_OPEN_TASKS=260` for the larger scenario. It does not edit environment files or deploy.