# Productivity Layer integration

AkadVerse is the host. The student dashboard's existing Productivity Layer card
opens `/studashboard/productivity-layer`. The working standalone implementation
was adapted into `src/features/productivity`; the Figma reference is not imported.
The original `schedule-manager` app remains available for exporting local data.

## Identity and access

The page and every `/api/productivity` operation resolve the existing NextAuth
session (`getServerSession(authOptions)`) and the authoritative Core `User.id`.
The database user must still exist and have the student role. This matches the
host's student-only Productivity workspace; faculty has no Productivity card.
There is no second login, user table, session, or client-selected ownership scope.

Personal productivity records have no institution-wide sharing scope. Every
repository read uses the session user's ownerId. Existing-record operations look
only in that scoped dataset. Composite foreign keys also require matching owners
for categories, habits, occurrences and linked tasks. Unavailable IDs receive a
generic 404; failures never return another user's record contents.

The API accepts a fixed allowlist of operations, validates server-side, rejects
cross-origin JSON mutations, and uses private/no-store responses. It does not
accept dataset replacement, browser-generated occurrences, outcome timestamps,
or arbitrary task/habit linkage. The expected-account header detects session
changes; it is not proof of authentication. The existing host proxy and providers
remain in use. Account changes/logouts remove the entire feature subtree, clear
retry identifiers, and reject old in-flight responses. No domain data is cached in
localStorage by the integrated app.

## Data inventory and Prisma mapping

The Core PostgreSQL schema/client are reused. The existing Task/Schedule tables
represent the host's older timed-work prototype and cannot safely represent the
feature's explicit outcomes and revision history. They and their records remain
unchanged; no ownership or legacy outcome conversion is guessed.

The domain snapshot in each `data` JSONB field is authoritative. Indexed scalar
columns are projections maintained by the same server transaction, never separate
client writes. Reads validate snapshots with the existing parsers. Analytics are
derived from saved records; there are no persisted analytics counters.

| Working entity/fields | Storage | Ownership/integrity |
| --- | --- | --- |
| Task title, description, priority, optional dueDate/dueTime; pending/completed/missed, completedAt/missedAt; createdAt/updatedAt, deletedAt; history snapshots and outcomeChanges | `ProductivityTask.data`; indexed dueDate/outcome/deletedAt and row timestamps | User FK; tombstone deletion; title 1–200, description ≤10,000, valid local date/time; no automatic missed outcome |
| Task habit source IDs, original scheduled date, habitSettings, habitWithdrawn | Task snapshot plus occurrenceId FK | One task projection per occurrence; related owner must match; ordinary task endpoints cannot edit habit settings |
| Event title/description, slot date/start/end/timezone, originalSlot, priority, focus/mustComplete, optional backup, archive/outcome timestamps, history/corrections, source | `ProductivityEvent.data`; indexed scheduledDate/outcome/archivedAt; categoryId/linkedTaskId/occurrenceId relations | User FK and composite related-owner FKs; explicit clash confirmation; backup duration preserved; no ordinary event hard deletion |
| Habit name/description, task/event type, daily/weekdays, weekdays, priority, start/end dates, optional task deadline or event times, archive/effective date and all revisions | `ProductivityHabit.data`; timezone and settings retained in snapshot; createdDate indexed | User FK; retained revisions and occurrence settings protect historical results; archive withdraws future unrecorded projections |
| Stable habit/original-local-date occurrence identity | `ProductivityOccurrence(habitId, originalDate)` unique | Composite habit-owner FK; no duplicate parent occurrence; no duplicate outcome on the parent |
| Category/subcategory name, description, academic flag and timestamps | `ProductivityCategory.data`, normalizedName | User FK; unique case-normalized name per user |
| Configured user timezone | `ProductivityPreferences.timezone` | One row per existing User; valid IANA timezone; default Africa/Lagos matches the standalone default |
| Retry/import receipt and result | `ProductivityRequest(ownerId, key)` | User/key unique; request hash prevents reuse for different input; committed with domain writes |
| Official class identity, lecturer, venue, timetable times, registration scope | Live adapter over existing E-Learning services/tables | Approved courses for the authenticated user and current session/semester; approved timetable entries only; no fabricated sample classes |

Tasks have no implemented category/reminder form, and personal events have no
implemented location or reminder delivery service. Those speculative fields and
Figma placeholders are not modeled. Ephemeral dialogs, navigation and hover state
are not persisted. Academic venue is read from the host timetable.

An occurrence has identity only. Its eligible task or event remains the single
outcome authority used across modules. A type change can retain a withdrawn,
unrecorded old projection; generation never creates a second recorded projection.
Graph validation checks this invariant before every commit, and all modules share
one user-row lock and transaction. No independent parent outcome needs syncing.

Calendar dates remain YYYY-MM-DD strings, recurrence times remain HH:mm strings,
and recorded timestamps remain ISO instants in snapshots/PostgreSQL timestamps.
An end time before its start means the following midnight/day. Conflict checks
compare instants; timetable projections normalize to the configured timezone.
Original occurrence dates/settings/history are retained when timezone changes.
Nonexistent local DST event times are rejected when saving an ordinary event;
ambiguous times use the earlier instant. The host has no campus timezone column;
the official timetable adapter uses its Nigeria campus convention, Africa/Lagos.

## Server operations and durable saving

`services/productivity-layer/operations.ts` runs the existing domain services in a
Core Prisma transaction. It locks the authenticated User row before reading, so
concurrent requests from different tabs/instances cannot lose updates across the
task, habit and schedule repositories. Writes are limited to changed snapshots.
Habit save/archive also reconciles projections in that transaction. Database
occurrence uniqueness and ownership foreign keys provide additional protection.

Operations cover scoped task details/lists/history/create/edit/delete/outcomes,
habit settings/archive/restore/generation/record/correction/replanning, event
planning/categories/archive/backup/miss, official classes, timezone, import and
derived analytics. Server clock/timing gates apply even to direct API calls.
Past habit tasks are reviewed through the tracker; To-do can act only on today's
habit occurrences. There is no deadline-expiry mutation and no automatic miss.

Creates and other mutations require retry identifiers. Receipts are stored in
the same transaction as the changes. The browser retains an identifier after a
lost response, so a retry returns the committed result instead of duplicating a
create. Saving errors retain the prior UI state and drafts. Synchronization is
deterministic and constrained by the database; read/synchronization calls do not
emit mutation events that would create refresh loops.

The UI keeps the established sidebar, Today overview, task tabs/cards, habit
editor/calendar/summary and 24-hour timetable. Feature CSS is scoped to
`.productivity-host`, and fonts use `/productivity/fonts/`. The host SessionProvider
is reused. There is a link back to the student dashboard, not a second host shell.

Official classes require the existing E-Learning database. Read failures surface
as partial-data warnings. Event conflict-aware saving refuses to pretend academic
availability is known when that service fails. There are no new external sync or
reminder services. Request receipts currently have no automatic retention job.

## Explicit local-data import

In the original browser/origin, run the standalone app and select **Export for
AkadVerse**. In the host, open **Account & import**, select that JSON file, review
the counts and signed-in email, check the ownership confirmation, and import.
When the records are on the same origin, **Review this browser's local records**
reads the three existing keys instead. Neither option uploads automatically.

The importer validates supported versions, histories, single-source identity,
relationships and duplicate occurrence outcomes. It preserves task/event/habit
links, schedule revisions, recorded timestamps and audits. Destination IDs are
deterministically namespaced to the authenticated account, so retries and changed
exports skip previously imported IDs without overwriting online edits. The three
original localStorage keys are never removed or changed by import/export. A
post-import read checks that the server can retrieve the saved datasets.

Mixed local identities, orphan source references, conflicting duplicate outcomes,
future recorded habit outcomes, and category-name collisions require review.
They fail atomically and leave both local originals and server data intact.
No demo fixtures or sample academic records are seeded into server data.

## Migration, local setup and commands

Migration: `prisma/migrations/20261112000000_productivity_layer/migration.sql`.
Generated by schema-to-schema diff against the pre-integration schema and reviewed:
seven new tables, an enum, indexes and foreign keys; no dropped/rewritten records.
No backfill or new required field on an existing table is needed. It has **not
been applied**: localhost:5433 was unreachable and Docker Desktop could not start.
Do not run it against a production/shared target merely because credentials exist.

Required existing environment names: `DATABASE_URL`, `DIRECT_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`; real official classes also need
`ELEARNING_DATABASE_URL` and `ELEARNING_DIRECT_URL`. Use the existing
`for_Developers/.env.example` and local setup guide; no new environment variables
or framework/Prisma upgrades were introduced.

From the repository root, after starting Docker Desktop and configuring the
existing **localhost development/test** environment:

```powershell
npm.cmd ci
npm.cmd run db:local:up
npm.cmd run db:local:setup
npm.cmd run db:local:seed
npm.cmd run test:db:setup
npm.cmd run test:productivity:db
npm.cmd run dev
```

The host's `db:local:setup` validates the localhost target and deploys Core
migrations, including the new migration; its separate E-Learning setup is the
existing host workflow. For an already configured, confirmed development target,
the Core-only command is:

```powershell
npm.cmd exec -- prisma migrate deploy --schema prisma/schema.prisma
```

Local source checks (no database needed):

```powershell
npm.cmd exec -- prisma validate --schema prisma/schema.prisma
npm.cmd exec -- prisma generate --schema prisma/schema.prisma
npm.cmd run db:elearning:generate
npm.cmd run test:productivity
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Open `/studashboard/productivity-layer` after signing in. For export only, from
`schedule-manager`, run `npm.cmd run dev -- --port 3001` and open the original
browser/origin holding the local records. Changing ports changes browser storage
origin, so use the original port when exporting existing records.

## Validation and remaining verification

Executed checks: Prisma schema validation and both client generations passed;
14 focused integration tests and 123 standalone tests passed; host/standalone
typechecks, lint and production builds passed. Host lint reported seven existing
warnings outside the integration. A local production-server HTTP check confirmed
the protected page redirects to the existing login, the unauthenticated API returns
JSON 401, and the host login page still returns 200.

The focused suite uses the host's Node/tsx test framework, its NextAuth mocking
convention, and a transactional persistence test double. It checks two users,
authorization, input/timing rules, shared outcomes, concurrent generation,
transaction rollback, retries, imports, account switching and official timetable
scope/conversion. The separate real-Postgres suite tests actual occurrence
uniqueness, ownership foreign keys, persistence across requests and concurrency.
It was attempted and failed to connect to localhost:5433; it has not passed.

After the local database is available, apply the migration and run that suite,
then sign in as two real test accounts and verify browser reload/new-session
persistence, account switching and the core task/event/habit journeys. Interactive
authenticated browser verification remains pending; it is not implied by the
passing domain and client tests. Full existing host DB suites also need the local
database setup. No production/shared database was touched.

## Rollback

Revert only the integration code commit, preserving unrelated work. The baseline
before this integration is `21727d1`; the earlier merge commit is `653c5a4`.
Leave the additive tables and migration history in place if the migration was
applied. Existing host tables are compatible with the prior application, which
simply ignores the productivity tables. Do not drop those tables, restore old
browser storage, or roll back user outcomes to undo a UI/code change. Keep both
server records and original local exports for a later forward-compatible repair.
