# System: DAPU

## Purpose

Course Structure, Academic Time Frames, Timetable review/approval — §25-§28. Academic Session/Semester administration also lives here (on the Dashboard) even though §25's nav list doesn't call it out separately — DAPU is the natural owner of §31's calendar, and every other role's pages depend on it being set.

## Actors

DAPU only (`requireDapuProfile`).

## Academic calendar

See [`academic-calendar-system.md`](academic-calendar-system.md) — creating sessions/semesters and marking one of each current, from `/e-learning/dapu/dashboard`.

## Academic Time Frames — §27

Five deadline types (`COURSE_REGISTRATION`, `RESULT_UPLOAD`, `RESULT_REVALIDATION`, `CHANGE_OF_COURSE`, `MAKEUP_APPLICATION`), one shared editor component (`src/app/e-learning/dapu/_components/TimeFrameEditor.tsx`) rendered by five thin pages under `/e-learning/dapu/timeframes/*` — each just passes its own `type`/`title`. `services/e-learning/dapu/timeframes.ts#upsertTimeFrame` writes one row per `(type, session, semester)`.

## Timetable — §28

`services/e-learning/dapu/timetable.ts`:

| Route | Function | Notes |
|---|---|---|
| `/e-learning/dapu/timetable/review` | `listPendingTimetableEntries` + `createTimetableEntry` | DAPU is the practical entry point for raw `TimetableEntry` rows — nothing else in the system currently creates them (aside from the seed script). |
| `/e-learning/dapu/timetable/approve` | `approveTimetableEntry` | Flips `isApproved` — this is what makes an entry visible to Faculty (§17) and, eventually, students. |
| `/e-learning/dapu/timetable/send-to-hods` | `listApprovedTimetableEntries` | **Simplification**: an approved entry is already visible to the relevant faculty the moment `isApproved` flips — there's no separate distribution artifact to model, so this page is a confirmation view, not a distinct send action. See [`../decisions/timetable-send-to-hods-is-approval.md`](../decisions/timetable-send-to-hods-is-approval.md). |

## Course Structure — §26

`services/e-learning/dapu/course-structure.ts`. **Simplification, documented rather than assumed**: §26 describes a three-stage Receive/Review/Send-to-HOD workflow, but doesn't specify what artifact is "received" or what distinguishes "reviewed" from "sent" — there's no separate staging model to receive from, and `Course` is already the concrete thing HOD needs (to assign lecturers against, §22). So:

| Route | Function | What it actually is |
|---|---|---|
| `/e-learning/dapu/course-structure/receive` | `createCourse` | Add a course to the catalog (code, title, credit unit, department, level, term). |
| `/e-learning/dapu/course-structure/review` | `listCourses` | Full catalog, flat table. |
| `/e-learning/dapu/course-structure/send-to-hod` | `listCourses` | Same catalog, department-grouped — a course is visible to its department's HOD as soon as it's added; nothing further to "send." |

Full reasoning: [`../decisions/course-structure-is-catalog-management.md`](../decisions/course-structure-is-catalog-management.md). If a real staged review process is specified later, `course-structure.ts` is the module to extend.


## Where the code lives

DAPU's services are in `services/e-learning/dapu/` (see [`../services.md`](../services.md) for every file). The course-structure workflow is a folder, `dapu/curriculum/`, one file per capability: `context.ts` (shared validation + the full workflow description), `get-structure-view.ts`, `list-elective-candidates.ts`, `save-course-selection.ts`, `publish-structures.ts`, `list-structures-for-review.ts`. Loading a curriculum and the Level Adviser checklist are in `shared/curriculum/` because the HOD's approval needs them too; the HOD half of the workflow is `hod/curriculum-review.ts`.
