// services/e-learning/hod/results.ts
//
// HOD — Results by Level / by Course / by Student (AGENTS.md §24), scoped
// to the HOD's own department. Unlike the student-facing results module
// (which only ever shows PUBLISHED rows), HOD sees every status — this is
// an oversight view of the department's results as they move through the
// workflow, not just the published record.

import { elearningDb } from "@/lib/db/elearning";
import { resolveIdentities, fullName } from "@/services/e-learning/shared/identity";
import { computeGpa } from "@/services/e-learning/shared/grading";

export async function getResultsByLevel(departmentId: string, level: number, academicSessionId: string, semesterId: string) {
  const students = await elearningDb.studentProfile.findMany({ where: { departmentId, level } });
  if (students.length === 0) return { courses: [], rows: [] };

  const studentUserIds = students.map((s) => s.userId);
  const results = await elearningDb.result.findMany({
    where: { studentUserId: { in: studentUserIds }, academicSessionId, semesterId },
    include: { course: true },
  });

  const courseMap = new Map(results.map((r) => [r.courseId, r.course]));
  const courses = [...courseMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  const identities = await resolveIdentities(studentUserIds);
  const rows = students.map((student) => {
    const studentResults = results.filter((r) => r.studentUserId === student.userId);
    const scoresByCourseId = new Map(studentResults.map((r) => [r.courseId, r]));
    const gpa = computeGpa(studentResults.map((r) => ({ totalScore: r.totalScore, gradePoint: r.gradePoint, creditUnits: r.course.creditUnits })));
    return {
      studentUserId: student.userId,
      name: fullName(identities.get(student.userId)),
      matricNumber: student.matricNumber,
      scoresByCourseId,
      gpa,
    };
  });

  return { courses, rows };
}

export async function getResultsByCourse(courseId: string, academicSessionId: string, semesterId: string) {
  const results = await elearningDb.result.findMany({
    where: { courseId, academicSessionId, semesterId },
  });
  const identities = await resolveIdentities(results.map((r) => r.studentUserId));

  const profiles = await elearningDb.studentProfile.findMany({ where: { userId: { in: results.map((r) => r.studentUserId) } } });
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  return results.map((r) => ({
    ...r,
    studentName: fullName(identities.get(r.studentUserId)),
    matricNumber: profileByUserId.get(r.studentUserId)?.matricNumber ?? null,
  }));
}

export async function findStudentsByQuery(departmentId: string, query: string) {
  if (!query.trim()) return [];
  const profiles = await elearningDb.studentProfile.findMany({
    where: { departmentId, matricNumber: { contains: query, mode: "insensitive" } },
    take: 10,
  });
  const identities = await resolveIdentities(profiles.map((p) => p.userId));
  return profiles.map((p) => ({ userId: p.userId, name: fullName(identities.get(p.userId)), matricNumber: p.matricNumber }));
}

export async function getResultsByStudent(studentUserId: string) {
  const results = await elearningDb.result.findMany({
    where: { studentUserId },
    include: { course: true, academicSession: true, semester: true },
    orderBy: [{ academicSession: { name: "asc" } }, { semester: { sequence: "asc" } }],
  });
  return results;
}
