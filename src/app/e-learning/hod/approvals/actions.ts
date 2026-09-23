"use server";

// src/app/e-learning/hod/approvals/actions.ts
//
// Server Actions for HOD's Course Registration and Result Upload approval
// pages. Each re-derives the session/HodProfile; department scoping is
// re-checked inside services/e-learning/hod/registration-approvals.ts / result-approvals.ts (AGENTS.md §34).

import { revalidatePath } from "next/cache";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { approveRegistration, rejectRegistration } from "@/services/e-learning/hod/registration-approvals";
import { approveResultUpload } from "@/services/e-learning/hod/result-approvals";

export async function approveRegistrationAction(formData: FormData) {
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);

  const registrationId = String(formData.get("registrationId") ?? "");
  await approveRegistration(hod, registrationId);

  revalidatePath("/e-learning/hod/approvals/course-registration");
}

export async function rejectRegistrationAction(formData: FormData) {
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);

  const registrationId = String(formData.get("registrationId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  await rejectRegistration(hod, registrationId, note);

  revalidatePath("/e-learning/hod/approvals/course-registration");
}

export async function approveResultUploadAction(formData: FormData) {
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);
  const academicContext = await getCurrentAcademicContext();

  const courseId = String(formData.get("courseId") ?? "");
  await approveResultUpload(hod, courseId, academicContext);

  revalidatePath("/e-learning/hod/approvals/result-upload");
}
