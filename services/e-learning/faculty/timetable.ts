// services/e-learning/faculty/timetable.ts
//
// The Faculty Dashboard's timetable (AGENTS.md §17) — approved
// TimetableEntry rows for this faculty member's assigned courses this
// session/semester. Unapproved entries never surface here (AGENTS.md §28
// — a timetable only becomes available to faculty/students once DAPU
// approves it; that approval screen is Phase 6, so for now an entry has to
// be marked approved directly, e.g. by the seed script).

import { elearningDb } from "@/lib/db/elearning";
import { getAssignedCourses } from "@/services/e-learning/faculty/assigned-courses";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export async function getFacultyTimetable(facultyUserId: string, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) return [];

  const courses = await getAssignedCourses(facultyUserId, academicContext);
  if (courses.length === 0) return [];

  const entries = await elearningDb.timetableEntry.findMany({
    where: {
      courseId: { in: courses.map((c) => c.id) },
      academicSessionId: academicContext.session.id,
      semesterId: academicContext.semester.id,
      isApproved: true,
    },
    include: { course: { include: { department: true } } },
  });

  return entries.sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime)
  );
}
