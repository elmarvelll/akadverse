# E-Learning — Workflow State Machines

Both state machines below are enforced **server-side only**, in `services/e-learning/**` — never assume a UI-disabled button is the actual gate.

## Course Registration (§15)

```text
DRAFT ──submit──▶ SUBMITTED ──Level Adviser approves──▶ PENDING_HOD ──HOD approves──▶ APPROVED
  ▲                    │                                      │
  │                    └──────────── Level Adviser rejects ───┴──────── HOD rejects ──▶ REJECTED
  └── Add/Drop edits a DRAFT (open Course Registration timeframe)
      or an APPROVED registration (open Change of Course timeframe) ──▶ (same status)
```

| Transition | Where | Guard |
|---|---|---|
| `DRAFT → SUBMITTED` | `services/e-learning/student/registration.ts#submitRegistration` | Caller owns the registration; at least one course added; `COURSE_REGISTRATION` time frame open for this session/semester. |
| `SUBMITTED → PENDING_HOD` / `REJECTED` | `services/e-learning/level-adviser/registrations.ts#approveRegistration`/`#rejectRegistration` | Student's `StudentProfile.departmentId`/`level` matches the caller's own Level Adviser scope; registration is currently `SUBMITTED`. |
| `PENDING_HOD → APPROVED` / `REJECTED` | `services/e-learning/hod/registration-approvals.ts#approveRegistration`/`#rejectRegistration` | Student's department matches the caller's `HodProfile.departmentId`; registration is currently `PENDING_HOD`. |
| Add/Drop item changes while `DRAFT` | `services/e-learning/student/registration.ts#addCourseToRegistration`/`#removeCourseFromRegistration` | `COURSE_REGISTRATION` time frame open. |
| Add/Drop item changes while `APPROVED` | same functions | `CHANGE_OF_COURSE` time frame open instead — a different, separate deadline (`timeFrameTypeForEdit` in that file picks which one applies based on current status). |
| Any other status (`SUBMITTED`, `PENDING_HOD`, `REJECTED`) | same functions | Edits rejected outright — nothing to add/drop while a decision is pending or already final. |

No transition beyond `DRAFT → SUBMITTED` is available to the student themselves — once submitted, it's out of their hands until Level Adviser/HOD act (or reject it back to a dead end; there is currently no "student may resubmit after rejection" path — a rejected registration stays `REJECTED`).

## Result (§32)

```text
DRAFT ──faculty submits course──▶ SUBMITTED ──HOD approves course──▶ PUBLISHED
```

| Transition | Where | Guard |
|---|---|---|
| Row created as `DRAFT` | `services/e-learning/faculty/results.ts#ensureResultRows` | Called on every visit to the entry page; upserts one row per currently-`APPROVED`-registered student, never overwrites an existing row. |
| Editing while `DRAFT` | `services/e-learning/faculty/results.ts#updateResultScores` | Row must still be `DRAFT`; score computation (`fullCA`/`totalScore`/`grade`/`gradePoint`) goes through `services/e-learning/shared/grading.ts`, never inline math. |
| `DRAFT → SUBMITTED` | `services/e-learning/faculty/results.ts#submitCourseResults` | Bulk, per **course** (every `DRAFT` row for that course+session+semester at once) — matches how faculty actually work (one course's result sheet), not per student. `RESULT_UPLOAD` time frame must be open. |
| `SUBMITTED → PUBLISHED` | `services/e-learning/hod/result-approvals.ts#approveResultUpload` | Bulk, per course, scoped to the HOD's own department. **This is a simplification** — see below. |

### Simplification: HOD collapses SUBMITTED → VALIDATED → APPROVED → PUBLISHED into one action

§32 names four intermediate stages (`SUBMITTED`, `VALIDATED`, `APPROVED`, `PUBLISHED`) but never assigns a role/screen to the `VALIDATED` or `APPROVED` checkpoints specifically, or says who performs the final publish — only that "HOD should also be able to approve result uploads submitted by faculty" (§23). Rather than invent an unspecified two-step HOD/DAPU handoff, `approveResultUpload` moves a course's results directly from `SUBMITTED` to `PUBLISHED` in one HOD action. The `VALIDATED`/`APPROVED` enum values still exist on `ResultStatus` (so a real intermediate stage can be added later without a schema migration) but nothing in this codebase currently writes them. Full reasoning: [`../decisions/hod-result-upload-collapses-workflow.md`](../decisions/hod-result-upload-collapses-workflow.md).

Only `PUBLISHED` results are ever shown to the student they belong to (`services/e-learning/student/results.ts` filters on `status: "PUBLISHED"` in every query) — every earlier status is faculty/HOD-internal. HOD's own result views (`services/e-learning/hod/results.ts`) show every status, as an oversight view of results moving through the pipeline.
