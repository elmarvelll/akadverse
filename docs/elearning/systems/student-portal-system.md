# System: Student Portal

## Purpose

Dashboard, **Academic Essentials** (Course Control + **My Learning**), an intentionally empty **Study Zone**, and **Records & Analytics** (Results / GPA-CGPA / Academic History) — §12-§14. Course Control is documented separately: [`course-control-system.md`](course-control-system.md); how documents are uploaded and opened: [`course-materials-system.md`](course-materials-system.md).

## Actors

Student only (`requireElearningRole(["student"])` on every page).

## Sidebar

```text
Dashboard
Academic Essentials
  ├─ Course Control      (Course Registration · Add / Drop Course · Registration Status)
  └─ My Learning
Study Zone               (empty placeholder — no pages yet)
Records & Analytics      (Results · GPA / CGPA · Academic History)
```

Defined in `src/app/e-learning/_components/nav-config.ts`; `Sidebar.tsx` supports one nested level (Course Control inside Academic Essentials) and renders an empty group (Study Zone) as a plain label. The former Study Zone pages (My Courses, Learning Resources, Syllabus) were removed, not relocated — My Courses became My Learning, and course content now lives on each course's page.

## "My Learning" scope — the one rule everything else here depends on

A student's courses are their **`APPROVED`** `CourseRegistration`'s items for the *current* session/semester — nothing else. `services/e-learning/student/registered-courses.ts#getRegisteredCourses` is that one query (returns `[]` if no registration, or one that isn't `APPROVED` yet). Lecturers/coordinator come from the course's `CourseOffering` (what the HOD assigned), and only the student's own programme's offering is matched, so another programme's offering of the same course never leaks in.

## Routes

| Route | Reads |
|---|---|
| `/e-learning/student/dashboard` | `getCurrentAcademicContext`, `StudentProfile`, `getRegisteredCourses`, `getGpaCgpaSummary` |
| `/e-learning/student/my-learning` | `getRegisteredCourses` — code/title/units/level/type/lecturers per registered course |
| `/e-learning/student/my-learning/[courseId]` | `getRegisteredCourses` (authorization: 404 unless the course is in the student's approved registration) + `shared/offering-detail.ts#getOfferingDetail`. Sections: **Overview**; **Syllabus** (CCMAS *Course Contents*) and **Learning Outcomes** ("What You Will Learn" when there is no syllabus text) — each shown only when the linked CCMAS entry really has it, never invented; **Weekly Course Content** — a horizontal week slider whose weeks come from the semester's own start/end dates, with materials grouped Notes / Assignments / Quizzes. A multi-week document appears in every week it covers from one database row. Documents are clickable rows (no Download button). |
| `/e-learning/student/academic-records/results` | `student/results.ts#getAllResultsGrouped` — **`PUBLISHED` only**, grouped by session/semester |
| `/e-learning/student/academic-records/gpa-cgpa` | `#getGpaCgpaSummary` — current-semester GPA + CGPA, via `shared/grading.ts#computeGpa` |
| `/e-learning/student/academic-records/academic-history` | `#getAcademicHistory` — one row per session/semester with results, each with that semester's GPA and the running CGPA as of that point |

## Why only `PUBLISHED` results

Every query in `services/e-learning/student/results.ts` filters `status: "PUBLISHED"` — a student never sees a `DRAFT`/`SUBMITTED` result, even their own. See [`../data/workflow-states.md`](../data/workflow-states.md) for the full Result state machine and why HOD's own result approval collapses several spec'd stages into one action.

## GPA/CGPA computation

`services/e-learning/shared/grading.ts` — a 5-point letter-grade scale (`gradeForScore`) and a credit-unit-weighted average (`computeGpa`), used identically for a single semester's GPA and for CGPA (CGPA is just `computeGpa` over every published result instead of one semester's). Never hard-coded per §14's explicit rule — every number comes from actual `Result` rows.
