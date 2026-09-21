# System: Academic Calendar

## Purpose

The single source of truth for "what session/semester is it right now" (§31) and "is a given deadline currently open" (§27) — every other system reads from here rather than hard-coding dates.

## Actors

DAPU (write). Every role (read, implicitly, via every dashboard/page that scopes data to "current").

## Data

`AcademicSession`, `Semester` (§31), `AcademicTimeFrame` (§27) — see [`../data/schema.md`](../data/schema.md).

## Read side (every role)

- `services/e-learning/shared/academic-calendar.ts#getCurrentAcademicContext()` — `{ session, semester } | null`. Returns `null` (not a throw) when nothing's configured yet; callers render an empty/"not configured" state rather than treating it as an error.
- `services/e-learning/shared/timeframes.ts#isTimeFrameOpen(type, sessionId, semesterId)` / `#getActiveTimeFrame(...)` — `now` between a matching row's `startDate`/`endDate`. **No row for a type/session/semester means closed** — a missing deadline is never treated as "no deadline, anything goes."

## Write side (DAPU only)

- `services/e-learning/dapu/academic-calendar.ts` — `createSession`, `setCurrentSession` (transactionally clears every other session's `isCurrent` first), `createSemester`, `setCurrentSemester` (same pattern). UI: `/e-learning/dapu/dashboard` (`src/app/e-learning/dapu/dashboard/page.tsx` + `actions.ts`).
- `services/e-learning/dapu/timeframes.ts#upsertTimeFrame` — one row per `(type, academicSessionId, semesterId)`, upserted (not accumulated). UI: `/e-learning/dapu/timeframes/{course-registration,result-upload,result-revalidation,change-of-course,makeup-application}`, all five rendered by one shared component, `src/app/e-learning/dapu/_components/TimeFrameEditor.tsx`, parameterized by `type` — see that file for why one component covers all five instead of five near-identical pages.

## Before DAPU set anything

Before any session/semester exists (a fresh environment, or before DAPU's dashboard is used for the first time), `scripts/elearning-seed.ts` (`npm run db:elearning:seed`) seeds a session/semester/department/courses/an open Course Registration window — see [`../todo/roadmap.md`](../todo/roadmap.md) for what it covers.
