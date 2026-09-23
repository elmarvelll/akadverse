# E-Learning — Service Layer

All E-Learning business logic lives in **`services/e-learning/`** (imported with the `@/services/e-learning/...` alias), organised **by role tier** — the same way the Marketplace keeps its logic under `services/marketplace/`. Pages, Server Actions and route handlers under `src/app/e-learning/` and `src/app/api/e-learning/` stay thin: they authenticate, call a service function, and render or return the result.

> The code used to live in `src/modules/elearning/`. That folder no longer exists. Old comments/docs that mention it were updated to the paths below.

## Layout

```text
services/e-learning/
├── shared/            used by more than one role
├── dapu/              DAPU (academic administration)
├── hod/               Head of Department
├── level-adviser/     Level Adviser responsibility (held by a Faculty account)
├── faculty/           Faculty / lecturers
└── student/           Students
```

| Tier | Owns | Import rule |
|---|---|---|
| `shared/` | Auth guards, identity/notification bridge, the current academic context, time-frame phases, grading maths, the offering read model, curriculum loading + Level Adviser checklist, the Level Adviser derived-state sync, and course-document access | May be imported by every tier. Imports no role tier. |
| `dapu/` | Sessions/semesters, CCMAS reference + programme linking, course catalog, course structure (curriculum) building, time frames, timetable | May import `shared/`. |
| `hod/` | Department-scoped assignments, registration and result approvals, results oversight, structure review (approve/return) | May import `shared/`. |
| `level-adviser/` | Reviewing/approving registrations in the adviser's own department + level | May import `shared/`. |
| `faculty/` | My Subjects, result entry, roster, timetable, lecturer document uploads | May import `shared/`. |
| `student/` | Registration, registered courses, results/GPA/history, sign-up academics | May import `shared/`. |

Rules that hold across tiers:

1. **One capability per file.** A file is named for what it does (`save-course-selection.ts`, `upload-material.ts`). Small closely-related functions that share private helpers stay together (e.g. `student/registration.ts`); a file that grew several unrelated capabilities is split (this is how `curriculum.ts` and `materials.ts` were broken up).
2. **Authorization lives in the service, never in the caller.** Every function that reads or writes scoped data re-checks scope itself (department, assigned offering, approved registration). An id from a form or URL is routing only.
3. **`shared/identity.ts` is the only file allowed to import the Core Prisma client** (see [`architecture.md`](architecture.md)). Everything else reaches names/emails/notifications through it.
4. **Services throw `ServiceError`** (`@/lib/service-error`); route handlers/actions turn it into a status/message. Nothing here returns HTTP objects.
5. **No role tier imports another role tier.** If two tiers need the same piece (e.g. the Level Adviser checklist, used by DAPU publish and HOD approve), it moves to `shared/`. Checked by a grep over the imports when this layout was made: the only cross-folder imports are into `shared/`.
6. **Cross-tier imports use the alias** (`@/services/e-learning/<tier>/<file>`), never long relative paths.

## `shared/`

| File | Exports | Purpose |
|---|---|---|
| `auth.ts` | `ELEARNING_ROLES`, `ElearningRole`, `isElearningRole`, `requireElearningSession`, `requireElearningRole`, `require{Student,Faculty,Hod,Dapu,LevelAdviser}Profile` | Session + role guards and profile resolution. |
| `identity.ts` | `resolveIdentity`, `resolveIdentities`, `fullName`, `notifyUsers` | The single bridge to the Core `User`/`Notification` tables. |
| `academic-calendar.ts` | `getCurrentAcademicContext` | The current session + semester (or `null`). |
| `timeframes.ts` | `phaseAt`, `getTimeFrame`, `getActiveTimeFrame`, `isTimeFrameOpen` | UPCOMING / ACTIVE / ENDED / NOT_CONFIGURED for a DAPU time frame. |
| `grading.ts` | `gradeForScore`, `computeFullCA`, `computeTotalScore`, `computeGpa` | Grade scale and GPA/CGPA maths. |
| `offering-detail.ts` | `getOfferingDetail` | Everything a course page shows for one `CourseOffering`: overview, lecturers/coordinator, week count from semester dates, materials, CCMAS contents/outcomes (only via the strong `ccmasProgrammeCourseId` link). |
| `level-advisor-state.ts` | `syncFacultyAdvisorState`, `syncAllFacultyAdvisorState` | Keeps `FacultyProfile`'s derived Level Adviser flags in step; called by HOD (assign) and DAPU (change current session). |
| `curriculum/load-curriculum.ts` | `loadCurriculum`, `label` | Load one curriculum + display label. |
| `curriculum/level-advisor-checklist.ts` | `levelAdvisorChecklist` | Levels of a curriculum that still have no Level Adviser (DAPU publish + HOD approve). |
| `course-materials/offering-access.ts` | `loadOffering`, `requireLecturer`, `BUCKET`, `slug` | Building blocks for course documents: load an offering, and check a faculty member is assigned to *that* offering. |
| `course-materials/resolve-download.ts` | `resolveDownload`, `assertStudentRegistered` | Who may open a document, and the 60-second signed URL. |

## `dapu/`

| File | Exports | Purpose |
|---|---|---|
| `academic-calendar.ts` | `listSessions`, `createSession`, `setCurrentSession`, `createSemester`, `setCurrentSemester` | Session/semester administration. |
| `ccmas-reference.ts` | `getAcademicTree`, `listCcmasProgrammes`, `linkCcmasProgramme` | Read-only CCMAS reference and the explicit programme link. |
| `course-structure.ts` | `listAcademicFaculties`, `listCourses`, `createCourse` | Course catalog. |
| `timeframes.ts` | `listTimeFrames`, `upsertTimeFrame` | The five DAPU deadline types. |
| `timetable.ts` | `listPendingTimetableEntries`, `listApprovedTimetableEntries`, `createTimetableEntry`, `approveTimetableEntry` | Timetable review/approval. |
| `offerings.ts` | `createCourseOffering`, `listMyOfferings`, `requireOfferingAccess` | Older offering helpers; **not called by any page today** (lecturer assignment goes through `hod/course-offerings.ts`). Kept, not deleted, pending a decision. |
| `curriculum/context.ts` | `StructureContext`, `resolveContext`, `EDITABLE`, `currentCurriculum`, `courseTypeFromLetter` | Shared context and validation for the structure workflow (its header documents the whole workflow). |
| `curriculum/get-structure-view.ts` | `getStructureView` | Read model for the Course Structure page. |
| `curriculum/list-elective-candidates.ts` | `listElectiveCandidates` | Courses offered by "Select Elective Course". |
| `curriculum/save-course-selection.ts` | `saveCourseSelection` | "Save Courses"; reopens a PUBLISHED structure on a real change. |
| `curriculum/publish-structures.ts` | `publishStructuresToHods`, `submitCourseStructure`, `PublishResult` | "Publish to HOD(s)". |
| `curriculum/list-structures-for-review.ts` | `listStructuresForReview` | Review Saved Courses. |

## `hod/`

| File | Exports | Purpose |
|---|---|---|
| `curriculum-review.ts` | `getCurriculumForHod`, `listCurriculaForHod`, `hodApproveCurriculum`, `hodReturnCurriculum` | Department-scoped structure review; **approval is publication**. |
| `course-offerings.ts` | `listAssignableCourses`, `assignLecturer`, `setCoordinator`, `removeLecturer` | Assign lecturers + one coordinator to a course offering. |
| `assignments.ts` | `getDepartmentCourses`, `getDepartmentFaculty`, `getAssignmentHistory` | Department lists and assignment history. |
| `level-advisors.ts` | `assignOrChangeLevelAdvisor`, `listAdvisorContexts` | Level Adviser assignment (uses `shared/level-advisor-state.ts`). |
| `registration-approvals.ts` | `getPendingRegistrationApprovals`, `approveRegistration`, `rejectRegistration` | Final registration approval (PENDING_HOD → APPROVED). |
| `result-approvals.ts` | `getPendingResultApprovals`, `approveResultUpload` | Result approval-and-publish. |
| `results.ts` | `getResultsByLevel`, `getResultsByCourse`, `findStudentsByQuery`, `getResultsByStudent` | Results oversight. |

## `level-adviser/`

| File | Exports | Purpose |
|---|---|---|
| `registrations.ts` | `getRegistrationsInScope`, `getPendingApprovals`, `getReviewQueue`, `approveRegistration`, `approveAll`, `rejectRegistration` | Review queue and decisions, scoped to the adviser's department + level. |

## `faculty/`

| File | Exports | Purpose |
|---|---|---|
| `my-subjects.ts` | `getMySubjects`, `requireMySubject` | The lecturer's assigned offerings and role. |
| `assigned-courses.ts` | `getAssignedCourses`, `assertAssignedToCourse` | Assignment gate used by results/timetable/dashboard. |
| `results.ts` | `ensureResultRows`, `getResultsForCourse`, `updateResultScores`, `submitCourseResults` | Result entry and submission. |
| `students.ts` | `getStudentsForCourse` | Roster (approved registrations only). |
| `timetable.ts` | `getFacultyTimetable` | Approved timetable for the lecturer's courses. |
| `materials/upload-material.ts` | `requestUpload`, `confirmUpload`, `UploadMeta` | Two-step signed upload with server-side 8 MB re-check and cleanup. |
| `materials/delete-material.ts` | `deleteMaterial` | Storage object first, then the row. |
| `materials/list-materials.ts` | `listMaterials` | Documents of one offering. |

## `student/`

| File | Exports | Purpose |
|---|---|---|
| `registered-courses.ts` | `getRegisteredCourses` | The student's APPROVED courses, with offering + lecturers (My Learning). |
| `registration.ts` | `findRegistration`, `getRegistrationHistory`, `getEligibleCourses`, `getRegistrationView`, `registerCourses`, `addCourse`, `removeCourse` | The registration workflow. |
| `signup-academics.ts` | `getSignupOptions`, `resolveAcademicSelection`, `normalizeMatricNumber`, `assertMatricAvailable`, `createStudentProfile`, `SIGNUP_SCOPE` | Sign-up dropdown data (testing-phase scope by code), server-side validation of College → Department → Programme → Level, and creation of the `StudentProfile`. |
| `results.ts` | `getResultsBySemester`, `getAllResultsGrouped`, `getAcademicHistory`, `getGpaCgpaSummary` | PUBLISHED results, GPA/CGPA, history. |

## Outside the tiers: `services/auth/student-signup/`

Student sign-up spans the Main DB (`User`, `PendingSignup`) and the E-Learning DB, so it lives in its own folder rather than in a role tier. It may import `services/e-learning/student/signup-academics.ts` (the academic dropdown data, validation and `createStudentProfile`) — the one place E-Learning code writes the student profile. Files: `start-student-signup.ts`, `verify-student-signup.ts`, `resend-student-signup-otp.ts`, `get-signup-options.ts`, `google-signup-token.ts`, `otp.ts`, `send-otp-email.ts`, `config.ts`; and `services/auth/staff-signup/create-staff-profile.ts` (guarded Faculty/HOD profile creation). Full description: [`systems/authentication-and-domains.md`](systems/authentication-and-domains.md).

## Adding a new service

1. Pick the tier by **who calls it**. Used by two or more tiers → `shared/`.
2. Create `<capability>.ts` (or `<area>/<capability>.ts` for a family), start it with the header comment convention `// services/e-learning/<path>.ts` + what it does + who calls it.
3. Re-check scope inside the function; throw `ServiceError` for failures.
4. Add a row to the table above and to the relevant `systems/*.md`.
5. Do not import a sibling tier from a role tier (`faculty/` → `hod/` is not allowed); move the shared piece to `shared/`.
