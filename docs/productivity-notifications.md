# Productivity save notifications

The checkout has no host toast library or shared toast component. The old Productivity
success messages were persistent section state, sometimes rendered again inside a
dialog. Following approval to consolidate these banners, all Productivity mutations
now use one shared notification store and renderer, reusing the existing notice,
success and error styles. Other Akadverse modules are unaffected.

- `notifications.ts`: one pending → confirmed success/error lifecycle per save.
  Success expires after 5 seconds; hover and keyboard focus independently pause its
  remaining time. Errors have no timer. Explicit retries of the same failed action
  replace its notification, and identical simultaneous saves share the pending promise.
- `client.ts`: wraps user mutations at the RPC boundary; reads and automatic occurrence
  synchronization do not create save notifications. Existing request timeouts, safe
  messages, account checks and request-ID duplicate safeguards remain in place.
- `SaveNotifications.tsx`, `WorkspaceShell.tsx`, and shared `schedule/Forms.tsx`: keep
  the renderer mounted across section changes and portal it into an open native dialog
  so its announcements and close button remain accessible. It occupies normal document
  flow and does not cover page controls. Account changes clear timers and notifications.
- Task, habit, schedule and account settings components no longer retain duplicate
  success banners. Form validation and actionable refresh failures remain in context.
  Saving timezone no longer reloads the page immediately; existing cache invalidation
  updates the workspace and lets the confirmed notification finish its lifecycle.

No automatic Retry button is added to errors: retry through the original action or
form so existing validation, conflict confirmation and idempotency logic are retained.
Closing a pending notification does not cancel its save or resurrect it on completion.

## Verification

- `npm run test:productivity` includes deterministic notification lifecycle tests.
- `npm run test:productivity:notifications:browser` runs an isolated Edge/React fixture
  without application login or database access. It checks pending duration, success
  dismissal despite rerender, actual mouse hover, keyboard focus, manual close,
  persistent errors, explicit retry replacement and native modal keyboard access.
  It writes its report under ignored `.local-development/`.
- Complete Productivity unit suite: 51 passing tests. TypeScript and targeted
  ESLint passed. The browser fixture passed all eight checks.

These checks simulate persistence success/failure. They do not prove availability of
the shared live database, and no live database writes or deployment were performed.
