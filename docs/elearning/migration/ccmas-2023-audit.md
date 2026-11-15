# CCMAS 2023 migration and reset audit

Status: audit plus completed reference staging; no reset, source deletion or operational curriculum activation executed. See `ccmas-2023-implementation-report.md` for current results.

## Database boundaries and inventory

`prisma/elearning/schema.prisma` uses ELEARNING_DATABASE_URL / ELEARNING_DIRECT_URL and a separately generated client. Core `prisma/schema.prisma` owns User, authentication and Notification. E-Learning profiles reference Core user IDs without cross-database foreign keys. Never reset Core to reset learning activity.

Run the read-only inventory:

```sh
node --env-file=.env --import tsx scripts/elearning-reset/inventory.ts
```

The command takes a read-only repeatable-read snapshot of all Prisma models, counts, scalar inventory metadata and declared dependencies (long document/chat text excluded); inspects database policies, RLS flags and grants; and saves a private report in ignored `.elearning-reset/`. It is an inventory, **not a verified restorable PostgreSQL backup**. A tested pg_dump/restore and object backup are required before execution. The report includes personal data and must remain private.

| Category | Actual models | Decision |
| --- | --- | --- |
| Identity | StudentProfile, FacultyProfile, HodProfile, DapuProfile | Preserve all identity/profile fields and user IDs |
| Academic hierarchy/calendar | College (SQL AcademicFaculty), Department, Programme (SQL Program), AcademicSession, Semester | Preserve IDs, hierarchy and current context |
| Reusable rules/responsibilities | AcademicRule, LevelAdvisorAssignment, LevelAdvisorAssignmentChange | Preserve; adviser responsibility is part of access control |
| Versioned reference | CCMASDocument, CCMASImportBatch, CCMASDiscipline, CCMASProgramme, CCMASCourse, CCMASProgrammeCourse | Preserve old edition; import new edition separately |
| Operational curricula | Course, Curriculum, CurriculumCourse, CourseOffering | Review; archive old curricula, preserve references needed by retained materials |
| Registration/activity | CourseRegistration, CourseRegistrationItem, StudentCourseRegistration, Result | Reset candidates after reviewed inventory |
| Teaching allocations | CourseAssignment, CourseOfferingLecturer, CourseOfferingDay, TimetableEntry | Reset candidates; material retention may require retaining offering containers |
| Teaching content | CourseMaterial, LearningResource, Syllabus | Requires source-file decision; do not delete metadata independently |
| Academic periods | AcademicTimeFrame | Review; dates are deliberate DAPU configuration, not disposable activity by default |
| Classroom activity | ClassroomSession, ClassroomQuestion, ClassroomQuestionVote, ClassroomPoll, ClassroomPollResponse | Reset candidates, child-first |
| Stewart activity | ChatMessage, ChatConversation, StewartAttachment | Reset candidates; attachment binaries are upstream and expire separately |
| AI integration | AiIngestTask | Preserve pending cleanup tasks until remote deletion is verified |
| Core notification activity | Notification with scope ELEARNING | Separate narrowly scoped inventory/decision; this command never opens Core |
| Other Core data | User, credentials, roles, marketplace data, assets | Excluded entirely |

## Source and extraction

User supplied `Engineering-Technology-CCMAS-2023-FINAL.pdf`: 1,332 PDF pages, SHA256 `99030f5f3c5593246ec80178a2a84e562da384173ddc5be71e08d1bfb3e943fe`.

Existing committed reference: 2021, 1,101 pages, SHA256 `1050c408be96086a8c4efb41caa5eff255f2bbd96412fd8b56e42a38e05da8cb`, 29 programmes and 226 extraction warnings. It must not be presented as the new source.

Existing extraction uses edition-specific table-of-contents pages and printed-page assumptions. A successful parse alone does not establish accuracy. Verify the new edition's programme boundaries, structure tables, titles, units, status letters, detail-only courses, prerequisites, outcomes and page references before import. Semester must remain null unless printed by the source. DAPU chooses operational semester allocation; never infer odd/even semester from course numbers.

The extractor supports explicit `--version`; defaults now target the supplied 2023 edition, while legacy 2021 extraction requires `--version 2021`. New output must use a separate path until validated. Existing importer dry-run validates JSON without writes; execution writes only versioned CCMAS reference tables. It does not activate DAPU curricula or relink programmes.

## Baseline business rules and change control

| Existing implementation | Classification | Required preservation/scenario |
| --- | --- | --- |
| `scripts/elearning-seed.ts`, `student/signup-academics.ts`: EIENG | Still valid | EIE institutional group is stored as EIENG; EEE/CPE/ICE remain under its existing ID, never independent departments |
| `dapu/curriculum/context.ts`: resolveContext | Still valid | Reject invalid College→Department→Programme and Session→Semester chains; levels 100–600 in 100 increments |
| `dapu/curriculum/get-structure-view.ts` | Still valid | CCMAS list filters by explicitly linked programme and selected level |
| `dapu/curriculum/save-course-selection.ts` | Still valid | Validate selected IDs against programme+level; keep DAPU semester choice and university elective support |
| `dapu/curriculum/publish-structures.ts`, `hod/curriculum-review.ts` | Still valid | SAVED→PENDING_HOD→PUBLISHED; only published curricula are registerable; preserve return/revision workflow |
| `shared/curriculum/load-curriculum.ts`, `student/registration.ts` | Still valid | Student programme+level+session+semester eligibility, registration window, unit limits and duplicate prevention |
| `hod/course-offerings.ts`, `shared/course-materials/offering-access.ts` | Still valid | HOD department scope and assigned lecturer authorization |
| FacultyProfile adviser consistency SQL check | Still valid | Never null adviser pointer alone or delete current assignments while preserving profile flags |
| `shared/auth.ts`, `src/lib/account-domains.ts` | Still valid | Core role source, server authorization and existing domain routing remain unchanged |
| Programme.ccmasProgrammeId | Curriculum-dependent | Explicitly remap to validated new-edition reference while preserving Programme ID and department |
| Existing operational Course.title by globally unique code | Review needed | Shared code may have programme-specific titles/units; do not overwrite shared identity indiscriminately |

No business service or role checks have been changed during preparation.

## Storage and Concept Explainer

`src/lib/storage/supabase-storage.ts` uses configured SUPABASE_URL and service role credentials server-side. Bucket default is exactly `Akadverdse documents`, overridable via SUPABASE_COURSE_MATERIALS_BUCKET. CourseMaterial stores actual bucket/path and uploader/offering metadata. Inventory these exact records, then reconcile against live bucket objects and owners; never delete a bucket by name alone. LearningResource.fileUrl needs separate classification. Browser downloads use signed links and do not create server copies.

`faculty/materials/delete-material.ts` deletes the exact object, persists AI deletion intent, then removes material metadata. `ai-ingest/ingest-material.ts` and worker own durable cleanup retries. Preserve their outbox and call the existing service API through that integration; never modify concept_explainer tables. Retained materials retain their AI IDs; remapping needs explicit verification. Storage/AI operations cannot be rolled back by a PostgreSQL transaction.

## Review gate and execution order

1. Complete source validation, live inventory, storage reconciliation and restore verification.
2. Review inventory and explicitly choose retain/delete for lecturer source files.
3. Stage new reference edition; validate row counts and repeat-run idempotence.
4. Build a reviewed programme/semester activation plan through existing DAPU/HOD rules.
5. Pause relevant writes/workers during the approved execution window; recheck inventory drift.
6. Archive old operational curricula, reset approved dependent activity in FK order, and preserve identity/configuration.
7. Process exact approved storage/AI IDs with durable retries; retain metadata until failures are resolved.
8. Activate validated curricula and verify first-time experiences and authorization for every role.

Execution is intentionally unavailable in the inventory command. No destructive code runs at startup, deployment or import dry-run.

## UI preparation

The existing student CSS module is now applied by the shared Shell for faculty/lecturer, HOD, DAPU, dean and VC as well. It standardizes colors, navigation, header dimensions, spacing, cards, form focus, table hover and reduced-motion behavior without editing role services/actions or route destinations. Role-specific browser verification, loading/modal audits and full visual acceptance remain outstanding.

## Verification required before completion

- Programme hierarchy and programme/level/semester DAPU selection against new edition.
- Faculty review, HOD lecturer assignment, material access isolation, student registration and time/credit rules.
- Existing-account sign-in for student, faculty/lecturer, HOD and DAPU; unchanged user IDs, roles and credential hashes.
- Database and object restore rehearsal; reset drift detection and retry tests.
- Retained object access and deletion retrieval checks through Concept Explainer.
- Full test/build/lint checks and role UI at desktop, laptop, tablet and mobile widths.

This document records findings and open work; it is not a completion report or authorization to execute deletion.

## Live inventory results (12 November 2026)

Read-only inventory completed. SHA256: `8025b04d945ec6827dd21749193cf0959169f703e2fe1305b997c2f6f155ee8c`.

- Preserved identity inventory: 18 StudentProfile, 1 FacultyProfile, 1 HodProfile, 1 DapuProfile.
- Existing hierarchy: 4 colleges, 5 departments, 3 programmes; EEE/CPE/ICE share the existing EIENG department ID.
- Activity: 9 CourseRegistration, 63 CourseRegistrationItem, 1 Result, 1 StewartAttachment; no stored ChatConversation/ChatMessage records.
- Operational structures: 2 Curriculum, 11 CurriculumCourse, 2 CourseOffering, 2 CourseOfferingLecturer.
- Preserved configuration: 1 session, 2 semesters, 1 AcademicRule, 1 LevelAdvisorAssignment and 1 assignment-history row; 2 AcademicTimeFrame records require deliberate retention review.
- Existing reference: 1 document, 29 programmes, 482 distinct course identities, 1,539 programme-course records.
- Missing live tables: ClassroomSession, ClassroomQuestion, ClassroomQuestionVote, ClassroomPoll, ClassroomPollResponse. Missing is not empty; no schema repair executed.
- Policy catalog returned no policies in this connected database. RLS flags and grants are recorded privately; no policy/security changes executed.
- Live referenced Storage bucket contains 1 object; 1 material reference; 0 missing objects.
- User selected “Start fresh: delete inventoried lecturer files after final review.” This is the intended strategy, **not final execution approval**.

Exact file for final review:

- Bucket: `Akadverdse documents`.
- Path: `2026-2027/Alpha/cmuazjk3e0009vcr8yg9o186z/452cbdf6-dbf9-4bc2-b52f-09446a5ef131-WEEK-2-GST-312-Types-and-Theories-of-Conflict.pptx`.
- Material/AI document ID: `cmubh6jm7000dvcr8kbxvokkn`.
- Stored teaching association: **EEE 311 — Electric Circuit Theory I**, despite the filename referring to GST 312. Do not assume its filename identifies its current database course.
- Owner: faculty user ID recorded in private inventory.
- AI: existing INGEST task DONE, 6 chunks. Deletion must go through the existing API/outbox and be verified.

The offline reset plan is `.elearning-reset/inventory-1794486205128.json.plan.json`. It lists exact reset candidates, the file, proposed archive IDs and preservation counts. It does not execute deletion.

Candidate extraction now covers 34 programmes / 1,802 programme-course rows with 282 review warnings; see `ccmas-2023-source-review.md`. Three extraction regression tests and 14 existing Storage/AI tests passed. TypeScript and targeted ESLint passed during preparation. Final full-build result and role browser checks remain outstanding until recorded.
