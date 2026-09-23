// services/e-learning/shared/curriculum/level-advisor-checklist.ts
//
// Which levels of a curriculum still have no Level Advisor for its programme + session.

import { elearningDb } from "@/lib/db/elearning";
import { loadCurriculum } from "@/services/e-learning/shared/curriculum/load-curriculum";

// Levels in this curriculum that have no Level Advisor for its programme + session (spec §28).
export async function levelAdvisorChecklist(curriculumId: string) {
  const c = await loadCurriculum(curriculumId);
  const levels = [...new Set(c.courses.map((x) => x.level))].sort((a, b) => a - b);
  const assigned = await elearningDb.levelAdvisorAssignment.findMany({
    where: { programmeId: c.programmeId, academicSessionId: c.academicSessionId },
  });
  return levels.map((level) => ({
    level,
    facultyUserId: assigned.find((a) => a.level === level)?.facultyUserId ?? null,
    assigned: assigned.some((a) => a.level === level),
  }));
}
