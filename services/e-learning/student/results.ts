// services/e-learning/student/results.ts
//
// Results, GPA/CGPA, and Academic History (AGENTS.md §14) — all built from
// PUBLISHED Result rows only (every earlier workflow status, per AGENTS.md
// §32, is faculty/HOD/DAPU-internal and must never be visible to the
// student it belongs to). GPA/CGPA is computed here from those rows via
// services/e-learning/grading.ts, never hard-coded (§14's explicit rule).

import { elearningDb } from "@/lib/db/elearning";
import { computeGpa, type CourseResultForGpa } from "@/services/e-learning/shared/grading";

async function getPublishedResultRows(studentUserId: string) {
  return elearningDb.result.findMany({
    where: { studentUserId, status: "PUBLISHED" },
    include: { course: true, academicSession: true, semester: true },
    orderBy: [{ academicSession: { name: "asc" } }, { semester: { sequence: "asc" } }],
  });
}

export async function getResultsBySemester(studentUserId: string, academicSessionId: string, semesterId: string) {
  const rows = await elearningDb.result.findMany({
    where: { studentUserId, status: "PUBLISHED", academicSessionId, semesterId },
    include: { course: true },
  });
  return rows;
}

// Every published result, grouped by session/semester (most recent last) —
// what the Results page (AGENTS.md §14's "display results by academic
// session and semester") renders.
export async function getAllResultsGrouped(studentUserId: string) {
  const rows = await getPublishedResultRows(studentUserId);

  const groups = new Map<
    string,
    { academicSession: string; semester: string; results: typeof rows }
  >();
  for (const row of rows) {
    if (!groups.has(row.semesterId)) {
      groups.set(row.semesterId, {
        academicSession: row.academicSession.name,
        semester: row.semester.name,
        results: [],
      });
    }
    groups.get(row.semesterId)!.results.push(row);
  }
  return [...groups.values()];
}

// One row per session+semester the student has published results for,
// each with that semester's GPA plus the CGPA as of that point — this is
// "Academic History" (AGENTS.md §14): historical, not just the current
// semester.
export async function getAcademicHistory(studentUserId: string) {
  const rows = await getPublishedResultRows(studentUserId);

  const bySemester = new Map<string, { session: (typeof rows)[number]["academicSession"]; semester: (typeof rows)[number]["semester"]; results: typeof rows }>();
  for (const row of rows) {
    const key = row.semesterId;
    if (!bySemester.has(key)) {
      bySemester.set(key, { session: row.academicSession, semester: row.semester, results: [] });
    }
    bySemester.get(key)!.results.push(row);
  }

  const history: {
    academicSession: string;
    semester: string;
    semesterGpa: number | null;
    cgpaAsOf: number | null;
    courseCount: number;
  }[] = [];

  const cumulative: CourseResultForGpa[] = [];
  for (const { session, semester, results } of bySemester.values()) {
    const semesterGpaInput: CourseResultForGpa[] = results.map((r) => ({
      totalScore: r.totalScore,
      gradePoint: r.gradePoint,
      creditUnits: r.course.creditUnits,
    }));
    cumulative.push(...semesterGpaInput);

    history.push({
      academicSession: session.name,
      semester: semester.name,
      semesterGpa: computeGpa(semesterGpaInput),
      cgpaAsOf: computeGpa(cumulative),
      courseCount: results.length,
    });
  }

  return history;
}

export async function getGpaCgpaSummary(studentUserId: string) {
  const rows = await getPublishedResultRows(studentUserId);
  const allResults: CourseResultForGpa[] = rows.map((r) => ({
    totalScore: r.totalScore,
    gradePoint: r.gradePoint,
    creditUnits: r.course.creditUnits,
  }));

  const cgpa = computeGpa(allResults);

  // Current semester's GPA, if the student has published results for it —
  // "current" resolved by whichever semester in the fetched rows is most
  // recent (the query is already ordered oldest -> newest above).
  const latest = rows.at(-1);
  const currentSemesterResults = latest
    ? rows
        .filter((r) => r.semesterId === latest.semesterId)
        .map((r) => ({ totalScore: r.totalScore, gradePoint: r.gradePoint, creditUnits: r.course.creditUnits }))
    : [];

  return {
    cgpa,
    currentSemesterGpa: latest ? computeGpa(currentSemesterResults) : null,
    currentSemesterName: latest ? `${latest.academicSession.name} · ${latest.semester.name}` : null,
    totalPublishedCourses: rows.length,
  };
}
