# E-Learning — Documentation

> **Status check first:** this documentation describes the E-Learning system **as it actually exists in the codebase today** (last verified 2026-09-21). It is a separate academic domain inside the AkadVerse monorepo, alongside the existing Marketplace (`src/app/studashboard/marketplace/`, documented at [`../marketplace/`](../marketplace/README.md)) — the two share one AkadVerse identity/login but are otherwise independent: separate database, separate Prisma client, separate route tree (`src/app/e-learning/`).
>
> Phases 1-6 of the original spec — [`spec.md`](spec.md), referenced throughout this codebase's comments and this doc set as "§N" — are built: Foundation, Student, Faculty, Level Adviser, HOD, DAPU. **Note**: those comments say "AGENTS.md §N"; that's a naming mistake made early on — see [`spec.md`](spec.md)'s own header note and the repo's `AGENTS.md` for the correction. Dean and VC are **deliberately** placeholder-only — see [`decisions/dean-vc-not-implemented.md`](decisions/dean-vc-not-implemented.md). Where this system takes a simplification or a judgment call the spec didn't fully settle, that's recorded in [`decisions/`](decisions/) rather than silently assumed — check there before treating an absence as a bug.

## What the E-Learning system is

A role-based academic portal at `/e-learning/<role>/...` for six roles — Student, Faculty, HOD, DAPU, Dean, VC — sharing one login with the Marketplace but backed by its own Postgres database (`ELEARNING_DATABASE_URL`). It covers the full academic lifecycle currently built: session/semester administration, course catalog, course registration with a three-step approval chain (student → Level Adviser → HOD), learning resources and syllabus, result entry and a one-step HOD approval-and-publish, GPA/CGPA, and a DAPU-controlled academic calendar/deadline/timetable layer.

## Who uses it

- **Student** — dashboard, Course Control (Course Registration, Add/Drop, Registration Status), **My Learning** (registered courses, syllabus/outcomes, weekly documents), Records & Analytics (Results, GPA/CGPA, Academic History). Study Zone is an empty placeholder.
- **Faculty** — dashboard (timetable), **My Subjects** (assigned offerings, weekly content, document upload), Results Record (entry + submit).
- **Level Adviser** — not a role, a responsibility a Faculty account can additionally hold (`FacultyProfile.isLevelAdviser`); reviews/approves registrations for their own department+level.
- **HOD** — reviews/approves course structures (approval publishes them), assigns lecturers (several + one coordinator) and Level Advisers (with history), approves registrations and result uploads, views results by level/course/student — scoped to their own department.
- **DAPU** — academic session/semester administration, academic time frames (five deadline types), timetable review/approval, course catalog ("course structure").
- **Dean / VC** — placeholder routes only, no functionality (§29).

## Major systems

| System | Doc |
|---|---|
| Two-database architecture, identity resolution, route protection | [`architecture.md`](architecture.md) |
| **Service layer** — every service file by role tier, import rules | [`services.md`](services.md) |
| Login/signup account-type domains, dev-test role override | [`systems/authentication-and-domains.md`](systems/authentication-and-domains.md) |
| Common layout/sidebar, role-based nav | [`systems/layout-and-navigation.md`](systems/layout-and-navigation.md) |
| Academic calendar (session/semester/time frames) | [`systems/academic-calendar-system.md`](systems/academic-calendar-system.md) |
| Student portal (My Learning, Records & Analytics) | [`systems/student-portal-system.md`](systems/student-portal-system.md) |
| Course Control (registration/add-drop/status) | [`systems/course-control-system.md`](systems/course-control-system.md) |
| Course documents (upload to Supabase Storage, secure access) | [`systems/course-materials-system.md`](systems/course-materials-system.md) |
| Faculty portal (My Subjects, results, timetable) | [`systems/faculty-portal-system.md`](systems/faculty-portal-system.md) |
| Level Adviser | [`systems/level-adviser-system.md`](systems/level-adviser-system.md) |
| HOD (assignments, approvals, results) | [`systems/hod-system.md`](systems/hod-system.md) |
| DAPU (course structure, time frames, timetable) | [`systems/dapu-system.md`](systems/dapu-system.md) |

## How this documentation is organized

- [`spec.md`](spec.md) — the original specification, verbatim, §1-§45. Every "§N" citation elsewhere in this doc set and in code comments points here.
- [`services.md`](services.md) — where every service function lives (`services/e-learning/<tier>/`) and the rules for adding one.
- [`architecture.md`](architecture.md) — the two-database split, cross-database identity resolution, authorization layering, route protection.
- [`systems/`](systems/) — one file per system: purpose, actors, data, routes/actions, workflow.
- [`data/schema.md`](data/schema.md) — every model, why it exists, and its relation to the Core database.
- [`data/workflow-states.md`](data/workflow-states.md) — the `CourseRegistration.status` and `Result.status` state machines, including where this implementation stops short of the full spec'd workflow and why.
- [`decisions/`](decisions/) — recorded judgment calls, each with what was chosen and why.
- [`todo/roadmap.md`](todo/roadmap.md) — phase-by-phase status and the honest remainder.

## Where to start

1. Read this README, then [`architecture.md`](architecture.md).
2. Read [`data/workflow-states.md`](data/workflow-states.md) — the registration and result state machines that every role-specific system doc refers back to.
3. Read [`data/schema.md`](data/schema.md) alongside `prisma/elearning/schema.prisma`.
4. Check [`todo/roadmap.md`](todo/roadmap.md) before starting new work.
