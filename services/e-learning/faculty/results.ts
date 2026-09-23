// services/e-learning/faculty/results.ts
//
// Result entry for an assigned course (AGENTS.md §19): Test 1, Test 2,
// Exam, Full CA, computed into a total/grade/grade-point via
// services/e-learning/grading.ts (never scattered inline math), then
// submitted as a batch. Submission moves every DRAFT result for the course
// to SUBMITTED (AGENTS.md §32) — VALIDATED/APPROVED/PUBLISHED are HOD/DAPU
// transitions from later phases, so a submitted result just waits here
// until those exist.
//
// Every function assumes the caller already ran assertAssignedToCourse —
// see the Server Actions that call these.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, forbidden } from "@/lib/service-error";
import { computeFullCA, computeTotalScore, gradeForScore } from "@/services/e-learning/shared/grading";
import { getStudentsForCourse } from "@/services/e-learning/faculty/students";
import { isTimeFrameOpen } from "@/services/e-learning/shared/timeframes";

// Ensures every currently-registered (APPROVED) student for this course has
// a Result row to edit, creating empty DRAFT ones for anyone missing —
// safe to call every time the entry page loads (upsert, not overwrite).
export async function ensureResultRows(
  courseId: string,
  academicSessionId: string,
  semesterId: string,
  enteredByUserId: string
) {
  const students = await getStudentsForCourse(courseId, academicSessionId, semesterId);
  for (const student of students) {
    await elearningDb.result.upsert({
      where: {
        studentUserId_courseId_academicSessionId_semesterId: {
          studentUserId: student.userId,
          courseId,
          academicSessionId,
          semesterId,
        },
      },
      update: {},
      create: { studentUserId: student.userId, courseId, academicSessionId, semesterId, enteredByUserId },
    });
  }
}

export async function getResultsForCourse(courseId: string, academicSessionId: string, semesterId: string) {
  return elearningDb.result.findMany({
    where: { courseId, academicSessionId, semesterId },
  });
}

export async function updateResultScores(
  resultId: string,
  facultyUserId: string,
  input: { test1: number | null; test2: number | null; exam: number | null; fullCAOverride: number | null }
) {
  const result = await elearningDb.result.findUnique({ where: { id: resultId } });
  if (!result) throw badRequest("Result not found.");
  if (result.status !== "DRAFT") throw forbidden("Only a draft result can be edited.");

  const fullCA = computeFullCA(input.test1, input.test2, input.fullCAOverride);
  const totalScore = computeTotalScore(fullCA, input.exam);
  const { grade, gradePoint } = totalScore !== null ? gradeForScore(totalScore) : { grade: null, gradePoint: null };

  return elearningDb.result.update({
    where: { id: resultId },
    data: {
      test1: input.test1,
      test2: input.test2,
      exam: input.exam,
      fullCA,
      totalScore,
      grade,
      gradePoint,
      enteredByUserId: facultyUserId,
    },
  });
}

export async function submitCourseResults(courseId: string, academicSessionId: string, semesterId: string) {
  const open = await isTimeFrameOpen("RESULT_UPLOAD", academicSessionId, semesterId);
  if (!open) throw forbidden("Result upload isn't open right now.");

  await elearningDb.result.updateMany({
    where: { courseId, academicSessionId, semesterId, status: "DRAFT" },
    data: { status: "SUBMITTED" },
  });
}
