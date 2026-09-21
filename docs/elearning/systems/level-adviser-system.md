# System: Level Adviser

## Purpose

Course-registration review for one department+level — §20. Not a role; a responsibility a `faculty` account can hold (`FacultyProfile.isLevelAdviser` + `levelAdviserOf`).

## Actors

Faculty with `isLevelAdviser: true` only. The Level Adviser section of the sidebar (`src/app/e-learning/_components/nav-config.ts#getFacultyNav`) only appears when that flag is true — checked server-side in `layout.tsx`, not just hidden in the UI.

## Scope enforcement

`services/e-learning/level-adviser/registrations.ts` — every function takes the adviser's own `FacultyProfile` and filters strictly by `adviser.departmentId` + `adviser.levelAdviserOf`; never trusts a department/level the caller claims separately (§20: "must only see students belonging to the relevant academic scope"). `requireLevelAdviserProfile` (`services/e-learning/shared/auth.ts`) is what confirms the flag is actually set before any of this runs.

## Routes

| Route | Function | Shows |
|---|---|---|
| `/e-learning/faculty/level-adviser/registrations` | `getRegistrationsInScope` | Every registration in scope, any status (`SUBMITTED`/`PENDING_HOD`/`APPROVED`/`REJECTED`) — read-only overview. |
| `/e-learning/faculty/level-adviser/approvals` | `getPendingApprovals` | Just the `SUBMITTED` ones actually waiting on this adviser, with Approve/Reject forms. |

## Workflow slice owned here

`SUBMITTED → PENDING_HOD` (approve) or `SUBMITTED → REJECTED` (reject, with an optional note). `DRAFT → SUBMITTED` is the student's own action (Student Portal); `PENDING_HOD → APPROVED/REJECTED` is HOD's. Full state machine: [`../data/workflow-states.md`](../data/workflow-states.md).

## How someone becomes a Level Adviser

Only via HOD's Assign Level Advisers screen (`hod-system.md`) — there's no self-service or Level-Adviser-side way to acquire the responsibility, matching §22 ("HOD should also be able to assign Level Advisers").
