# Academy spec vs. the existing E-Learning schema — reconciliation

The Academy spec (College → Department → Programme → Curriculum → CourseOffering → StudentCourseRegistration, plus NUC/CCMAS reference data) was applied **additively** on top of the Phase 1-6 schema. Where an existing model contradicted the new spec, **the new spec won** and the existing model was changed. Every such change:

| Existing | Contradiction | Change |
|---|---|---|
| `AcademicFaculty` | Spec calls it College (CoE/CMSS/CLDS/CST) | Renamed `College` (`@@map("AcademicFaculty")` — table unchanged). `Department.academicFacultyId` → `collegeId` (`@map`, column unchanged) |
| `Program` | Spec spelling/shape | Renamed `Programme` (`@@map("Program")`); `StudentProfile.programId` → `programmeId` (`@map`). Added `@@unique([departmentId, name])` |
| `Semester.term` (`FIRST`/`SECOND` enum) | Names must be configurable data, not hard-coded | Replaced by `name` + `sequence` (+ `isActive`); unique on `(session, sequence)` and `(session, name)`. `SemesterTerm` enum removed. Existing row backfilled to `First Semester`/1 before the column was dropped |
| `Course.level`, `Course.term` | A Course must not belong to a semester/level (§21); placement is `CurriculumCourse` | Columns removed. Eligibility now comes from the PUBLISHED curriculum (`getEligibleCourses`) |
| `Course.departmentId` required | Shared courses (GST, MTH…) have no department | Now optional |
| `Course.creditUnit` | Spec name | Prisma field `creditUnits` (`@map("creditUnit")`) |
| `AcademicSession` | Spec wants `isActive` | Added |

## Added (new tables)

`Curriculum`, `CurriculumCourse`, `AcademicRule`, `LevelAdvisorAssignment`, `CourseOffering`, `CourseOfferingLecturer`, `CourseOfferingDay`, `StudentCourseRegistration`, and the reference set `CCMASDocument` / `CCMASImportBatch` / `CCMASDiscipline` / `CCMASProgramme` / `CCMASCourse` / `CCMASProgrammeCourse`. CCMAS tables have **no foreign keys** to operational tables (spec §58).

## Deliberately left in place (still contradict the spec — pending workflow migration)

These keep the current working flows alive until their logic is moved onto the new models; they are **not** the target design:

- `CourseRegistration` / `CourseRegistrationItem` / `RegistrationStatus` (Student → Level Adviser → HOD, no DAPU final step) — superseded by `StudentCourseRegistration` (Level Advisor → HOD → DAPU).
- `CourseAssignment` (one lecturer per course/semester) — superseded by `CourseOfferingLecturer`.
- `FacultyProfile.isLevelAdviser` / `levelAdviserOf` — superseded by `LevelAdvisorAssignment`.
- Dean/VC placeholder routes still exist; the Academy spec drops Dean.

## Seed notes

- Legacy rows (`ENG` college, `EEE` department, `EEE-BENG` programme) are migrated **in place** by `scripts/elearning-seed.ts` so foreign keys survive.
- Department codes (`EIENG`, `CVENG`, `MENG`, `PENG`, `CHENG`) are internal labels — the spec supplied names only.

## CCMAS pipeline

`npm run ccmas:extract` (PDF → `src/lib/resources/ccmas/Engineering-CCMAS.json`) then `npm run db:ccmas:import` (JSON → DB, idempotent, `--dry-run` validates only). The source is the 2021 Engineering and Technology CCMAS: 29 programmes, ~1,476 programme-course rows. Semester is `null` for every row — the source's tables are per-level and do not state a semester. Extraction warnings (source inconsistencies such as differing unit counts between a structure row and its detail entry) are preserved in the JSON's `warnings`.

## Course Structure workflow (DAPU -> HOD)

- **Route:** `/e-learning/dapu/course-structure` replaces Receive/Review/Send-to-HOD (those URLs redirect). Six dependent selectors (College -> Department -> Programme, Level, Session -> Semester), all from the database and re-validated server-side.
- **Sources:** `CurriculumCourse.source` is `CCMAS` (picked from the reference, with `ccmasProgrammeCourseId`) or `UNIVERSITY` (added by DAPU; electives use `courseType = ELECTIVE`). Course rows are reused by code, never duplicated.
- **Status:** `CurriculumStatus.PENDING_HOD` added. "Publish Course Structure" = `DRAFT -> PENDING_HOD` + HOD notification (Core `Notification`, new `ELEARNING` scope). HOD approves -> `APPROVED` (needs a Level Advisor per level); DAPU publishes -> `PUBLISHED`.
- **Programme names** come from the linked CCMAS programme (`Programme.ccmasProgrammeId`), never from a code. The seed links by CCMAS *code* and the operational programme code IS the CCMAS code: EEE, CPE, ICE (earlier informal codes EIE/CEN were replaced). Note CCMAS has a *different* programme named "Electrical Engineering" (TEL); it is not the operational EEE.
- **Session dates** are optional (`AcademicSession.startDate/endDate` nullable); the session name is the academic year.
- Verification: `scripts/verify-course-structure.ts` (34 checks incl. negative/authorization cases; cleans up after itself).
