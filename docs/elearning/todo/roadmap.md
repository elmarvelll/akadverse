# E-Learning — Roadmap & Honest Remainder

Last verified 2026-09-14. Phase numbers match §44.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1 — Foundation | ✅ Done | Separate DB/client, session/semester, role handling, all four profiles, layout/sidebar, proxy/session/role/scope authorization. |
| 2 — Student | ✅ Done | Dashboard, My Learning (replaced My Courses/Learning Resources/Syllabus; Study Zone left empty), Records & Analytics (Results, GPA/CGPA, Academic History), Course Control. |
| 3 — Faculty | ✅ Done | Dashboard + timetable, My Subjects (assigned offerings, weekly content, document upload), Results Record entry+submit. |
| 4 — Level Adviser | ✅ Done | Registrations view, Approvals (approve/reject), department+level scoped. |
| 5 — HOD | ✅ Done | Lecturer/Level-Adviser assignment (+ history), registration + result-upload approvals, results by level/course/student. |
| 5b — Course documents | ✅ Done | Lecturer upload → Supabase Storage, secure signed access; see [`../systems/course-materials-system.md`](../systems/course-materials-system.md). |
| 6 — DAPU | ✅ Done | Session/semester admin, 5 time-frame types, timetable review/approve, course catalog. |
| Service layer | ✅ Done | All logic moved to `services/e-learning/<tier>/`; see [`../services.md`](../services.md). Open item: `dapu/offerings.ts` is unused and needs a keep/delete decision. |
| 7 — Dean/VC | 🚫 Deliberately not started | See [`../decisions/dean-vc-not-implemented.md`](../decisions/dean-vc-not-implemented.md) — waiting on explicit requirements, per §29/§44. |

Every phase above was verified against the live dev server with real accounts and real data (registered through the actual `/api/register` flow, driven through the actual module functions), not just read for correctness — see each phase's summary in conversation history / commit log for what was specifically checked.

**One real gap that testing missed and a user report caught**: `src/proxy.ts`'s `ROLE_HOME_PATHS` sent `faculty` to the old Marketplace-side `/facultydashboard` stub (a bare "Coming soon" page with no link to `/e-learning/faculty/...` anywhere on it) instead of the real, built Faculty portal — so a faculty user signing in normally never actually saw any of Phase 3's work. Every Phase 3 verification hit `/e-learning/faculty/*` routes directly rather than signing in and following the normal landing flow, which is how this stayed unnoticed. Lesson for future verification passes on this codebase: test the actual sign-in → landing-page flow per role, not just the destination routes directly.

The first fix (routing `faculty` straight to `/e-learning/faculty/dashboard`, matching hod/dapu/dean/vc) was itself superseded a message later, once it was clear the user wanted `/facultydashboard` to be a real **hub page** — same pattern as `/studashboard` for students — rather than skipped past entirely. `src/app/facultydashboard/page.tsx` is now a card grid (Main Menu, E-Learning, AI Studio — no Marketplace/Productivity Layer card, since faculty has no Marketplace access), and `faculty` in `ROLE_HOME_PATHS` points there again. "Main Menu" and "AI Studio" are both `ComingSoon` placeholders (`/facultydashboard/main-menu`, `/facultydashboard/ai-studio`) — the same status those workspaces have on the student side, except the faculty "AI Studio" route actually exists (the student one, `/studashboard/ai-studio`, currently 404s — pre-existing, not touched here).

## Documented simplifications (not bugs — see the linked decision for reasoning)

- [`../decisions/hod-result-upload-collapses-workflow.md`](../decisions/hod-result-upload-collapses-workflow.md) — `SUBMITTED → PUBLISHED` skips the spec's unassigned `VALIDATED`/`APPROVED` checkpoints.
- [`../decisions/course-structure-is-catalog-management.md`](../decisions/course-structure-is-catalog-management.md) — DAPU's "Course Structure" is direct catalog CRUD, not a staged Receive/Review/Send pipeline.
- [`../decisions/timetable-send-to-hods-is-approval.md`](../decisions/timetable-send-to-hods-is-approval.md) — "Send to HODs" is a confirmation view of what `isApproved` already made visible, not a separate action.

## Genuine gaps / rough edges

- **Authorization failures render as raw 500s.** A thrown `ServiceError` (wrong course, no profile, wrong scope) in a server component isn't caught into a styled "forbidden" page anywhere in `src/app/e-learning/**` — it's correctly *rejected*, just not nicely presented. A shared error boundary (`error.tsx` at the `e-learning/` route root, catching `ServiceError` and rendering by status code) would fix this in one place.
- **`FacultyProfile.isLevelAdviser`/`levelAdviserOf` and `HodProfile` are current-responsibility-only, not historical.** The schema comments call this out and describe the planned evolution (a `LevelAdviserAssignment` model keyed by faculty+department+level+session+semester, per §5/§40) — not built, since no phase's workflow needed to query *past* advisers/HODs yet.
- **`TimetableEntry` has no overlap/conflict validation.** DAPU can create two entries for the same course/day/time, or a faculty member double-booked across two courses at once — nothing currently checks.
- **No self-service path after a registration/result is rejected.** `REJECTED` is a dead end in both state machines — no "student may resubmit" or "faculty may re-enter and resubmit" transition exists. Whether that's actually desired behavior (a rejection requiring a fresh registration/manual intervention) wasn't specified either way.
- **Marketplace's `requireStudent()` helper (`src/lib/marketplace-auth.ts`) exists but isn't wired into every existing `/api/marketplace/**` route** — `src/proxy.ts` blocks non-students from the whole `/api/marketplace*`/`/studashboard/marketplace*` prefix centrally, which covers §9's requirement, but individual route handlers don't additionally call `requireStudent()` themselves. Low risk (the proxy check is the actual boundary in production) but not defense-in-depth at the handler level the way the E-Learning system's scope checks are.
- **No admin UI for `AcademicFaculty`/`Department`/`Program` themselves** — only `Course` has a DAPU-facing create form (`/e-learning/dapu/course-structure/receive`). Faculties/departments/programs currently only get created via `scripts/elearning-seed.ts` or direct DB access. Not specified anywhere as a DAPU (or any role's) responsibility, so not built speculatively.
- **`scripts/elearning-seed.ts`** seeds one department (EEE), three courses, a current session/semester, an open Course Registration window, and links the four `marvelousifezue31@*` dev-test profiles if those accounts already exist. Re-run after creating a new dev-test-role account. Not meant for anything beyond local development.
