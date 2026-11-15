# CCMAS 2023 implementation and final reset review

Status: **approved live reset completed; programme links now use CCMAS 2023**. This is not a claim that the full project definition of done has been reached.

## A. Curriculum

Source: `src/lib/resources/Engineering-Technology-CCMAS-2023-FINAL.pdf` (the supplied 1,332-page PDF), SHA256 `99030f5f3c5593246ec80178a2a84e562da384173ddc5be71e08d1bfb3e943fe`.

Staged as a separate `NUC/CCMAS`, version `2023`, alongside the untouched 2021 edition:

- 34 programmes; 557 distinct reference course identities; 1,802 programme-course placements.
- Every stored course placement field was compared against the extracted source JSON and the import receipt. Programme/course identities and exact counts also matched.
- All programmes and source-page ranges are listed in `ccmas-2023-source-review.md`.
- 282 source/extraction warnings remain visible for review. User selected course-table credit units over conflicting detailed descriptions. DAPU's editor displays course-specific warnings only for the matching source checksum.
- User selected DAPU semester allocation followed by existing HOD approval. No semester is inferred from course-number parity. No curricula are auto-published.
- The extractor now handles all TOC programme boundaries, alternative contents headings, new glossary codes, the printed ICE “200 Leve” heading and running footers. The old source and JSON remain available.
- New default extraction/import paths point to 2023. Historical import remains possible by passing the older JSON explicitly with its original version.
- Import inserts are batched, remain resumable and idempotent, and refuse to replace an edition's provenance with a different PDF checksum. A completed import receipt gates DAPU reference linking, so partial editions cannot be selected.
- No Prisma schema changes were necessary for reference versions, programme-specific credits/titles/outcomes or prerequisite text. Existing DAPU/HOD operational models and their approval workflow remain in use.

**Still pending:** switch the three operational programme pointers to the staged reference and archive the old operational structures under the approved reset. Preserve existing programme IDs, names and department IDs; EEE/CPE/ICE stay under EIENG (the institutional EIE group). DAPU must then build the new semester allocations; HOD must approve them before students can register.

## B. Proposed database reset — final review required

| Action | Actual records |
| --- | ---: |
| Delete CourseRegistration | 9 |
| Delete dependent CourseRegistrationItem | 63 |
| Delete Result | 1 |
| Delete CourseOfferingLecturer assignments | 2 |
| Delete StewartAttachment metadata and request upstream attachment cleanup | 1 |
| Delete Core Notification rows **only where scope = ELEARNING** | 32 |
| Delete material metadata after verified exact-object/AI cleanup | 1 |
| Archive old Curriculum records (preserve their historical course placements/offering containers) | 2 |
| Relink existing Programme IDs to their 2023 references | 3 |

Other reset-candidate tables currently have no rows. Five classroom tables are absent in the live database; this is explicitly recorded as a schema mismatch, not a successful empty-state query. The runner refuses schema drift if these tables appear after the reviewed inventory. No classroom migrations were applied as part of this task.

Preserve:

- All **23 Core accounts**, identity fields, credential hashes and roles, checked through private fingerprints; no raw credentials are exported.
- 18 StudentProfile, 1 FacultyProfile, 1 HodProfile, 1 DapuProfile.
- Existing college/department/programme IDs, names and relationships, 1 session, 2 semesters.
- AcademicRule, LevelAdvisorAssignment and its history, adviser permission flags and DAPU's 2 AcademicTimeFrame configurations.
- Both CCMAS reference editions, archived curriculum relationships and reusable Course records.
- AI cleanup outbox records needed for durable audit/retries.
- Marketplace notifications and all unrelated platform data.

Nothing in this table has been deleted from the live environment. Programme relinking and curriculum archiving have not executed.

Private reviewed plan: `.elearning-reset/review-plan-2023-final.json`.

Plan SHA256: `2af5bf1de4299a8a34738a1551e703a1bd7016eed273f3fff8c4ce71158094ef`.

## C. Storage

Live reconciliation found one object in the referenced academic bucket, one matching material record and zero missing objects. No bucket deletion is proposed.

Exact object awaiting final review:

- Bucket: `Akadverdse documents`.
- Path: `2026-2027/Alpha/cmuazjk3e0009vcr8yg9o186z/452cbdf6-dbf9-4bc2-b52f-09446a5ef131-WEEK-2-GST-312-Types-and-Theories-of-Conflict.pptx`.
- Material/AI ID: `cmubh6jm7000dvcr8kbxvokkn`.
- Uploader user ID: `0ed138ab-1ff9-4637-bc08-98e27577c8ba`.
- Current database course: **EEE 311 — Electric Circuit Theory I**. The filename refers to GST 312; this pre-existing mismatch is deliberately reported rather than silently remapped.
- Size: 57,993 bytes; existing AI ingestion reports 6 chunks.

User selected **start fresh: delete inventoried lecturer files after final review**. This strategy selection is not treated as the final execution approval. Browser downloads are local device copies; the reset cannot erase files already downloaded by users.

The file is backed up privately with its original bucket/path metadata and verified checksum. No Storage object has been deleted.

## D. Concept Explainer

Deletion uses the existing authenticated service adapter and durable AiIngestTask outbox. The runner targets only approved document IDs, waits out/blocks uncertain leases, verifies document-status absence, and leaves retriable intent if the API fails. It never opens or changes the service-owned concept_explainer schema. Temporary Stewart attachment cleanup uses the existing attachment API.

Live document deletion requests executed: **0**. Live retrieval deletion verification is pending the approved reset.

## E. UI standardisation

The shared student portal CSS now applies to lecturer/faculty, HOD, DAPU and other academic roles through Shell. Their existing routes, server actions, filters, approval handlers, role checks and forms remain in place.

Shared improvements cover colors, page-heading typography, surfaces/shadows, header/sidebar dimensions, spacing, page entry, navigation hover, table hover, input/button focus, button feedback and reduced-motion behavior. Heading styles are scoped to page headings to avoid enlarging compact document/classroom headings. Mobile backdrop positioning matches the shared 56px header. Shared skeletons respect reduced-motion preferences.

DAPU Course Structure additionally presents source discrepancy details without changing course selection, units validation, programme/level filters or the approval state machine.

No role-specific feature was replaced with a mock dashboard. **Full authenticated visual checks at desktop/laptop/tablet/mobile sizes remain outstanding.**

## F. Verification

- Complete final regression suite: **215/215 passed**, including the new DAPU integration scenario.
- New DAPU integration scenario passed: filters by programme/level/semester; rejects unrelated hierarchy/level IDs; preserves course-table units; repeated save creates no duplicate placement; original semester curriculum remains published; partial reference linking is blocked; completed reference linking works.
- Three Python extraction regression tests passed.
- Full 2023 local import and repeat import passed with zero duplicate programme/course/placement creation on repeat. Batched creation was also tested using a separate local reference version.
- Live reference verification matched 34 programmes, 557 identities and all 1,802 placements against the source JSON and SHA-identified import receipt.
- Real pre-change database backup restored in a new network-isolated PostgreSQL 17 container: all 38 existing model counts matched the original inventory. Source binary checksum matched.
- Full reset rehearsal in newly created local-only databases passed, including approved record clearing, scoped notification deletion, unchanged account fingerprints and retained EIE hierarchy. Repeating the same execution was safe.
- An injected AI 503 failed closed before academic records were cleared; durable cleanup intent survived and the subsequent retry completed successfully.
- TypeScript and targeted ESLint passed. Full repository lint passed with **0 errors and 7 existing warnings**.

Build limitations (unresolved; original native loader retained): the normal Turbopack build could not fetch configured Google fonts in the sandbox; retrying with network access hit an OS-denied worker-port bind. The supported Webpack fallback compiled and completed TypeScript, then failed page-data collection in the existing native Prisma loader (`module.createRequire failed parsing argument`, followed by `(void 0) is not a function`). No successful production build is claimed. These infrastructure/loader issues were not hidden by weakening application behavior.

Existing-account manual sign-in with real passwords and authenticated browser UI acceptance have not been performed. Fingerprint preservation is verified in the rehearsal; the same before/after verification is enforced for live execution.

## G. Operation, deployment and recovery

No new runtime environment variables or application dependencies are required. Backup/rehearsal tooling uses Docker with PostgreSQL 17 (the live server is PostgreSQL 17.6). Administrative commands use existing E-Learning/Core/Storage/AI credentials server-side.

```sh
# Non-destructive verification
npm run ccmas:verify
npm run db:elearning:reset -- --plan .elearning-reset/review-plan-2023-final.json --dry-run
npm run test:ccmas:extract
npm run test:elearning:reset
```

Execution is separate and requires the exact approved plan hash, a verified backup manifest, the bound Core inventory and explicit confirmation that academic writes/workers are stopped. It is never invoked by build, startup or ordinary deployment.

**Do not run the following until final inventory approval and the maintenance window are confirmed:**

```sh
npm run db:elearning:reset -- \
  --plan .elearning-reset/review-plan-2023-final.json \
  --execute \
  --approved-plan-sha 2af5bf1de4299a8a34738a1551e703a1bd7016eed273f3fff8c4ce71158094ef \
  --backup .elearning-reset/backup-1794486789047/manifest.json \
  --core-inventory .elearning-reset/core-inventory-1794487072335.json \
  --maintenance-confirmed
```

The runner checks source provenance/counts, backup/object checksums, original row equality, schema drift and Core identity fingerprints before acting. It targets approved object IDs, uses a serializable transaction for academic reset/archive/relink, and scopes the separate Core transaction to reviewed E-Learning notification IDs. A private execution journal supports retry and records cross-system progress. Drift stops execution for renewed review; it does not silently expand deletion scope.

Recommended order: resolve build/browser acceptance; confirm inventory; stop academic writes/workers; recheck drift; execute approved cleanup/reset; verify identities and all role first-time states; restart services; DAPU allocates new courses; HOD approves; students register.

Private backup: `.elearning-reset/backup-1794486789047/manifest.json`. The custom dump covers the E-Learning public schema, including old curriculum data; inventory additionally records policies/RLS flags/grants. Source-object bytes and metadata are included. Backup/restore verification creates only a disposable local container and never restores over live data.

Recovery is a separate reviewed operation: stop writes, compare any post-backup changes, restore the E-Learning dump using PostgreSQL 17 tooling, restore the exact source object to its recorded bucket/path, and replay ingestion through the AI service's supported workflow where necessary. PostgreSQL restore alone cannot restore deleted external AI chunks. Core credentials are never restored or changed by this reset workflow; reviewed scoped notifications have their private inventory for recovery. Never run an unreviewed blanket restore over new user activity.

## Subsequent classroom repair — 12 November 2026

The reported P2021 classroom failure was repaired using `prisma/elearning/patches/20261112_classroom_tables.sql`, generated from the existing Prisma schema and validated locally before live application. It adds only the five classroom tables, four enums, indexes and foreign keys; no reset, account change or data deletion was performed. Earlier statements that these tables are missing describe the pre-repair inventory.

**The old reset inventory/plan must now be refreshed before execution.** Its schema-drift guard intentionally rejects execution after the missing classroom tables have been created. This repair does not approve or execute the pending reset.

## Live execution completed — 12 November 2026

The user approved the reset, explicitly approved clearing the newly created EEE 311 live class, and requested execution without a manual maintenance pause. The runner used online mode with serializable transaction write locks, snapshot checks and account fingerprint verification. Interrupted connection attempts were retried safely.

Execution receipt: `.elearning-reset/approved-online-reset.json.execution.json`, verified at 23:42 WAT. Academic and scoped Core transactions completed. All 23 account fingerprints matched. Cleared 9 registrations, 63 items, 1 result, 2 lecturer assignments, 1 classroom session, 1 expired Stewart attachment and 32 E-Learning notifications. Archived 2 old curricula and relinked the existing EEE/CPE/ICE Programme IDs to the verified 2023 references. Original teaching offering/course containers remain historical.

The PowerPoint had already been removed through the application before this execution. Its queued AI deletion was completed and its status endpoint confirmed absence. No bucket deletion was performed.

Read-only live role checks passed: 18 preserved students see no old registrations/study courses; the lecturer has no old subjects; the HOD has no pending old curricula; DAPU has clean working structures and populated 2023 references for all three programmes at 300 level. EEE/CPE/ICE remain under EIENG. No live classroom rows, course materials or pending AI deletion jobs remain. Receipt: `.elearning-reset/role-verification-1794523483071.json`.

The full local regression suite passed again after execution: 215/215 tests, zero failures. This does not substitute for authenticated browser verification; production build/browser limitations recorded above remain outstanding.

DAPU must allocate the new courses to semesters and submit them for the existing HOD approval workflow before students can register. Refresh dashboards to load the clean state. Historical pre-execution sections above describe the reviewed proposal; this section supersedes their pending-reset status.

LiveKit verification also completed: the exact approved EEE 311 media room was absent (0 rooms returned). Receipt: `.elearning-reset/classroom-media-verification.json`.
