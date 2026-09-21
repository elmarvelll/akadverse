// services/e-learning/hod/result-approvals.ts
//
// HOD — Result Upload approval (AGENTS.md §23), scoped to the HOD's own department.
//
// This implementation collapses AGENTS.md §32's SUBMITTED -> VALIDATED -> APPROVED -> PUBLISHED into a single
// HOD action (SUBMITTED -> PUBLISHED); see docs/elearning/decisions/hod-result-upload-collapses-workflow.md.

import { elearningDb } from "@/lib/db/elearning";
import { forbidden } from "@/lib/service-error";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import type { HodProfile } from "@/generated/prisma-elearning";

// One row per course-with-SUBMITTED-results in the department — the HOD
// approves a whole course's result sheet at once, not one student at a
// time (matches how faculty submit — see
// services/e-learning/faculty/results.ts#submitCourseResults).
export async function getPendingResultApprovals(hod: HodProfile, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) return [];

  const results = await elearningDb.result.findMany({
    where: {
      status: "SUBMITTED",
      academicSessionId: academicContext.session.id,
      semesterId: academicContext.semester.id,
      course: { departmentId: hod.departmentId },
    },
    include: { course: true },
  });

  const byCourse = new Map<string, { course: (typeof results)[number]["course"]; count: number }>();
  for (const result of results) {
    if (!byCourse.has(result.courseId)) byCourse.set(result.courseId, { course: result.course, count: 0 });
    byCourse.get(result.courseId)!.count += 1;
  }
  return [...byCourse.values()];
}

export async function approveResultUpload(hod: HodProfile, courseId: string, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) throw forbidden("No current academic session/semester is set.");

  const course = await elearningDb.course.findUnique({ where: { id: courseId } });
  if (!course || course.departmentId !== hod.departmentId) throw forbidden("That course isn't in your department.");

  await elearningDb.result.updateMany({
    where: { courseId, academicSessionId: academicContext.session.id, semesterId: academicContext.semester.id, status: "SUBMITTED" },
    data: { status: "PUBLISHED" },
  });
}
