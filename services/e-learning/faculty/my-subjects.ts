// services/e-learning/faculty/my-subjects.ts
//
// A lecturer's "My Subjects": every CourseOffering they're assigned to (lecturer or coordinator) in the
// current session/semester, straight from CourseOfferingLecturer — what the HOD's Assign Lecturers writes.

import { elearningDb } from "@/lib/db/elearning";
import { forbidden } from "@/lib/service-error";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

export async function getMySubjects(facultyUserId: string, ctx: CurrentAcademicContext | null) {
  if (!ctx?.session || !ctx.semester) return [];
  const rows = await elearningDb.courseOfferingLecturer.findMany({
    where: { facultyUserId, courseOffering: { curriculumCourse: { curriculum: { academicSessionId: ctx.session.id, semesterId: ctx.semester.id } } } },
    include: { courseOffering: { include: { _count: { select: { materials: true } }, curriculumCourse: { include: { course: true, curriculum: { include: { programme: true } } } } } } },
  });
  return rows
    .map((r) => {
      const cc = r.courseOffering.curriculumCourse;
      return {
        offeringId: r.courseOffering.id,
        role: r.role,
        code: cc.course.code,
        title: cc.course.title,
        creditUnits: cc.creditUnits,
        level: cc.level,
        programmeName: cc.curriculum.programme.name,
        materialCount: r.courseOffering._count.materials,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

// Throws unless this faculty member is assigned to the offering; returns their role.
export async function requireMySubject(facultyUserId: string, offeringId: string) {
  const row = await elearningDb.courseOfferingLecturer.findUnique({ where: { courseOfferingId_facultyUserId: { courseOfferingId: offeringId, facultyUserId } } });
  if (!row) throw forbidden("You're not assigned to this course.");
  return row.role;
}
