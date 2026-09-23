"use server";

// src/app/e-learning/hod/assignments/actions.ts
//
// Assign / remove lecturers and set the coordinator. The HOD's identity and department come from the
// session; the form's ids are routing only and are re-validated in
// services/e-learning/hod/course-offerings.ts against the HOD's own department.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { ServiceError } from "@/lib/service-error";
import { assignLecturer, removeLecturer, setCoordinator } from "@/services/e-learning/hod/course-offerings";

const PAGE = "/e-learning/hod/assignments/lecturers";
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function run(fd: FormData, work: (hod: Awaited<ReturnType<typeof requireHodProfile>>) => Promise<string>) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  let outcome: string;
  try { outcome = `ok=${encodeURIComponent(await work(hod))}`; }
  catch (e) { if (!(e instanceof ServiceError)) throw e; outcome = `error=${encodeURIComponent(e.message)}`; }
  // Keep the HOD's filters after every change.
  const q = new URLSearchParams();
  for (const k of ["session", "semester", "programme", "level"]) if (field(fd, `f_${k}`)) q.set(k, field(fd, `f_${k}`));
  revalidatePath(PAGE);
  redirect(`${PAGE}?${q.toString()}${q.size ? "&" : ""}${outcome}`);
}

export async function assignLecturerAction(fd: FormData) {
  await run(fd, async (hod) => { await assignLecturer(hod, field(fd, "curriculumCourseId"), field(fd, "facultyUserId")); return "Lecturer assigned."; });
}
export async function setCoordinatorAction(fd: FormData) {
  await run(fd, async (hod) => { await setCoordinator(hod, field(fd, "curriculumCourseId"), field(fd, "facultyUserId")); return "Course coordinator set."; });
}
export async function removeLecturerAction(fd: FormData) {
  await run(fd, async (hod) => { await removeLecturer(hod, field(fd, "lecturerId")); return "Lecturer removed."; });
}
