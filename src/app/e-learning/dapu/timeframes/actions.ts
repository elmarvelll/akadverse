"use server";

// src/app/e-learning/dapu/timeframes/actions.ts
//
// One shared Server Action for all five Academic Time Frame types
// (AGENTS.md §27) — the form always includes which `type` it's editing, so
// one action covers Course Registration, Result Upload, Result
// Revalidation, Change of Course, and Make-up Application instead of
// five near-identical copies.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { upsertTimeFrame } from "@/services/e-learning/dapu/timeframes";
import { ServiceError, badRequest } from "@/lib/service-error";
import type { TimeFrameType } from "@/generated/prisma-elearning";

const PATH_BY_TYPE: Record<TimeFrameType, string> = {
  COURSE_REGISTRATION: "/e-learning/dapu/timeframes/course-registration",
  RESULT_UPLOAD: "/e-learning/dapu/timeframes/result-upload",
  RESULT_REVALIDATION: "/e-learning/dapu/timeframes/result-revalidation",
  CHANGE_OF_COURSE: "/e-learning/dapu/timeframes/change-of-course",
  MAKEUP_APPLICATION: "/e-learning/dapu/timeframes/makeup-application",
};

export async function saveTimeFrameAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);

  const type = String(formData.get("type") ?? "") as TimeFrameType;
  const academicSessionId = String(formData.get("academicSessionId") ?? "");
  const semesterId = String(formData.get("semesterId") ?? "");
  // The browser sends exact ISO instants (see DateTimeRange), so no timezone is guessed here.
  const startDate = new Date(String(formData.get("startDate") ?? ""));
  const endDate = new Date(String(formData.get("endDate") ?? ""));
  if (!PATH_BY_TYPE[type]) throw badRequest("Unknown period type.");

  let error: string | null = null;
  try {
    if (!academicSessionId || !semesterId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw badRequest("Start and end date & time are required — is a current semester set?");
    }
    await upsertTimeFrame(type, academicSessionId, semesterId, startDate, endDate);
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    error = e.message;
  }
  revalidatePath(PATH_BY_TYPE[type]);
  redirect(error ? `${PATH_BY_TYPE[type]}?error=${encodeURIComponent(error)}` : PATH_BY_TYPE[type]);
}
