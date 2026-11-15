# Saved Schedule events update Today

The reported reference beginning `94b448d7` is logged as Prisma `P1001` in `auth.user`: the existing user lookup could not reach the configured shared database after 5008 ms. Session decoding took 3 ms. The active client's environment matched its cached connection configuration. This is a real database-connectivity failure, not an account-creation problem.

The stale Today display had a separate cause: schedule mutations invalidated Today but did not apply their confirmed Dataset response. An inactive Today component retained its older snapshot and could remain paused after a failed refresh. Showing the saved event therefore depended on another database request.

The client now applies server-confirmed schedule results to existing owner-scoped Today and Schedule cache entries before notifying subscribers. Entries are replaced, so older pending responses cannot overwrite the acknowledgement. Other cached task/habit data and its original freshness are retained. Today reads the changed shared snapshot when reactivated, including when it was previously paused. Create/edit/move/archive results are reflected immediately; foreign-owner records are filtered out. No optimistic event is shown before the server confirms the save.

The wall-clock minute timer now updates the display clock and requests data only for a real midnight/deadline transition. Normal background freshness checks begin 60 seconds after the section effect starts, preventing an unnecessary startup read merely because the page opened just before the next minute. Hidden sections pause both timers. No authentication check, database URL, connection limit or timeout was changed.

Changed implementation: client.ts, read-cache.ts, workspace/queries.tsx and new workspace/schedule-cache.ts. Regression coverage is in lifecycle-client.test.ts; the production browser verification is in scripts/measure-productivity.cjs.

Validation: 45 Productivity unit tests passed, including confirmed event create/edit/move/archive and a stale Today response racing a successful save. TypeScript, targeted ESLint and production build passed. The real browser test created a category/event through Schedule's forms, switched the browser offline after the successful save, then displayed the event in Today with zero follow-up requests (`savedEventUpdatesTodayWithoutRefetch: true`). This used temporary localhost-only fixture accounts; no shared test account or environment-file changes were made.

The intermittent shared database P1001 is not claimed fixed. A later background read can still fail if the provider/network is unavailable; cached content remains visible and refresh retries remain controlled. Reload the Productivity page once to load the client fix.