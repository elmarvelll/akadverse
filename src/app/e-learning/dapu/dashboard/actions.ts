"use server";

// src/app/e-learning/dapu/dashboard/actions.ts
//
// DAPU's academic calendar controls (AGENTS.md §31) — the real admin path
// for what used to only be settable via scripts/elearning-seed.ts.

import { revalidatePath } from "next/cache";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { createSession, setCurrentSession, createSemester, setCurrentSemester } from "@/services/e-learning/dapu/academic-calendar";
import { badRequest } from "@/lib/service-error";

export async function createSessionAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);

  const name = String(formData.get("name") ?? "");
  await createSession(name);
  revalidatePath("/e-learning/dapu/dashboard");
}

export async function setCurrentSessionAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  await setCurrentSession(String(formData.get("sessionId") ?? ""));
  revalidatePath("/e-learning/dapu/dashboard");
}

export async function createSemesterAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);

  const academicSessionId = String(formData.get("academicSessionId") ?? "");
  const name = String(formData.get("name") ?? "");
  const sequence = Number(formData.get("sequence") ?? "0");
  const startDate = new Date(String(formData.get("startDate") ?? ""));
  const endDate = new Date(String(formData.get("endDate") ?? ""));
  if (!academicSessionId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw badRequest("All fields are required.");
  }

  await createSemester(academicSessionId, name, sequence, startDate, endDate);
  revalidatePath("/e-learning/dapu/dashboard");
}

export async function setCurrentSemesterAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  await setCurrentSemester(String(formData.get("semesterId") ?? ""));
  revalidatePath("/e-learning/dapu/dashboard");
}
