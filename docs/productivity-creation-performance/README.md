# Creation latency investigation

Measured on Windows using the integrated application, a temporary ordinary student,
local Core and eLearning databases and the same 640-task history fixture. Browser
measurements use a Next production build, real credentials/session/route checks and
Edge with 150 ms simulated network latency. All temporary users and benchmark servers
are cleaned up; existing user servers and environment files are unchanged.

## Confirmed costs and measurements

| Operation | Local server before → after | Core SQL statements before → after | Browser dialog close before → after (two runs) |
| --- | --- | --- | --- |
| Task create | 36 → 5 ms | 13 → 9 | 191 → 191–234 ms |
| Event create | 82 → 62 ms | 13 → 11 | 237 → 187–234 ms |
| Habit create | 41 → 10 ms | 17 → 13 | 383 → 191–192 ms |

These are sampled timings, not statistical percentiles. Task click-to-close did not
demonstrably improve; event UI gains varied. The clear UI improvement is habit creation:
its original response completed in 166 ms but the dialog waited another 215 ms for
a month-view request. Afterward the dialog closed 12–27 ms after the response while
the 185–194 ms month preparation continued in the background. The saved item appeared
within 0–1 ms of dialog-close detection. Client validation/dispatch-to-request was
approximately 2–4 ms, including CDP dispatch overhead, rather than the main bottleneck.

The direct server-phase harness uses the real shared Prisma/database and domain code
but a test-injected NextAuth session. Its database user lookup took around 1 ms; the
browser harness independently verifies the real session. Transaction totals before
were 35/81/40 ms for task/event/habit. Before each create loaded all task/history,
habit, category and event records, and validation/cloning traversed that graph.
Those dataset reads took about 12–13 ms even on local Postgres. Engine-reported SQL
totals were 10/4/7 ms before and 0/1/1 ms after (integer rounding). These timings are
not additive: transaction and phase timings overlap, and queries submitted together
on one interactive transaction share a connection.

The final phase-only repeat also records response serialization separately; all three
responses rounded to 0 ms in that fixture. It includes a dedicated academic-conflict
phase for events and recurrence phase for habits. See `server-after-final.json` rather
than treating those phases as a second database connection measurement.

There was no evidence that analytics calculation blocked these create commands.
New habit creation already requested today's range, but its reconciliation also
scanned and potentially processed every existing habit's generated future records.

## Targeted changes

- `repository.ts`: task and new-habit creates start with an empty, owner-derived
  graph rather than reading unrelated history. A personal event create still reads
  its calendar/categories for complete conflict checks, plus only task/habit sources
  needed to preserve existing calendar relationships. Edits, outcomes and imports
  retain their established graph loading and reconciliation.
- `operations.ts`: preserve the existing session check, database role recheck, user
  lock, atomic transaction, graph validation, ownership constraints and idempotency
  receipt. A new habit saves its recurring definition and at most today's required
  task/event projection. The response includes the durable definition and today's
  saved occurrence identifiers. Later visible date ranges still generate recurrence.
- `workspace/create-cache.ts` and `client.ts`: merge confirmed task/habit creates into
  ready per-account views and update known counts. Pending/failed saves never seed
  records; existing cache epochs still reject old-account responses. Event creation
  keeps the existing confirmed schedule cache merge. Ordinary task creation no longer
  needs the immediate second workspace request in the measured flow.
- `HabitTracker.tsx`: do not await month refresh before allowing HabitForm to close.
  Month generation runs as one affected-view background refresh; its failure says the
  habit was saved and offers loading recovery rather than another create.
- Forms retain values on failure and prevent same-turn duplicate submission.
  Existing notification pending/success/error handling and request-ID reconciliation
  remain unchanged. A lost response is retried with its original operation ID.
- Development-only diagnostics add numeric client network/cache/form timings and
  server dataset/domain/recurrence/academic/receipt phases. No private record contents,
  credentials, queries or connection strings are logged by the new diagnostics.

## Database connectivity is a separate remaining limitation

Two read-only checks used `@next/env`'s development loading order and explicitly passed
the resolved `DATABASE_URL` to Prisma. The configured remote transaction pooler on
port 6543 responded to `SELECT 1` in **3756 ms cold / 1320 ms warm**. Neither returned
P1001. This confirms significant delay even for a minimal query, independent of graph
generation and UI rendering. These samples cannot distinguish network latency from
provider queueing/capacity. No remote create was benchmarked, so local improvements
must not be represented as measured live-site improvements.

The existing development logs still classify a recurrence of P1001 as "Cannot reach
the configured database endpoint" and include its failed phase/reference without raw
connection details. Provider/network investigation remains necessary if remote latency
or P1001 persists. No connection parameters, pool sizes or timeouts were changed.

## Validation and reproduction

- Browser: task, event and habit each persisted once, survived reload, kept input and
  the dialog open on network failure, replaced the pending toast with error, and
  persisted exactly once after an explicit rapid double-submit retry.
- Unit tests cover confirmed-only cache updates with no blocking extra read; existing
  tests cover timeouts, lost-response receipt reuse, ownership, edits and completion.
- Three localhost persistence tests cover bounded new-habit generation, unchanged
  existing occurrence history, event/task/habit receipt replay and fresh-request reads.
- 60 Productivity unit tests, all 3 persistence tests, TypeScript and targeted ESLint
  passed. Next production compilation passed. `npm run build` initially hit Windows'
  locked Prisma engine DLL; `next build` succeeded with the already-generated clients,
  without stopping the user's server or regenerating schemas.

Run `node --import tsx --experimental-test-module-mocks scripts/measure-productivity-save-phases.ts label`
for sanitized local server phases. Run a current production build, then
`node --import tsx scripts/measure-productivity-creates.cjs label` for the local browser
check (Windows Edge). Set `PERF_COMPLETED_TASKS=600` and `PERF_OPEN_TASKS=40` to reproduce
the recorded browser fixture; both scripts enforce local databases for writes.
The browser script starts only an isolated localhost server and does not deploy.
Raw temporary logs/reports stay in ignored `.local-development/`; the curated
JSON files here contain only numeric timings and verification flags.
