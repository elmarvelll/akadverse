// services/e-learning/faculty/assigned-courses.ts
//
// "Which courses/classes am I assigned to" — now read from CourseOfferingLecturer (what the HOD's
// Assign Lecturers page writes): a faculty member is assigned to a CourseOffering, which belongs to
// one published CurriculumCourse in one session + semester. Every Faculty module (results,
// timetable, materials) checks against this instead of trusting a courseId/offeringId the client
// sends: a faculty member can only touch courses they are authorized to teach.

import { elearningDb } from "@/lib/db/elearning";
import { forbidden } from "@/lib/service-error";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

const inSemester = (sessionId: string, semesterId: string) => ({ curriculumCourse: { curriculum: { academicSessionId: sessionId, semesterId } } });

export async function getAssignedCourses(facultyUserId: string, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) return [];
  const rows = await elearningDb.courseOfferingLecturer.findMany({
    where: { facultyUserId, courseOffering: inSemester(academicContext.session.id, academicContext.semester.id) },
    include: { courseOffering: { include: { curriculumCourse: { include: { course: { include: { department: true } } } } } } },
  });
  return rows.map((r) => r.courseOffering.curriculumCourse.course);
}

// Throws unless `facultyUserId` is actually assigned (as lecturer or coordinator) to an offering of `courseId`
// in the given session/semester.
export async function assertAssignedToCourse(facultyUserId: string, courseId: string, academicSessionId: string, semesterId: string) {
  const row = await elearningDb.courseOfferingLecturer.findFirst({
    where: { facultyUserId, courseOffering: { curriculumCourse: { courseId, curriculum: { academicSessionId, semesterId } } } },
    select: { id: true },
  });
  if (!row) throw forbidden("You're not assigned to teach this course this semester.");
}
