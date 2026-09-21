# System: HOD

## Purpose

Course structure review, Assignments (lecturers, Level Advisers, history), Approvals (course registration, result upload), Results (by level/course/student) — §21-§24. Every function is scoped to `hod.departmentId`; a course, faculty member, or student outside that department is rejected, never silently ignored or shown.

## Actors

HOD only (`requireHodProfile`).

## Assignments

| Route | Service | Notes |
|---|---|---|
| `/e-learning/hod/assignments/lecturers` | `hod/course-offerings.ts` — `listAssignableCourses`, `assignLecturer`, `setCoordinator`, `removeLecturer` | Filter by session, semester, programme and level; only courses of a **PUBLISHED** structure in the HOD's department are listed. Assigning several lecturers to one course, plus exactly one coordinator (who is also one of the lecturers), is stored in `CourseOffering` / `CourseOfferingLecturer` (offering created on first assignment). Duplicates, lecturers from another department and unpublished courses are rejected server-side; a partial unique index enforces one coordinator per offering. |
| `/e-learning/hod/assignments/level-advisers` | `hod/level-advisors.ts#assignOrChangeLevelAdvisor` | Programme + level + session → one Faculty member; history is kept in `LevelAdvisorAssignmentChange`; the derived flags are kept in step by `shared/level-advisor-state.ts`. |
| `/e-learning/hod/assignments/history` | `hod/assignments.ts#getAssignmentHistory` | Every lecturer assignment in the department (course, programme, level, session, semester, role), most recent session first. |

Department lists used by these screens (`getDepartmentCourses`, `getDepartmentFaculty`) live in `hod/assignments.ts`.

## Course structure review — `services/e-learning/hod/curriculum-review.ts`

| Route | Function | Notes |
|---|---|---|
| `/e-learning/hod/curriculum` | `listCurriculaForHod` | The department's structures (pending, returned, published), filterable by programme and level. |
| `/e-learning/hod/curriculum/[id]` | `getCurriculumForHod`, `shared/curriculum/level-advisor-checklist.ts` | One structure with per-level totals and which levels still lack a Level Adviser. |
| approve / return | `hodApproveCurriculum` / `hodReturnCurriculum` | Approval **is** publication (students can then register; there is no further DAPU step) and requires a Level Adviser for every level. Returning needs a note to DAPU. |

## Approvals

| Route | Service | Notes |
|---|---|---|
| `/e-learning/hod/approvals/course-registration` | `hod/registration-approvals.ts` — `getPendingRegistrationApprovals` / `approveRegistration` / `rejectRegistration` | `PENDING_HOD → APPROVED`/`REJECTED`, department-scoped via each registration's student's `StudentProfile.departmentId`. The HOD's decision is final. |
| `/e-learning/hod/approvals/result-upload` | `hod/result-approvals.ts` — `getPendingResultApprovals` / `approveResultUpload` | One row per **course** with `SUBMITTED` results (not per student) — approving publishes the whole course's result sheet at once. **Simplification**: collapses the spec's `VALIDATED`/`APPROVED` intermediate stages into this one action — see [`../data/workflow-states.md`](../data/workflow-states.md#simplification-hod-collapses-submitted--validated--approved--published-into-one-action) and [`../decisions/hod-result-upload-collapses-workflow.md`](../decisions/hod-result-upload-collapses-workflow.md). |

## Results — `services/e-learning/hod/results.ts`

Unlike the student-facing results module (PUBLISHED only), these show **every** status — an oversight view of results as they move through the pipeline, not just the published record.

| Route | Function | Shape |
|---|---|---|
| `/e-learning/hod/results/by-level` | `getResultsByLevel` | Course × student matrix for one level, each student's semester GPA. |
| `/e-learning/hod/results/by-course` | `getResultsByCourse` | Every student's result for one course. |
| `/e-learning/hod/results/by-student` | `findStudentsByQuery` + `getResultsByStudent` | Matric-number search, then that student's full result history across sessions/semesters. |

## Dashboard

`/e-learning/hod/dashboard` surfaces live counts — pending registration approvals, pending result-upload approvals (by course) — rather than a static landing page, so there's an immediate "what needs me right now" view.
