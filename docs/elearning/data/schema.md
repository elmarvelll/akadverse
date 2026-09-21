# E-Learning — Schema

Source of truth: `prisma/elearning/schema.prisma`. This is a summary with the *why*, not a restatement of every field — read the schema file itself for exact types/defaults.

## No `User` model

Deliberately absent. Authentication and `role` live on the Core database's `User` (`prisma/schema.prisma`). Every model below that belongs to a person stores a plain `userId` string (that table's `id`), never a relation — see [`../architecture.md`](../architecture.md#identity-one-core-user-no-duplication).

## Academic calendar

- **`AcademicSession`** (`name` e.g. `"2026/2027"`, `startDate`, `endDate`, `isCurrent`) and **`Semester`** (`term`: `FIRST | SECOND`, own `startDate`/`endDate`/`isCurrent`). At most one of each should be `isCurrent`; enforced at the application layer (`services/e-learning/dapu/academic-calendar.ts#setCurrentSession`/`#setCurrentSemester`, each wrapped in a `$transaction` that clears every other row first) — not a DB constraint, since Postgres can't express "exactly one row where a boolean column is true" as a plain column check.
- **`AcademicTimeFrame`** (`type`: `COURSE_REGISTRATION | RESULT_UPLOAD | RESULT_REVALIDATION | CHANGE_OF_COURSE | MAKEUP_APPLICATION`, scoped to one session **and** semester, `startDate`/`endDate`). `semesterId` is **required**, not nullable — see [`../decisions/timeframe-semester-required.md`](../decisions/timeframe-semester-required.md) for why (a real bug this schema caught, not a stylistic choice). `@@unique([type, academicSessionId, semesterId])` — one row per deadline type per semester, upserted by DAPU rather than accumulated.

## Academic org hierarchy (§30)

`AcademicFaculty` → `Department` → `Program`, plus `Course` (belongs to a `Department`, has `level` and `term`). `AcademicFaculty` is named that specifically to avoid colliding with "faculty" the *role* — it's the organizational unit (e.g. "Engineering"), not a person.

## Role profiles

One model per role that has E-Learning-specific data — `role` itself stays on Core `User` (above):

| Model | Holds | Notes |
|---|---|---|
| `StudentProfile` | `departmentId`, `programId?`, `level`, `matricNumber?`, `admissionSessionId` | |
| `FacultyProfile` | `departmentId`, `staffId?`, `isLevelAdviser`, `levelAdviserOf?` | Level Adviser is a responsibility on this profile, **not** a separate role (§5/§20) — see the model's own comment on the planned historical `LevelAdviserAssignment` evolution, not yet built. |
| `HodProfile` | `departmentId` (`@unique` — one HOD per department at a time) | Current-responsibility only, same "not yet historical" caveat as above. |
| `DapuProfile` | nothing beyond `userId` | DAPU is university-wide, no departmental scope. |

Dean/VC get **no profile model** — nothing to scope them by until their functionality is specified (§29).

## Courses, assignments, resources

- **`CourseAssignment`** — which faculty member taught a course in a given session+semester. **Historical by design** (§40): `@@unique([courseId, academicSessionId, semesterId])`, so a new semester's assignment is a new row, never an overwrite of a "current lecturer" field. HOD's Assignment History page reads this directly.
- **`LearningResource`** (`type`: `NOTE | DOCUMENT | ASSIGNMENT | OTHER`, `fileUrl?`, `uploadedByUserId`) and **`Syllabus`** (one per course+session+semester, plain `content` text) — both scoped to course+session+semester.
- **`TimetableEntry`** (`dayOfWeek`, `startTime`/`endTime` as `"HH:MM"` strings — not `DateTime`, since a timetable slot is a time-of-day, not a timezone-sensitive instant — `venue`, `isApproved`). Who teaches it is **not** duplicated here; resolved via `CourseAssignment` for the same course+session+semester (one historical source of truth, §40). Only visible to faculty/students once `isApproved` (§28).

## Curriculum, offerings and course documents

- **`Curriculum`** (programme + session + semester, `status`: `SAVED | PENDING_HOD | RETURNED | PUBLISHED | ARCHIVED`) → **`CurriculumCourse`** (course, level, units, type, source, optional `ccmasProgrammeCourseId` link to the CCMAS reference).
- **`CourseOffering`** (one per `CurriculumCourse`) → **`CourseOfferingLecturer`** (`LECTURER | COORDINATOR`; one coordinator per offering) — the HOD's Assign Lecturers writes these; they replace `CourseAssignment` for everything current.
- **`CourseMaterial`** — a lecturer-uploaded document for one offering, covering `startWeek..endWeek`, with the Supabase Storage bucket/path. Full description: [`../systems/course-materials-system.md`](../systems/course-materials-system.md).

## Registration and results

- **`CourseRegistration`** (one per student per session+semester — `@@unique([studentUserId, academicSessionId, semesterId])`) + **`CourseRegistrationItem`** (one row per course on it). `status` is the workflow enum — see [`workflow-states.md`](workflow-states.md).
- **`Result`** (`test1`, `test2`, `exam`, `fullCA`, `totalScore`, `grade`, `gradePoint`, `status`, `enteredByUserId`) — one row per student per course per session+semester. `status` — see [`workflow-states.md`](workflow-states.md).

## Back-relations

Every model above that references `AcademicSession`/`Semester`/`Department`/`Course` required an explicit list field added on the *other* side too (Prisma requires both sides of a relation to be declared) — visible as the growing `courseAssignments`/`learningResources`/`syllabuses`/`courseRegistrations`/`results`/`timeFrames`/`timetableEntries` lists on `AcademicSession`/`Semester` as each new model was added phase by phase. Not redundant data, just Prisma's relation declaration requirement.
