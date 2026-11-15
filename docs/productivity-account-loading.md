# Account-loading failure: diagnosis and focused fix

These changes are in the active `productivity-layer-staging` checkout, not the separate performance worktree. No environment values, database schema, pool sizes, timeouts, authentication configuration or account model were changed. No deployment or push was performed.

## Original reference and underlying exception

The stored log for `6184921f-462e-4131-a1e4-f1513173b506` contains only `action: load your workspace account` and `code: DATABASE_TIMEOUT`. The previous logger discarded the Prisma exception; its exact original code cannot be recovered from that historical entry.

Development-only phase logging reproduced the account failure as `P2028`, with the allowlisted sanitized message `Transaction API error.`, under reference `0a559b4a-c7d3-4b7c-93e0-219da5cae1e2`. That account request lasted 36.232 seconds overall: 5.899 seconds in the user lookup, 25.292 seconds waiting on the User-row lock, and 30.262 seconds in the transaction before failure at completion. Related concurrent synchronization requests also produced `P2028`, including the sanitized reason `The interactive transaction expired or was already closed.` The old public timeout message combined P1008 (operation timeout), P2024 (pool acquisition timeout) and P2028 (transaction API failure), so the displayed sentence alone could not identify the cause.

The exact text originates in `services/productivity-layer/errors.ts`; `src/features/productivity/errors.ts` labels operation `context` as loading the workspace account; the RPC client combines these into the displayed message. The route generates the reference ID. New development logs retain that same ID across operation, phases and sanitized failure metadata. Raw Prisma messages, query parameters, account IDs, names, emails and URLs are not logged.

## What account resolution actually does

There is one existing host identity: NextAuth's signed session contains the Akadverse `User.id`. `requireProductivityUser` reads that User by primary key and enforces its current student role and the request's expected account ID on every operation. No separate Productivity account is created or synchronized. Ordinary existing JWT session checks do not upsert accounts. Development sessions have their existing additional checks; they were not changed.

Before the fix, even `context` then acquired the mutation transaction, locked the User row with FOR UPDATE, rechecked role, loaded preferences, loaded every task/habit/category/event dataset, cloned and validated the graph and committed. Context itself created or updated no records. Other initial reads and recurrence generation competed for the same owner lock. Official timetable reads held that Core lock while querying the separate academic database. This was unnecessary for pure reads.

## Measurements from the configured shared database

Read-only probes used the same development environment loading rules and existing Prisma engine. A representative existing student was read; no fixture was created in the shared database and no credentials or personal data were printed. Actual authenticated-request phase logs also show `environmentMatchesCachedClient: true`.

| Measurement | Observed duration |
| --- | ---: |
| Cold SELECT 1 | 6653 ms |
| Warm SELECT 1 | 1748 ms |
| Representative User read | 1997 ms |
| Same primary-key lookup shape as account resolution | 1308 ms |
| EXPLAIN ANALYZE of that lookup, wall time | 1974 ms |
| Lookup execution inside PostgreSQL | 0.044 ms |
| Planning inside PostgreSQL | 0.079 ms |
| One read-only transaction acquisition | 979 ms |
| That read-only transaction including SELECT 1 | 1955 ms |

The plan was a small sequential scan; execution was already negligible. There is no evidence to justify adding an index. The large difference between server execution and wall time places substantial delay outside SQL execution, but these probes cannot separate local network latency from Supavisor queueing/capacity. A successful isolated query did not establish that concurrent application requests were healthy.

Authenticated logs before the fix show session resolution around 13-99 ms in sampled requests, user lookup usually 1-2 seconds (up to 6.7 seconds under contention), User-row lock waits of 4.1-25.1 seconds (up to 29.2 seconds for synchronization), and repeated full-dataset loading. Four Promise.all queries inside one interactive transaction share its connection; their recorded elapsed phases overlap and must not be summed as four independent execution times. Response construction and unchanged graph validation/save took approximately 0-1 ms in those samples. No transport backoff/retry delay was present.

| Account context requests | Observed duration |
| --- | ---: |
| Before, ordinary sampled requests | 7.0-11.0 seconds |
| Before, later contention samples | 27.5-43.3 seconds, with other requests failing |
| After, initial samples | 3139, 3643, 3758, 3763, 3823 ms; all successful |
| After, latest five samples | 2734, 2740, 2723, 1943, 5073 ms; all successful |

Afterward each traced account response contains only session resolution, authenticated User lookup, preference lookup and response preparation: no interactive transaction, user-row lock, recurrence generation or full-dataset loads. These are observations of the running development app, not guarantees for every subsequent request. They do not establish that all screens or provider latency are fixed.

## Configuration verified

Prisma Client and CLI are 6.19.3, using the native Prisma query engine (`prisma-client-js`), no JavaScript driver adapter. The existing shared singleton is retained across development reloads.

- `DATABASE_URL`: shared Supabase transaction pooler, port 6543, `pgbouncer=true`, `connection_limit=10`, `pool_timeout=20`. Runtime account and Productivity persistence use this connection. SSL mode is not explicitly specified in that URL; queries successfully connect, and no SSL rejection was reproduced. Do not infer that the successful connection proves any particular client TLS mode.
- `DIRECT_URL`: the shared pooler host on port 5432 with `sslmode=require`. Despite the variable's name, this host/port is Supavisor session mode, not a literal direct database host. It is the schema's migration/directUrl setting; the application singleton uses DATABASE_URL.
- `ELEARNING_DATABASE_URL` and `ELEARNING_DIRECT_URL`: local PostgreSQL on 127.0.0.1:5433. This server was stopped during the incident. Timetable failures are a separate dependency failure and must not lock the Core User row.
- `.env.local` overrides the base `.env` for this dev checkout. Secret values were not printed or changed.

The configured 6543/pgbouncer and pooler 5432/session modes are consistent with [Supabase's connection-mode documentation](https://supabase.com/docs/guides/database/connecting-to-postgres) and [Prisma pooler guidance](https://docs.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer). The broad P2028 classification is documented in [Prisma's error reference](https://docs.prisma.io/docs/orm/reference/error-reference). Pooler compatibility does not prove healthy connectivity/capacity; no parameters were tuned speculatively.

## Repetition and changes

There was no recursive HTTP retry or full-state autosave after hydration. The RPC client throws failed/non-JSON/incomplete responses, including malformed HTTP 200 results. Multiple components independently request context. Workspace initialization runs on section changes. Shell and sections refresh on focus/visibility and some on a minute timer. Development Strict Mode exposes additional initial effect calls. Habit Tracker's initial normalized month/week state can rerun its load effect once; Schedule's initial timezone resolution can rerun its range load. These are distinct triggers and finite repeated initialization, not evidence that every POST is a write or that a failed response immediately retries itself forever.

Focused changes:

- `operations.ts`: account metadata and ordinary pure reads now use authenticated owner-scoped queries without mutation transactions, full graph initialization or writes. Timetable calls no longer hold Core's mutation lock while awaiting the academic database. Existing parsers/return types remain. Actual mutations and full analytics retain the existing domain transaction.
- `auth.ts`, `repository.ts`, new `diagnostics.ts`, and API `route.ts`: development-only per-request phase timing, original Prisma code and allowlisted sanitized reasons. Production does not emit the detailed trace. Operation names are allowlisted; arguments and raw exceptions are omitted. Context timeout guidance explicitly says the account read created or changed no account.
- Client `client.ts`: in-flight deduplication for identical pure reads within the same account epoch. Initialization/synchronization is excluded because it can write. Failures settle and are removed from the pending map; a later explicit call can retry. Account changes clear the map and still reject old responses. There is no new caching library or persistent user cache.
- `WorkspaceShell.tsx`: a failed background account refresh pauses its own automatic network retries and presents `Retry account`. Other sections' existing scheduled refresh behavior remains; this does not claim to replace the earlier performance work.
- Productivity unit tests and transactional test double cover zero account initialization, pure reads avoiding mutation locks, account ownership, deduplication, failed-read settlement/controlled retry, sanitized diagnostics and read-specific guidance.

For writes, the existing request identifier, owner-scoped receipt and User lock remain in the same atomic transaction as the domain updates. A retry with the same identifier returns a committed receipt or safely performs the rolled-back action. The client retains that identifier after uncertain timeouts. No shared write was replayed to diagnose this account-read error. Recurrence initialization uses its existing deterministic occurrence IDs and uniqueness constraints rather than an account-creation workaround.

## Verification and remaining work

Passed 32 Productivity unit tests, TypeScript check, ESLint on changed sources/tests, production Next build, local PostgreSQL persistence test, and real production HTTP integration checks with temporary LOCAL fixture accounts. The latter verifies normal password authentication, protected routes, cross-user ownership, durable writes/reload, shared habit outcomes and logout. Fixture accounts are cleaned up. No live/shared test account was created.

The existing portable local PostgreSQL was started for regression checks and is also the configured academic dependency. It is left running so that dependency remains available. Core authentication still uses the shared database. No environment values or provider settings were changed.

Account context success is verified in the running app. A fresh authenticated end-to-end browser load after the final changes was not automated against the shared account; Ctrl+Shift+R clears old in-flight errors. Subsequent authenticated application logs after the final fix show successful settled requests: habits.synchronize 7546 ms, habits.list 2863 ms, schedule.load 3456 ms, eight official.classes calls 2015-2888 ms, and a later context read 1746 ms. This verifies more than just an HTTP 200 status: account reads have no initialization phase, pure reads have no transaction phase, and recurrence retains its explicit mutation transaction. Earlier recurrence requests also timed out while waiting on the same lock. Pure-read removal reduces that contention, but any continuing recurrence failure must be checked against its new `recurrence.generate` and transaction phases before changing generation behavior. Full-dataset analytics/large mutation costs are outside this focused fix.

Remaining infrastructure action: check Supabase availability, database lock/pool wait and resource metrics, project region versus the local client, and local network/VPN routing. Successful minimal reads still take around 1-2 seconds warm; account reads still vary (approximately 1.9-5.1 seconds in the latest five samples) because they require two authenticated database round trips. Provider queuing versus network transit cannot be established from the available probes. Check project SSL enforcement before any intentional SSL-setting change. Do not increase pool size/timeouts as a substitute for those measurements.

The original historical exception is unrecoverable beyond its public classification; the P2028 reproduction and measured lock amplification are confirmed. This is not a claim that a source change repaired the provider or eliminated every remaining Productivity loading delay.