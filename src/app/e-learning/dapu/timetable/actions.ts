"use server";

// src/app/e-learning/dapu/timetable/actions.ts

import { revalidatePath } from "next/cache";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { createTimetableEntry, approveTimetableEntry } from "@/services/e-learning/dapu/timetable";
import { badRequest } from "@/lib/service-error";
import type { DayOfWeek } from "@/generated/prisma-elearning";

function revalidateAll() {
  revalidatePath("/e-learning/dapu/timetable/review");
  revalidatePath("/e-learning/dapu/timetable/approve");
  revalidatePath("/e-learning/dapu/timetable/send-to-hods");
}

export async function createTimetableEntryAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const academicContext = await getCurrentAcademicContext();
  if (!academicContext?.session || !academicContext.semester) throw badRequest("No current academic session/semester is set.");

  await createTimetableEntry({
    courseId: String(formData.get("courseId") ?? ""),
    academicSessionId: academicContext.session.id,
    semesterId: academicContext.semester.id,
    dayOfWeek: String(formData.get("dayOfWeek") ?? "MONDAY") as DayOfWeek,
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    venue: String(formData.get("venue") ?? ""),
  });

  revalidateAll();
}

export async function approveTimetableEntryAction(formData: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const entryId = String(formData.get("entryId") ?? "");
  await approveTimetableEntry(entryId);
  revalidateAll();
}
