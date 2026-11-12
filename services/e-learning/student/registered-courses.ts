// services/e-learning/student/registered-courses.ts
//
// The one place that resolves "which courses is this student actually taking this semester" — an
// APPROVED CourseRegistration's items, for the current academic session/semester. Used by My Learning
// and the dashboard. Lecturers/coordinator come from the CourseOffering the HOD assigned.

import { elearningDb } from "@/lib/db/elearning";
import { resolveIdentities, fullName } from "@/services/e-learning/shared/identity";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

export interface RegisteredCourse {
  id: string;
  // The CourseOffering behind this course this semester (null until the HOD assigns lecturers).
  offeringId: string | null;
  code: string;
  title: string;
  creditUnits: number;
  // From the curriculum placement in this session + semester; null if the course is no longer in a curriculum.
  level: number | null;
  courseType: string | null;
  description: string | null;
  sessionName: string;
  semesterName: string;
  departmentName: string;
  lecturerName: string | null;
}

export async function getRegisteredCourses(studentUserId: string, academicContext: CurrentAcademicContext): Promise<RegisteredCourse[]> {
  const registration = await elearningDb.courseRegistration.findUnique({
    where: { studentUserId_academicSessionId_semesterId: { studentUserId, academicSessionId: academicContext.session!.id, semesterId: academicContext.semester!.id } },
    include: { items: { include: { course: { include: { department: true } } }, orderBy: { course: { code: "asc" } } } },
  });

  // Only an APPROVED registration counts: pending, rejected and merely-selected courses are never "my courses".
  if (!registration || registration.status !== "APPROVED") return [];

  const courses = registration.items.map((item) => item.course);
  const placements = await elearningDb.curriculumCourse.findMany({
    where: {
      courseId: { in: courses.map((c) => c.id) },
      // The student's own programme only: another programme's offering of the same course is not theirs.
      curriculum: { academicSessionId: academicContext.session!.id, semesterId: academicContext.semester!.id, programme: { studentProfiles: { some: { userId: studentUserId } } } },
    },
    select: {
      courseId: true, level: true, creditUnits: true, courseType: true,
      offering: { select: { id: true, lecturers: { select: { facultyUserId: true, role: true } } } },
    },
  });
  const placementByCourseId = new Map(placements.map((p) => [p.courseId, p]));
  const identities = await resolveIdentities(placements.flatMap((p) => p.offering?.lecturers.map((l) => l.facultyUserId) ?? []));

  return courses.map((course) => {
    const placement = placementByCourseId.get(course.id);
    const lecturers = [...(placement?.offering?.lecturers ?? [])].sort((a, b) => (a.role === b.role ? 0 : a.role === "COORDINATOR" ? -1 : 1));
    return {
      id: course.id,
      offeringId: placement?.offering?.id ?? null,
      code: course.code,
      title: course.title,
      creditUnits: placement?.creditUnits ?? course.creditUnits,
      level: placement?.level ?? null,
      courseType: placement?.courseType ?? null,
      description: course.description,
      sessionName: academicContext.session!.name,
      semesterName: academicContext.semester!.name,
      departmentName: course.department?.name ?? "Shared",
      lecturerName: lecturers.length ? lecturers.map((l) => fullName(identities.get(l.facultyUserId))).join(", ") : null,
    };
  });
}
