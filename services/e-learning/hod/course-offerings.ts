// services/e-learning/hod/course-offerings.ts
//
// HOD — assign lecturers to the courses of an APPROVED (published) course structure.
//
//   published CurriculumCourse -> CourseOffering (created on first assignment)
//     -> CourseOfferingLecturer rows: any number of LECTURERs and at most one COORDINATOR
//
// The coordinator is also one of the offering's lecturers (a single row with role COORDINATOR).
// The semester-specific CourseOffering — never the reusable Course — owns the lecturers and the
// materials, so nothing leaks between sessions/semesters. Every id from the browser is
// re-validated against the HOD's own department; nothing is trusted.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, forbidden, notFound } from "@/lib/service-error";
import { fullName, resolveIdentities } from "@/services/e-learning/shared/identity";
import type { HodProfile } from "@/generated/prisma-elearning";

// Only courses of a PUBLISHED structure in the HOD's department can be assigned.
async function scopedCurriculumCourse(hod: HodProfile, curriculumCourseId: string) {
  const cc = await elearningDb.curriculumCourse.findUnique({
    where: { id: curriculumCourseId },
    include: { curriculum: { include: { programme: true } }, course: true },
  });
  if (!cc) throw notFound("Course not found.");
  if (cc.curriculum.programme.departmentId !== hod.departmentId) throw forbidden("That course isn't in your department.");
  if (cc.curriculum.status !== "PUBLISHED") throw conflict("Lecturers can only be assigned to courses of an approved (published) course structure.");
  return cc;
}

async function departmentFaculty(hod: HodProfile, facultyUserId: string) {
  const f = await elearningDb.facultyProfile.findUnique({ where: { userId: facultyUserId } });
  if (!f || f.departmentId !== hod.departmentId) throw badRequest("Choose a faculty member from your department.");
  return f;
}

const offeringFor = (curriculumCourseId: string) =>
  elearningDb.courseOffering.upsert({ where: { curriculumCourseId }, update: {}, create: { curriculumCourseId } });

export async function assignLecturer(hod: HodProfile, curriculumCourseId: string, facultyUserId: string) {
  await scopedCurriculumCourse(hod, curriculumCourseId);
  await departmentFaculty(hod, facultyUserId);
  const offering = await offeringFor(curriculumCourseId);
  try {
    await elearningDb.courseOfferingLecturer.create({ data: { courseOfferingId: offering.id, facultyUserId, role: "LECTURER" } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("That faculty member is already assigned to this course.");
    throw e;
  }
}

// Make someone the coordinator: they are added as a lecturer if needed, and any previous coordinator
// becomes a normal lecturer — atomically, so there is never more than one (the DB also enforces it).
export async function setCoordinator(hod: HodProfile, curriculumCourseId: string, facultyUserId: string) {
  await scopedCurriculumCourse(hod, curriculumCourseId);
  await departmentFaculty(hod, facultyUserId);
  const offering = await offeringFor(curriculumCourseId);
  await elearningDb.$transaction(async (tx) => {
    await tx.courseOfferingLecturer.updateMany({ where: { courseOfferingId: offering.id, role: "COORDINATOR", facultyUserId: { not: facultyUserId } }, data: { role: "LECTURER" } });
    await tx.courseOfferingLecturer.upsert({
      where: { courseOfferingId_facultyUserId: { courseOfferingId: offering.id, facultyUserId } },
      update: { role: "COORDINATOR" },
      create: { courseOfferingId: offering.id, facultyUserId, role: "COORDINATOR" },
    });
  });
}

export async function removeLecturer(hod: HodProfile, courseOfferingLecturerId: string) {
  const row = await elearningDb.courseOfferingLecturer.findUnique({
    where: { id: courseOfferingLecturerId },
    include: { courseOffering: { include: { curriculumCourse: { include: { curriculum: { include: { programme: true } } } } } } },
  });
  if (!row) throw notFound("That assignment doesn't exist.");
  if (row.courseOffering.curriculumCourse.curriculum.programme.departmentId !== hod.departmentId) throw forbidden("That course isn't in your department.");
  await elearningDb.courseOfferingLecturer.delete({ where: { id: row.id } });
}

// Everything the Assign Lecturers page needs — published courses in the HOD's department,
// filterable by session, semester, programme and level, with their current lecturers.
export async function listAssignableCourses(hod: HodProfile, f: { sessionId?: string; semesterId?: string; programmeId?: string; level?: number }) {
  const [sessions, programmes, facultyProfiles] = await Promise.all([
    elearningDb.academicSession.findMany({ orderBy: { name: "desc" }, select: { id: true, name: true, isCurrent: true, semesters: { orderBy: { sequence: "asc" }, select: { id: true, name: true, isCurrent: true } } } }),
    elearningDb.programme.findMany({ where: { departmentId: hod.departmentId }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    elearningDb.facultyProfile.findMany({ where: { departmentId: hod.departmentId }, select: { userId: true } }),
  ]);
  const session = sessions.find((s) => s.id === f.sessionId) ?? sessions.find((s) => s.isCurrent) ?? sessions[0] ?? null;
  const semester = session?.semesters.find((s) => s.id === f.semesterId) ?? null; // "" = all semesters of the session

  const scope = { status: "PUBLISHED" as const, programme: { departmentId: hod.departmentId } };
  const levelRows = await elearningDb.curriculumCourse.findMany({ where: { curriculum: scope }, distinct: ["level"], select: { level: true }, orderBy: { level: "asc" } });

  const rows = session
    ? await elearningDb.curriculumCourse.findMany({
        where: {
          ...(f.level ? { level: f.level } : {}),
          curriculum: { ...scope, academicSessionId: session.id, ...(semester ? { semesterId: semester.id } : {}), ...(f.programmeId ? { programmeId: f.programmeId } : {}) },
        },
        include: {
          course: true,
          curriculum: { include: { programme: { select: { name: true, code: true } }, semester: { select: { name: true } }, academicSession: { select: { name: true } } } },
          offering: { include: { lecturers: { orderBy: { createdAt: "asc" } } } },
        },
        orderBy: [{ curriculum: { semester: { sequence: "asc" } } }, { level: "asc" }, { course: { code: "asc" } }],
      })
    : [];

  const names = await resolveIdentities([...facultyProfiles.map((p) => p.userId), ...rows.flatMap((r) => r.offering?.lecturers.map((l) => l.facultyUserId) ?? [])]);
  const faculty = facultyProfiles.map((p) => ({ userId: p.userId, name: fullName(names.get(p.userId)) })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    sessions, programmes, faculty, session, semester, levels: levelRows.map((l) => l.level),
    courses: rows.map((r) => ({
      curriculumCourseId: r.id,
      code: r.course.code, title: r.course.title, creditUnits: r.creditUnits, courseType: r.courseType, level: r.level,
      programme: `${r.curriculum.programme.name} (${r.curriculum.programme.code})`, semester: r.curriculum.semester.name, session: r.curriculum.academicSession.name,
      lecturers: (r.offering?.lecturers ?? []).map((l) => ({ id: l.id, facultyUserId: l.facultyUserId, name: fullName(names.get(l.facultyUserId)), role: l.role })),
    })),
  };
}
