// services/e-learning/hod/assignments.ts
//
// HOD — Assign Lecturers / Assign Level Advisers / Assignment History
// (AGENTS.md §22). Every write is scoped to the HOD's own department
// (AGENTS.md §21/§34 — "HOD can only manage their department") — course
// and faculty ids the client sends are always re-checked against
// `hod.departmentId`, never trusted directly.

import { elearningDb } from "@/lib/db/elearning";
import { resolveIdentities, fullName } from "@/services/e-learning/shared/identity";

export async function getDepartmentCourses(departmentId: string) {
  return elearningDb.course.findMany({ where: { departmentId }, orderBy: { code: "asc" } });
}

export async function getDepartmentFaculty(departmentId: string) {
  const profiles = await elearningDb.facultyProfile.findMany({ where: { departmentId } });
  const identities = await resolveIdentities(profiles.map((p) => p.userId));
  return profiles.map((p) => ({ ...p, name: fullName(identities.get(p.userId)) }));
}

// Every lecturer assignment ever made in this department, across sessions/semesters (each offering
// belongs to one session + semester, so assigning someone else next semester never erases the past).
export async function getAssignmentHistory(departmentId: string) {
  const rows = await elearningDb.courseOfferingLecturer.findMany({
    where: { courseOffering: { curriculumCourse: { curriculum: { programme: { departmentId } } } } },
    include: { courseOffering: { include: { curriculumCourse: { include: { course: true, curriculum: { include: { academicSession: true, semester: true, programme: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  const identities = await resolveIdentities(rows.map((r) => r.facultyUserId));
  return rows.map((r) => {
    const cc = r.courseOffering.curriculumCourse;
    return { id: r.id, role: r.role, course: cc.course, level: cc.level, programme: cc.curriculum.programme, academicSession: cc.curriculum.academicSession, semester: cc.curriculum.semester, facultyName: fullName(identities.get(r.facultyUserId)) };
  });
}
