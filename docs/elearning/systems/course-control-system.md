# System: Course Control

## Purpose

Course Registration, Add/Drop, and Registration Status — §15. The student-facing half of the registration state machine documented fully in [`../data/workflow-states.md`](../data/workflow-states.md); read that first, this is the routes/UI layer on top of it.

## Actors

Student (write, their own registration only). Level Adviser and HOD act on the same rows from their own systems — [`level-adviser-system.md`](level-adviser-system.md), [`hod-system.md`](hod-system.md).

## Module

`services/e-learning/student/registration.ts` — `getRegistrationView` (the registration page's read model: period phase, courses, units), `getEligibleCourses` (the student's PUBLISHED structure for their programme + level + term), `registerCourses` (the one "Register Courses" submission), `addCourse` / `removeCourse` (add/drop after registering), `findRegistration`, `getRegistrationHistory`. Every write re-checks the relevant `AcademicTimeFrame` server-side (`assertEditable` internally) — never trusts that the page only rendered an enabled "Add"/"Submit" button while a window was open.

## Routes / Server Actions

`src/app/e-learning/student/course-control/actions.ts` — `addCourseAction`, `removeCourseAction`, `submitRegistrationAction` (Next.js Server Actions, called directly from `<form action={...}>` in the pages below).

| Route | Behavior |
|---|---|
| `/e-learning/student/course-control/registration` | If status ≠ `DRAFT`, read-only (points at Registration Status instead). Otherwise: current draft's items (removable) + eligible courses (addable) + Submit, all disabled if `COURSE_REGISTRATION` isn't open. |
| `/e-learning/student/course-control/add-drop` | Only usable once status is `APPROVED`; add/remove gated by the separate `CHANGE_OF_COURSE` window instead. |
| `/e-learning/student/course-control/registration-status` | Read-only: current status (with the §15 human-readable labels — "Pending Level Adviser Approval" etc.), item count, submitted/decided timestamps, decision note if rejected. |

## Which timeframe governs an edit

`registration.ts`'s `timeFrameTypeForEdit(status)`: `DRAFT` → `COURSE_REGISTRATION`; `APPROVED` → `CHANGE_OF_COURSE`; anything else (`SUBMITTED`, `PENDING_HOD`, `REJECTED`) → not editable at all, regardless of any timeframe. This is what makes the Registration page and the Add/Drop page mutually exclusive in practice — a student is never looking at an editable form on both at once.
