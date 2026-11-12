"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { ServiceError } from "@/lib/service-error";
import { createCourse } from "@/services/e-learning/dapu/course-structure";

// Creates a reusable Course only — no curriculum is created or changed.
export async function addCourseAction(fd: FormData) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  let outcome: string;
  try {
    const r = await createCourse({
      code: String(fd.get("code") ?? ""),
      title: String(fd.get("title") ?? ""),
      creditUnits: Number(fd.get("creditUnits") ?? "0"),
      departmentId: String(fd.get("departmentId") ?? "") || null,
      description: String(fd.get("description") ?? ""),
    });
    outcome = r.created
      ? `ok=${encodeURIComponent(`${r.course.code} created. Select it from Course Structure → Select Elective Course.`)}`
      : `ok=${encodeURIComponent(`${r.course.code} already exists ("${r.course.title}") — it was reused, nothing was duplicated.`)}`;
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    outcome = `error=${encodeURIComponent(e.message)}`;
  }
  revalidatePath("/e-learning/dapu/add-course");
  redirect(`/e-learning/dapu/add-course?${outcome}`);
}
