// services/e-learning/dapu/course-structure.ts
//
// DAPU — Course Structure (AGENTS.md §26).
//
// Simplification, documented rather than silently assumed: the spec
// describes a three-stage workflow (Receive Structure / Review Structure /
// Send to HOD) but doesn't specify what artifact is actually "received" or
// what distinguishes a course being "reviewed" from being "sent" — no
// separate staging model exists to receive from, and Course itself is
// already the concrete artifact HODs need (to assign lecturers against,
// AGENTS.md §22). Modeling a separate CourseStructure staging entity here
// would be guessing at a workflow AGENTS.md §39 explicitly warns against
// guessing at. So this module is the practical version: DAPU manages the
// Course catalog directly (Faculty -> Department -> Program -> Level ->
// Semester -> Courses, per §26's own hierarchy) and it's immediately
// usable by HOD — there's no separate "not yet sent" state a course sits
// in. If a real staged review process is specified later, this is the
// module to extend with it.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest } from "@/lib/service-error";

export async function listAcademicFaculties() {
  return elearningDb.college.findMany({ include: { departments: true }, orderBy: { name: "asc" } });
}

// Add Course: creates ONLY the reusable Course record (spec: it must not create or touch
// any curriculum). A course is used later from Course Structure (Select Elective Course).
export async function listCourses() {
  return elearningDb.course.findMany({
    include: { department: { select: { name: true } }, _count: { select: { curriculumCourses: true } } },
    orderBy: { code: "asc" },
  });
}

export async function createCourse(params: {
  code: string;
  title: string;
  creditUnits: number;
  // Optional: shared courses belong to no single department.
  departmentId?: string | null;
  description?: string | null;
}) {
  const code = params.code.trim().replace(/\s+/g, " ").toUpperCase();
  const title = params.title.trim();
  if (!code || !title) throw badRequest("Course code and title are required.");
  if (!Number.isInteger(params.creditUnits) || params.creditUnits <= 0 || params.creditUnits > 30) {
    throw badRequest("Credit units must be a whole number from 1 to 30.");
  }
  if (params.departmentId && !(await elearningDb.department.findUnique({ where: { id: params.departmentId } }))) {
    throw badRequest("That department doesn't exist.");
  }

  // Reuse: never a second Course with the same code.
  const existing = await elearningDb.course.findUnique({ where: { code } });
  if (existing) return { course: existing, created: false as const };

  // CCMAS courses are picked from the CCMAS list on Course Structure, so the source stays accurate.
  if (await elearningDb.cCMASCourse.findFirst({ where: { code }, select: { id: true } })) {
    throw badRequest(`${code} is a CCMAS course code — select it from the CCMAS list on Course Structure instead.`);
  }

  const course = await elearningDb.course.create({
    data: { code, title, creditUnits: params.creditUnits, departmentId: params.departmentId || null, description: params.description?.trim() || null },
  });
  return { course, created: true as const };
}
