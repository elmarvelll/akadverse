"use server";

// src/app/e-learning/faculty/results/[courseId]/actions.ts
//
// Server Actions for entering/submitting results on one assigned course
// (AGENTS.md §19). Every one re-derives the session and re-checks
// assertAssignedToCourse — a faculty member can only touch results for
// courses they're actually assigned to teach (AGENTS.md §34), never
// whatever courseId a form happens to submit.

import { revalidatePath } from "next/cache";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { assertAssignedToCourse } from "@/services/e-learning/faculty/assigned-courses";
import { updateResultScores, submitCourseResults } from "@/services/e-learning/faculty/results";
import { badRequest } from "@/lib/service-error";

function parseScore(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (str === "") return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export async function updateResultAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const session = await requireElearningRole(["faculty"]);
  const academicContext = await getCurrentAcademicContext();
  if (!academicContext?.session || !academicContext.semester) throw badRequest("No current academic session/semester is set.");
  await assertAssignedToCourse(session.user.id, courseId, academicContext.session.id, academicContext.semester.id);

  const resultId = String(formData.get("resultId") ?? "");
  await updateResultScores(resultId, session.user.id, {
    test1: parseScore(formData.get("test1")),
    test2: parseScore(formData.get("test2")),
    exam: parseScore(formData.get("exam")),
    fullCAOverride: parseScore(formData.get("fullCAOverride")),
  });

  revalidatePath(`/e-learning/faculty/results/${courseId}`);
}

export async function submitResultsAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const session = await requireElearningRole(["faculty"]);
  const academicContext = await getCurrentAcademicContext();
  if (!academicContext?.session || !academicContext.semester) throw badRequest("No current academic session/semester is set.");
  await assertAssignedToCourse(session.user.id, courseId, academicContext.session.id, academicContext.semester.id);

  await submitCourseResults(courseId, academicContext.session.id, academicContext.semester.id);

  revalidatePath(`/e-learning/faculty/results/${courseId}`);
}
