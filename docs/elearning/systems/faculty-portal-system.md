# System: Faculty Portal

## Purpose

Dashboard (timetable), **My Subjects** (assigned offerings, weekly content, document upload), Results Record — §16-§19. Documents: [`course-materials-system.md`](course-materials-system.md).

## Actors

Faculty only. Level Adviser is documented separately ([`level-adviser-system.md`](level-adviser-system.md)) even though it's the same account — it's a responsibility, not a different role.

## The one gate everything here goes through

`services/e-learning/faculty/assigned-courses.ts#assertAssignedToCourse(facultyUserId, courseId, sessionId, semesterId)` — throws unless a `CourseOfferingLecturer` row (created by the HOD's Assign Lecturers, as lecturer or coordinator) links that exact faculty member to an offering of that exact course for that exact session/semester. Every course-detail and result-entry route calls this (directly, or via `getAssignedCourses` for list views) before reading/writing anything — a faculty member editing the URL to another course's id gets rejected, verified by testing (§19/§34: "Faculty should only be able to modify results for courses they are authorized to teach").

## Routes

| Route | Module | Notes |
|---|---|---|
| `/e-learning/faculty/dashboard` | `assigned-courses.ts`, `faculty/timetable.ts#getFacultyTimetable` | Timetable shows only `isApproved: true` `TimetableEntry` rows for this faculty's assigned courses — an unapproved entry never surfaces here (§28). |
| `/e-learning/faculty/my-subjects` | `faculty/my-subjects.ts#getMySubjects` | Every offering assigned to this lecturer this semester, with their role (Coordinator / Lecturer). |
| `/e-learning/faculty/my-subjects/[offeringId]` | `faculty/my-subjects.ts#requireMySubject`, `shared/offering-detail.ts`, `faculty/materials/*` | Overview, Weekly Course Content (documents per week, delete), and **Upload Material** (type, single week or week range, file). Not assigned to that offering → 404. |
| `/e-learning/faculty/results` | `getAssignedCourses` | List, links to entry grid. |
| `/e-learning/faculty/results/[courseId]` | `faculty/results.ts` | Per-student Test 1/Test 2/Exam/Full-CA-override grid; live total/grade via `shared/grading.ts`; bulk Submit. |

## Result entry mechanics

`ensureResultRows` runs on every visit to the entry page — creates a `DRAFT` `Result` row for each currently-`APPROVED`-registered student who doesn't have one yet (idempotent, never overwrites an existing row). `updateResultScores` recomputes `fullCA`/`totalScore`/`grade`/`gradePoint` from whatever `test1`/`test2`/`exam`/override values are submitted, every time — nothing is computed client-side. `submitCourseResults` is a bulk action, one course's whole sheet at once (`DRAFT → SUBMITTED` for every row on that course), gated by the `RESULT_UPLOAD` time frame. Full state machine: [`../data/workflow-states.md`](../data/workflow-states.md).

## Roster scope

`getStudentsForCourse` only includes students with an `APPROVED` registration containing that course for the current session/semester — a `SUBMITTED`/`PENDING_HOD` registration doesn't put a student on the roster yet, so a faculty member never enters results for someone whose registration hasn't cleared the approval chain.
