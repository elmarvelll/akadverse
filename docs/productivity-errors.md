# Productivity Layer error handling

Errors appear beside the failed form or in the section's alert. They identify the operation, the known cause, and a recovery action. Account/session errors remove the data-bearing workspace and provide sign-in/reload links. Unexpected render failures have a route fallback with a retry action.

`src/features/productivity/errors.ts` defines intentional messages safe to display. Domain validation and storage parsers use this type. Unexpected JavaScript errors receive a contextual fallback rather than exposing their raw message.

`services/productivity-layer/errors.ts` classifies database failures without returning credentials, URLs, SQL, or Prisma's exception text:

| Error code | Meaning and recovery |
| --- | --- |
| `DATABASE_SCHEMA_MISSING` | Required tables/columns are missing; apply migrations. |
| `DATABASE_CONFIGURATION` | Connection initialization failed; check server environment settings and restart. |
| `DATABASE_ACCESS_DENIED` | Database credentials or permissions are rejected. |
| `DATABASE_UNAVAILABLE` / `DATABASE_NOT_FOUND` | Start/check PostgreSQL, or create/correct the configured database. |
| `DATABASE_TIMEOUT` | Retry the same operation after the database responds. |
| `DUPLICATE_RECORD` / `RELATED_RECORD_MISSING` / `CONCURRENT_UPDATE` | Reload and review the existing records before retrying. |
| `SIGN_IN_REQUIRED` / `ACCESS_DENIED` | Sign in again or use an ordinary student account. |
| `INVALID_INPUT` / `SLOT_CONFLICT` | Correct the identified field or review the conflicting event. |
| `UNEXPECTED_ERROR` | Unclassified server failure; retry and report its reference if it persists. |

Official timetable dependency errors identify the timetable service separately. Partial timetable/analytics results retain the reason and state that figures are incomplete.

`POST /api/productivity` carries both reads and writes. Its JSON `operation` identifies the action: `context` reads the workspace identity/timezone, `tasks.list` and `schedule.load` load records, and `habits.synchronize` creates/reuses scheduled habit occurrences. Mounted sections refresh approximately every minute and on tab focus, visibility changes, or relevant record changes. POST alone does not indicate that a new record is being created.

Missing Core tables, invalid connection settings, missing databases, or rejected database credentials pause further workspace calls and replace the mounted sections with a setup message. This also stops their polling timers. Already in-flight requests can still finish. Reload after correcting the environment to attempt again. An E-Learning-only setup failure does not block personal Productivity records. Transient connection/timeouts remain retryable.

If `.env.local` points at live/shared databases, do not apply development migrations or run resets against them. The prepared Core migration is `prisma/migrations/20261112000000_productivity_layer/migration.sql`; its presence in the repository does not mean it has been applied to the configured database. Follow `docs/development-login.md` to use isolated local databases, with matching local targets in `.env` and `.env.local`. Shared/live migrations require a separate reviewed deployment.

The API attaches an error reference. Server logs contain only this reference, the bounded action label, and the error code. The initial server-rendered page also returns a safe error with a reference if its account/database lookup fails. Next.js render failures may supply a separate digest.

The client handles non-JSON/incomplete responses and aborts stalled requests after 45 seconds. A lost or unreadable mutation response is **unconfirmed**, not declared unsaved. Its request identifier is retained so retrying the same operation uses the existing server receipt. Successful saves/imports followed by a failed refresh are reported as saved, with instructions to reload rather than create another item.

Browser storage, JSON parsing, and file-reading failures leave local originals intact. The import confirmation is cleared when changing files; an unreadable selection cannot accidentally import the previous file.

Run `npm run test:productivity` for the isolated operation/client/API failure tests. Database failures are simulated; real migration, connection and durability checks require a configured development PostgreSQL instance and `npm run test:productivity:db`.
