// services/e-learning/dapu/curriculum/list-structures-for-review.ts
//
// DAPU Review Saved Courses: every non-archived structure (optionally filtered) with per-level and overall totals.

import { elearningDb } from "@/lib/db/elearning";
import type { CurriculumStatus } from "@/generated/prisma-elearning";

// Review Course: every non-archived structure (optionally filtered), complete with ALL its
// courses, per-level subtotals and overall totals. Curriculum is the source of truth.
export async function listStructuresForReview(filter: { departmentId?: string; programmeId?: string; academicSessionId?: string; semesterId?: string; status?: CurriculumStatus } = {}) {
  const list = await elearningDb.curriculum.findMany({
    where: {
      status: filter.status ?? { notIn: ["ARCHIVED", "DRAFT"] },
      ...(filter.academicSessionId ? { academicSessionId: filter.academicSessionId } : {}),
      ...(filter.semesterId ? { semesterId: filter.semesterId } : {}),
      programme: { ...(filter.programmeId ? { id: filter.programmeId } : {}), ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
    },
    include: {
      programme: { include: { department: { include: { college: true } } } },
      semester: true,
      academicSession: true,
      courses: { include: { course: true }, orderBy: [{ level: "asc" }, { course: { code: "asc" } }] },
    },
    orderBy: [{ academicSession: { name: "desc" } }, { semester: { sequence: "asc" } }, { programme: { name: "asc" } }],
  });
  return list.map((c) => {
    const levels = [...new Set(c.courses.map((x) => x.level))].sort((a, b) => a - b);
    return {
      ...c,
      totalCourses: c.courses.length,
      totalUnits: c.courses.reduce((n, x) => n + x.creditUnits, 0),
      byLevel: levels.map((level) => {
        const rows = c.courses.filter((x) => x.level === level);
        return { level, rows, units: rows.reduce((n, x) => n + x.creditUnits, 0) };
      }),
    };
  });
}
