// services/e-learning/shared/level-advisor-state.ts
//
// FacultyProfile.isLevelAdviser / levelAdvisorId / levelAdviserOf are DERIVED from LevelAdvisorAssignment for the
// CURRENT session. These two functions keep that derived state in step. They live in shared/ because both the HOD
// (assigning an adviser) and DAPU (changing the current session) must trigger them.

import type { Prisma } from "@/generated/prisma-elearning";
import { elearningDb } from "@/lib/db/elearning";

type Db = Prisma.TransactionClient;

// Bring one faculty member's Level Advisor flags in line with their assignment in the current session.
export async function syncFacultyAdvisorState(db: Db, facultyUserId: string) {
  const current = await db.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
  const a = current
    ? await db.levelAdvisorAssignment.findFirst({ where: { facultyUserId, academicSessionId: current.id }, orderBy: { updatedAt: "desc" } })
    : null;
  await db.facultyProfile.update({
    where: { userId: facultyUserId },
    data: { levelAdvisorId: a?.id ?? null, isLevelAdviser: !!a, levelAdviserOf: a?.level ?? null },
  });
}

// After the current session changes, every faculty member's derived state must be recomputed.
export async function syncAllFacultyAdvisorState() {
  await elearningDb.$transaction(async (tx) => {
    const current = await tx.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
    const wanted = new Map<string, { id: string; level: number }>();
    if (current) {
      for (const a of await tx.levelAdvisorAssignment.findMany({ where: { academicSessionId: current.id }, orderBy: { updatedAt: "asc" } })) {
        wanted.set(a.facultyUserId, { id: a.id, level: a.level });
      }
    }
    // Two phases so a pointer that moves between people can't trip the unique index, and the
    // flag/pointer CHECK is never violated in between: (1) clear everyone whose derived state
    // changes — pointer, flag and level together — then (2) set the new state.
    const profiles = await tx.facultyProfile.findMany({ select: { userId: true, levelAdvisorId: true, isLevelAdviser: true, levelAdviserOf: true } });
    const stale = profiles.filter((f) => {
      const w = wanted.get(f.userId);
      return (w?.id ?? null) !== f.levelAdvisorId || !!w !== f.isLevelAdviser || (w?.level ?? null) !== f.levelAdviserOf;
    });
    if (stale.length) {
      await tx.facultyProfile.updateMany({ where: { userId: { in: stale.map((f) => f.userId) } }, data: { levelAdvisorId: null, isLevelAdviser: false, levelAdviserOf: null } });
      for (const f of stale) {
        const w = wanted.get(f.userId);
        if (w) await tx.facultyProfile.update({ where: { userId: f.userId }, data: { levelAdvisorId: w.id, isLevelAdviser: true, levelAdviserOf: w.level } });
      }
    }
  });
}
