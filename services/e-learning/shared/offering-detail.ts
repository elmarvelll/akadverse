// services/e-learning/shared/offering-detail.ts
//
// Everything a course page shows about ONE CourseOffering (used by Faculty "My Subjects" and Student
// "My Learning"): overview facts, lecturers + coordinator, week count derived from the semester's own
// dates, and CCMAS content for the course (real imported data only, reached through the strong
// CurriculumCourse.ccmasProgrammeCourseId link — nothing is matched by name or invented).
// Authorization is the CALLER's job (lecturer row / approved registration); this only assembles data.

import { elearningDb } from "@/lib/db/elearning";
import { notFound } from "@/lib/service-error";
import { weeksInSemester } from "@/lib/course-materials/config";
import { fullName, resolveIdentities } from "@/services/e-learning/shared/identity";

export async function getOfferingDetail(offeringId: string) {
  const o = await elearningDb.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      lecturers: { orderBy: { createdAt: "asc" } },
      materials: { orderBy: [{ startWeek: "asc" }, { createdAt: "asc" }] },
      curriculumCourse: {
        include: {
          course: { include: { department: true } },
          ccmasProgrammeCourse: true,
          curriculum: { include: { academicSession: true, semester: true, programme: true } },
        },
      },
    },
  });
  if (!o) throw notFound("That course doesn't exist.");

  const ids = await resolveIdentities(o.lecturers.map((l) => l.facultyUserId));
  const lecturers = o.lecturers
    .map((l) => ({ userId: l.facultyUserId, name: fullName(ids.get(l.facultyUserId)), role: l.role }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "COORDINATOR" ? -1 : 1));

  const { curriculumCourse: cc } = o;
  const { curriculum } = cc;
  const semesterWeeks = weeksInSemester(curriculum.semester.startDate, curriculum.semester.endDate);
  // Never hide a week that already has content, even if it falls beyond the computed count.
  const totalWeeks = Math.max(semesterWeeks, ...o.materials.map((m) => m.endWeek));
  const ccmas = cc.ccmasProgrammeCourse;

  return {
    id: o.id,
    course: { id: cc.course.id, code: cc.course.code, title: cc.course.title, description: cc.course.description, department: cc.course.department?.name ?? null },
    creditUnits: cc.creditUnits,
    level: cc.level,
    courseType: cc.courseType,
    programme: { id: curriculum.programme.id, name: curriculum.programme.name, code: curriculum.programme.code },
    sessionName: curriculum.academicSession.name,
    semesterName: curriculum.semester.name,
    lecturers,
    totalWeeks,
    materials: o.materials,
    // Present only when this course is genuinely linked to a CCMAS entry AND that entry has the content.
    ccmas: ccmas
      ? {
          contents: ccmas.description?.trim() || null,
          outcomes: ccmas.learningOutcomes.map((s) => s.trim()).filter(Boolean),
          prerequisites: ccmas.prerequisites?.trim() || null,
          sourcePage: ccmas.detailPage ?? ccmas.sourcePage,
        }
      : null,
  };
}

export type OfferingDetail = Awaited<ReturnType<typeof getOfferingDetail>>;
