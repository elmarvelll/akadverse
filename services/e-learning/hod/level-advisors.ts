// services/e-learning/hod/level-advisors.ts
//
// Level Advisor assignments: Programme + Level + Academic Session -> one Faculty member.
// LevelAdvisorAssignment is the single source of truth. FacultyProfile.isLevelAdviser /
// levelAdvisorId / levelAdviserOf are derived from it (for the CURRENT session) by
// syncFacultyAdvisorState, always inside the same transaction as the change, so they can't
// drift. A change within a session updates the same row and appends a
// LevelAdvisorAssignmentChange, so who held it and when is never lost; other sessions are
// separate rows. Being a lecturer (or HOD) is stored elsewhere and never blocks this.

import type { HodProfile } from "@/generated/prisma-elearning";
import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, forbidden } from "@/lib/service-error";
import { fullName, resolveIdentities } from "@/services/e-learning/shared/identity";
import { syncFacultyAdvisorState } from "@/services/e-learning/shared/level-advisor-state";

// Assign, or change, the Level Advisor for one Programme + Level + Session.
// Every id is re-validated against the HOD's real scope; nothing from the browser is trusted.
export async function assignOrChangeLevelAdvisor(
  hod: HodProfile,
  p: { programmeId: string; level: number; academicSessionId: string; facultyUserId: string }
) {
  if (!Number.isInteger(p.level) || p.level < 100 || p.level > 600 || p.level % 100 !== 0) throw badRequest("Level must be 100, 200, 300, 400, 500 or 600.");
  const [programme, session, faculty] = await Promise.all([
    elearningDb.programme.findUnique({ where: { id: p.programmeId } }),
    elearningDb.academicSession.findUnique({ where: { id: p.academicSessionId } }),
    elearningDb.facultyProfile.findUnique({ where: { userId: p.facultyUserId } }),
  ]);
  if (!programme || programme.departmentId !== hod.departmentId) throw forbidden("That programme isn't in your department.");
  if (!session) throw badRequest("That academic session doesn't exist.");
  if (!faculty || faculty.departmentId !== hod.departmentId) throw badRequest("Choose a faculty member from your department.");

  const key = { programmeId: p.programmeId, level: p.level, academicSessionId: p.academicSessionId };
  try {
    return await elearningDb.$transaction(async (tx) => {
      const existing = await tx.levelAdvisorAssignment.findUnique({ where: { programmeId_level_academicSessionId: key } });
      if (existing?.facultyUserId === faculty.userId) return { assignmentId: existing.id, changed: false as const };

      // The faculty record carries one current advisor pointer, so a person advises one level per session.
      const other = await tx.levelAdvisorAssignment.findFirst({
        where: { facultyUserId: faculty.userId, academicSessionId: p.academicSessionId, ...(existing ? { id: { not: existing.id } } : {}) },
        include: { programme: { select: { name: true } } },
      });
      if (other) throw conflict(`That faculty member is already the Level Advisor for ${other.programme.name} ${other.level} Level in this session.`);

      const assignment = existing
        ? await tx.levelAdvisorAssignment.update({ where: { id: existing.id }, data: { facultyUserId: faculty.userId } })
        : await tx.levelAdvisorAssignment.create({ data: { ...key, facultyUserId: faculty.userId, createdByUserId: hod.userId } });
      await tx.levelAdvisorAssignmentChange.create({
        data: { assignmentId: assignment.id, fromFacultyUserId: existing?.facultyUserId ?? null, toFacultyUserId: faculty.userId, changedByUserId: hod.userId },
      });
      if (existing) await syncFacultyAdvisorState(tx, existing.facultyUserId); // release the previous advisor first
      await syncFacultyAdvisorState(tx, faculty.userId);
      return { assignmentId: assignment.id, changed: true as const };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("Someone else just assigned this Level Advisor — refresh and try again.");
    throw e;
  }
}

// Everything the HOD page needs, scoped to the HOD's own department, in a fixed number of queries.
// A "context" is Programme + Level in one session. Levels come from what actually exists
// (course structures, enrolled students, existing assignments) — no invented levels.
export async function listAdvisorContexts(hod: HodProfile, sessionId?: string, filter: { programmeId?: string; level?: number } = {}) {
  const [department, sessions, programmes] = await Promise.all([
    elearningDb.department.findUniqueOrThrow({ where: { id: hod.departmentId }, select: { name: true } }),
    elearningDb.academicSession.findMany({ orderBy: { name: "desc" }, select: { id: true, name: true, isCurrent: true } }),
    elearningDb.programme.findMany({ where: { departmentId: hod.departmentId }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  const session = sessions.find((s) => s.id === sessionId) ?? sessions.find((s) => s.isCurrent) ?? sessions[0] ?? null;
  const programmeIds = programmes.map((p) => p.id);
  if (!session || programmeIds.length === 0) return { department, session, sessions, programmes, faculty: [], contexts: [], levels: [] as number[], totalContexts: 0 };

  const [assignments, structureLevels, students, facultyProfiles] = await Promise.all([
    elearningDb.levelAdvisorAssignment.findMany({
      where: { academicSessionId: session.id, programmeId: { in: programmeIds } },
      include: { changes: { orderBy: { changedAt: "desc" }, take: 5 } },
    }),
    elearningDb.curriculumCourse.findMany({
      where: { curriculum: { academicSessionId: session.id, programmeId: { in: programmeIds }, status: { notIn: ["ARCHIVED", "DRAFT"] } } },
      select: { level: true, curriculum: { select: { programmeId: true } } },
    }),
    elearningDb.studentProfile.groupBy({ by: ["programmeId", "level"], where: { programmeId: { in: programmeIds } } }),
    elearningDb.facultyProfile.findMany({ where: { departmentId: hod.departmentId }, select: { userId: true } }),
  ]);

  const ids = new Set<string>([...facultyProfiles.map((f) => f.userId)]);
  for (const a of assignments) for (const c of a.changes) { ids.add(c.toFacultyUserId); if (c.fromFacultyUserId) ids.add(c.fromFacultyUserId); }
  const names = await resolveIdentities([...ids]);
  const nameOf = (id: string | null) => (id ? fullName(names.get(id)) : "—");

  const contexts = new Map<string, { programmeId: string; level: number; sources: Set<string> }>();
  const touch = (programmeId: string, level: number, source: string) => {
    const k = `${programmeId}|${level}`;
    const c = contexts.get(k) ?? { programmeId, level, sources: new Set<string>() };
    c.sources.add(source);
    contexts.set(k, c);
  };
  for (const s of structureLevels) touch(s.curriculum.programmeId, s.level, "Has a course structure");
  for (const s of students) if (s.programmeId) touch(s.programmeId, s.level, "Has students");
  for (const a of assignments) touch(a.programmeId, a.level, "Has an assignment");

  const byKey = new Map(assignments.map((a) => [`${a.programmeId}|${a.level}`, a]));
  const progById = new Map(programmes.map((p) => [p.id, p]));
  const rows = [...contexts.values()]
    .sort((a, b) => (progById.get(a.programmeId)!.name.localeCompare(progById.get(b.programmeId)!.name)) || a.level - b.level)
    .map((c) => {
      const a = byKey.get(`${c.programmeId}|${c.level}`);
      return {
        key: `${c.programmeId}|${c.level}`,
        programme: progById.get(c.programmeId)!,
        level: c.level,
        sources: [...c.sources],
        assignment: a
          ? { id: a.id, facultyUserId: a.facultyUserId, facultyName: nameOf(a.facultyUserId), updatedAt: a.updatedAt, history: a.changes.map((h) => ({ from: nameOf(h.fromFacultyUserId), to: nameOf(h.toFacultyUserId), at: h.changedAt })) }
          : null,
      };
    });

  // Filters apply to the department-scoped rows above, so they can only narrow, never widen, what a HOD sees.
  // The level options come from all of the department's contexts in this session, not just the filtered ones.
  const levels = [...new Set(rows.map((r) => r.level))].sort((a, b) => a - b);
  const shown = rows.filter((r) => (!filter.programmeId || r.programme.id === filter.programmeId) && (!filter.level || r.level === filter.level));

  return {
    department,
    session,
    sessions,
    programmes,
    faculty: facultyProfiles.map((f) => ({ userId: f.userId, name: nameOf(f.userId) })).sort((a, b) => a.name.localeCompare(b.name)),
    contexts: shown,
    levels,
    totalContexts: rows.length,
  };
}
