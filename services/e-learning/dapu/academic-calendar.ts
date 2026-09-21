// services/e-learning/dapu/academic-calendar.ts
//
// DAPU-side academic calendar management — creating sessions/semesters and
// setting which one is "current" (AGENTS.md §31). Until now the only way
// to do this was the seed script; this is the real admin path every other
// page's getCurrentAcademicContext() depends on.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest } from "@/lib/service-error";
import { syncAllFacultyAdvisorState } from "@/services/e-learning/shared/level-advisor-state";

export async function listSessions() {
  return elearningDb.academicSession.findMany({
    include: { semesters: true },
    orderBy: { name: "desc" },
  });
}

// The session name is the academic year (YYYY/YYYY, consecutive years); no dates are required.
export async function createSession(name: string) {
  const value = name.trim();
  const m = /^(\d{4})\/(\d{4})$/.exec(value);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) throw badRequest("Session must look like 2026/2027 (two consecutive years).");
  if (await elearningDb.academicSession.findUnique({ where: { name: value } })) throw badRequest("That session already exists.");
  return elearningDb.academicSession.create({ data: { name: value } });
}

export async function setCurrentSession(sessionId: string) {
  await elearningDb.$transaction([
    elearningDb.academicSession.updateMany({ data: { isCurrent: false }, where: { NOT: { id: sessionId } } }),
    elearningDb.academicSession.update({ where: { id: sessionId }, data: { isCurrent: true } }),
  ]);
  // "Current Level Advisor" is per current session, so re-derive it for everyone.
  await syncAllFacultyAdvisorState();
}

// Semester names are data (e.g. "Alpha"/"Omega"), never hard-coded; `sequence` orders them within the session.
export async function createSemester(sessionId: string, name: string, sequence: number, startDate: Date, endDate: Date) {
  if (!name.trim()) throw badRequest("Semester name is required.");
  if (!Number.isInteger(sequence) || sequence < 1) throw badRequest("Sequence must be a positive whole number.");
  if (endDate <= startDate) throw badRequest("End date must be after start date.");
  const clash = await elearningDb.semester.findFirst({
    where: { academicSessionId: sessionId, OR: [{ sequence }, { name: name.trim() }] },
  });
  if (clash) throw badRequest("This session already has a semester with that name or sequence.");
  return elearningDb.semester.create({ data: { academicSessionId: sessionId, name: name.trim(), sequence, startDate, endDate } });
}

export async function setCurrentSemester(semesterId: string) {
  const semester = await elearningDb.semester.findUnique({ where: { id: semesterId } });
  if (!semester) throw badRequest("Semester not found.");

  await elearningDb.$transaction([
    // Only one semester should be current at a time, department-wide —
    // clear every other one, not just siblings in the same session, since
    // "current" is a single global pointer (AcademicSession.isCurrent
    // works the same way).
    elearningDb.semester.updateMany({ data: { isCurrent: false }, where: { NOT: { id: semesterId } } }),
    elearningDb.semester.update({ where: { id: semesterId }, data: { isCurrent: true } }),
  ]);
}
