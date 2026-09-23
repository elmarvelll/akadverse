// services/e-learning/shared/grading.ts
//
// The one place total score -> letter grade -> grade point is decided
// (AGENTS.md §19/§32 — "modeled properly rather than scattered throughout
// frontend code"). GPA/CGPA (services/e-learning/student/results.ts) and
// faculty result entry (a later phase) both go through this instead of
// each re-implementing the scale.
//
// Standard 5-point scale — adjust here (not per-caller) if the real
// institutional scale differs.
const GRADE_SCALE = [
  { min: 70, grade: "A", point: 5.0 },
  { min: 60, grade: "B", point: 4.0 },
  { min: 50, grade: "C", point: 3.0 },
  { min: 45, grade: "D", point: 2.0 },
  { min: 40, grade: "E", point: 1.0 },
  { min: 0, grade: "F", point: 0.0 },
] as const;

export interface GradeResult {
  grade: string;
  gradePoint: number;
}

export function gradeForScore(totalScore: number): GradeResult {
  const band = GRADE_SCALE.find((b) => totalScore >= b.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
  return { grade: band.grade, gradePoint: band.point };
}

// Full CA (continuous assessment) is test1 + test2 unless a faculty member
// has explicitly overridden it (see the Result model's `fullCA` comment).
export function computeFullCA(test1: number | null, test2: number | null, fullCAOverride: number | null): number | null {
  if (fullCAOverride !== null) return fullCAOverride;
  if (test1 === null && test2 === null) return null;
  return (test1 ?? 0) + (test2 ?? 0);
}

export function computeTotalScore(fullCA: number | null, exam: number | null): number | null {
  if (fullCA === null && exam === null) return null;
  return (fullCA ?? 0) + (exam ?? 0);
}

export interface CourseResultForGpa {
  totalScore: number | null;
  gradePoint: number | null;
  creditUnits: number;
}

// GPA for one semester, and (given every published result across a
// student's history) CGPA use the same weighted-average-by-credit-unit
// formula — AGENTS.md §14 explicitly requires this be computed from real
// records, never hard-coded.
export function computeGpa(results: CourseResultForGpa[]): number | null {
  const graded = results.filter((r) => r.gradePoint !== null);
  if (graded.length === 0) return null;

  const totalCredits = graded.reduce((sum, r) => sum + r.creditUnits, 0);
  if (totalCredits === 0) return null;

  const totalPoints = graded.reduce((sum, r) => sum + r.gradePoint! * r.creditUnits, 0);
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}
