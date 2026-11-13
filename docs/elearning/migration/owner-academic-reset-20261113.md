# Owner-preserving academic reset — 13 November 2026

Status: academic cleanup executed and verified; the user cancelled all account deletion and requested promotion of existing 300-level students to 400 Level.

## Preservation audit

Read-only audit identified 7 accounts whose first/last names exactly match Marvelous Ifezue (case-insensitive), and 16 other accounts. No candidate deletion account contains a Marvelous/Ifezue email alias. Owner IDs/emails/roles and candidate IDs remain in the private audit, not this document.

The exact EEE 400-level structure is `cmweskvek0001l307cwqoftfk`: Alpha semester, RETURNED status, 7 courses. Preserved course codes: GET 402, GET 299, EEE434, EIE453, EIE438, EIE452, EIE434. Codes and titles were not normalized, recreated or overwritten. EEE remains the programme under the existing EIENG department.

The preservation snapshot includes curriculum, programme/department, semester, course placements, course catalogue fields/descriptions/credits and offering metadata. Lecturer relationships are deliberately excluded because their removal is requested. Snapshot SHA256 before and after cleanup: `17f123765265e107ae588a0416ee861d2ac6b1936c739a11027ac0ea4e45da1c`.

## Completed production cleanup

- CourseAssignment: 0 records existed; verified empty.
- CourseOfferingLecturer: 0 existed; verified empty.
- CourseRegistration, CourseRegistrationItem, StudentCourseRegistration: 0 existed; verified empty across sessions.
- LevelAdvisorAssignment: deleted 1.
- LevelAdvisorAssignmentChange: deleted 1 associated history record.
- FacultyProfile: cleared derived adviser pointer, flag and level together; verified no remaining adviser responsibility. Faculty identities, departments and lecturer base roles remain intact.
- Course, Curriculum, CurriculumCourse, CourseOffering and all Core account records: no deletion or rewriting.

Runner: `scripts/academic-reset/reset-academic.ts`. It defaults to dry-run, requires verified backup checksums before execution, checks the exact preservation snapshot, uses a serializable transaction with write locks, and atomically creates an attempt receipt before deletion. Repeating the same audited execution is refused. An interrupted STARTED receipt requires manual verification, not blind rerun.

Private receipt: `.elearning-reset/owner-reset-audit-1794590668745.json.academic-execution.json`.

## Account-deletion conflict — no account deleted

Deleting the 16 other accounts would affect at least these direct relationships:

| Model | Referencing records |
| --- | ---: |
| Business | 5 |
| Order | 11 |
| CheckoutPayment | 9 |
| VendorDeliveryBooking | 6 |
| Deliverer | 1 |
| BusinessReport | 1 |
| CartItem | 8 |
| Notification | 42 |

Business/order cascades have further dependencies. A blanket User.deleteMany would either remove marketplace history or encounter restrictive foreign keys. This conflicts with the instruction to avoid unrelated application-data deletion. No Core deletions have been attempted. The user has been asked whether to preserve that history and leave linked accounts pending a removal plan, or include the linked marketplace history in account removal. A final dependency/deletion plan is still required once that preference is resolved.

Authentication uses stateless JWT sessions; Prisma has no login Session/Account tables to delete. The existing JWT callback caches roles at sign-in. Any subsequent account-removal strategy must explicitly handle old JWT access rather than assuming deleting User rows alone revokes signed tokens. No owner credentials, role definitions, permissions or JWT secret were changed.

## Implemented application changes

`SIGNUP_SCOPE.levels` now contains 300 and 400. Signup options are read by the existing frontend from this shared backend scope. The same scope validates submitted academic selections, and createStudentProfile persists numeric level 400. No database enum/schema migration is required because profile/course levels are integers.

HOD Level Advisers now has Unassign Adviser with confirmation, pending feedback, success/error messages and preserved filters. The server re-derives the HOD session/department, locks the assignment, rejects cross-department requests and stale faculty confirmations, clears a current faculty pointer/flag atomically, removes that relationship and synchronizes derived state. It does not delete the lecturer or touch their course assignments. Assignment change rows cascade with the removed assignment according to the existing schema.

## Verification and backups

- New onboarding test: 400 is offered, accepted server-side, persisted, and starts without registrations; an unsupported level is rejected.
- New unassignment test: assignment succeeds, foreign HOD and stale confirmation fail, unassignment clears derived flags, faculty profile/account and unrelated lecturer-course role remain.
- Full regression suite: 217/217 passed.
- TypeScript and targeted ESLint passed.
- Read-only dry-run verified the production seven-course snapshot before execution.
- Both production public schemas were backed up in private custom-format PostgreSQL dumps: `.elearning-reset/owner-backup-1794590935740/manifest.json`.
- Both backups restored in disposable network-isolated PostgreSQL 17 containers. All 23 Core account IDs were present in the restore. The 7 EEE 400 records matched IDs, codes, titles, descriptions, credit units, semester and review status.
- Academic reset rehearsed against a separate loopback-only restored copy; preservation passed, and repeat execution was refused.
- Live academic cleanup verified zero assignments/registrations and an unchanged EEE 400 structural fingerprint.

No production test account or test registration was created. Existing-account password-based manual sign-in and browser acceptance remain untested. The changes are in the workspace; hosted deployments need the normal code deployment to expose the new UI and signup option. The new audit/reset scripts are never invoked by startup, build or ordinary deployment.

## Revised instruction: keep every account

The user explicitly cancelled account deletion. No accounts or linked marketplace history will be removed. The 16-account deletion proposal is withdrawn. A separate profile-only promotion updates existing StudentProfile.level values from 300 to 400, with a private pre-change snapshot and transactional verification that every other profile field (except its automatic updatedAt timestamp) remains unchanged. Courses, curricula, semester allocations and lecturer/adviser responsibilities are not promoted or rewritten.

Promotion completed and verified: 18 profiles updated; all 18 existing students are now at 400 Level; zero remain at 300. No account deletion occurred. Private before-state/receipt: `.elearning-reset/student-promotion-1794592292706.json` and its `.receipt.json` companion.
