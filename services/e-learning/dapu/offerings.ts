// services/e-learning/dapu/offerings.ts
//
// CourseOffering: the teaching instance of a CurriculumCourse (spec §22-§24).
// Multiple lecturers; exactly one COORDINATOR who is also an assigned lecturer.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, forbidden, notFound } from "@/lib/service-error";
import type { DayOfWeek, OfferingLecturerRole } from "@/generated/prisma-elearning";

export async function createCourseOffering(p: {
  curriculumCourseId: string;
  lecturers: { facultyUserId: string; role: OfferingLecturerRole }[];
  days: DayOfWeek[];
}) {
  const cc = await elearningDb.curriculumCourse.findUnique({ where: { id: p.curriculumCourseId }, include: { curriculum: true } });
  if (!cc) throw notFound("Curriculum course not found.");
  if (cc.curriculum.status !== "APPROVED" && cc.curriculum.status !== "PUBLISHED") {
    throw conflict("Offerings can only be created once the curriculum is HOD-approved.");
  }
  if (await elearningDb.courseOffering.findUnique({ where: { curriculumCourseId: cc.id } })) throw conflict("This course already has an offering.");

  const ids = p.lecturers.map((l) => l.facultyUserId);
  if (new Set(ids).size !== ids.length) throw badRequest("A lecturer can only be listed once.");
  if (p.lecturers.filter((l) => l.role === "COORDINATOR").length !== 1) throw badRequest("Exactly one coordinator is required.");
  const profiles = await elearningDb.facultyProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true } });
  if (profiles.length !== ids.length) throw badRequest("Every lecturer must have a faculty profile.");

  return elearningDb.courseOffering.create({
    data: {
      curriculumCourseId: cc.id,
      lecturers: { create: p.lecturers },
      days: { create: [...new Set(p.days)].map((dayOfWeek) => ({ dayOfWeek })) },
    },
  });
}

// Lecturers only ever reach offerings they are assigned to (spec §31).
export async function listMyOfferings(facultyUserId: string) {
  return elearningDb.courseOffering.findMany({
    where: { lecturers: { some: { facultyUserId } } },
    include: {
      lecturers: { where: { facultyUserId }, select: { role: true } },
      days: true,
      curriculumCourse: { include: { course: true, curriculum: { include: { academicSession: true, semester: true, programme: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function requireOfferingAccess(facultyUserId: string, courseOfferingId: string) {
  const link = await elearningDb.courseOfferingLecturer.findUnique({
    where: { courseOfferingId_facultyUserId: { courseOfferingId, facultyUserId } },
  });
  if (!link) throw forbidden("You're not assigned to this course offering.");
  return link; // link.role === "COORDINATOR" drives coordinator-only actions
}
