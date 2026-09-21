"use server";

// src/app/e-learning/student/course-control/actions.ts
//
// Server Actions for course registration and Add/Drop. Each re-derives the session, the student
// profile and the academic context on the SERVER; the browser only names courses/items, and
// services/e-learning/student/registration.ts re-validates eligibility, ownership, the DAPU
// registration period (against the server clock) and credit limits.
//
// Selecting/removing a course during registration is NOT an action: that state lives only in the
// browser. registerCoursesAction is the single request that persists a registration.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { addCourse, registerCourses, removeCourse } from "@/services/e-learning/student/registration";
import { ServiceError } from "@/lib/service-error";

const REG = "/e-learning/student/course-control/registration";
const DROP = "/e-learning/student/course-control/add-drop";
const STATUS = "/e-learning/student/course-control/registration-status";
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export type RegisterResult = { ok: true; courses: number; units: number } | { ok: false; error: string };

// "Register Courses" — ONE request carrying the whole selection. Returns a result instead of
// redirecting, so on failure the page keeps the student's selection and lets them retry.
export async function registerCoursesAction(courseIds: string[]): Promise<RegisterResult> {
  const session = await requireElearningRole(["student"]);
  const profile = await requireStudentProfile(session);
  const ctx = await getCurrentAcademicContext();
  try {
    const r = await registerCourses(profile, ctx, Array.isArray(courseIds) ? courseIds.map(String) : []);
    for (const p of [REG, STATUS, DROP, "/e-learning/student/dashboard", "/e-learning/student/my-learning"]) revalidatePath(p);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    throw e;
  }
}

// ---- Add/Drop (separate feature: an APPROVED registration, DAPU change-of-course window) ----
async function dropRun(work: (s: { userId: string; profile: Awaited<ReturnType<typeof requireStudentProfile>>; ctx: Awaited<ReturnType<typeof getCurrentAcademicContext>> }) => Promise<void>) {
  const session = await requireElearningRole(["student"]);
  const profile = await requireStudentProfile(session);
  const ctx = await getCurrentAcademicContext();
  let outcome = "";
  try {
    await work({ userId: session.user.id, profile, ctx });
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    outcome = `?error=${encodeURIComponent(e.message)}`;
  }
  revalidatePath(DROP);
  revalidatePath("/e-learning/student/my-learning");
  redirect(`${DROP}${outcome}`);
}

export async function addCourseAction(fd: FormData) {
  await dropRun(async ({ profile, ctx }) => addCourse(profile, ctx, field(fd, "courseId")));
}

export async function removeCourseAction(fd: FormData) {
  await dropRun(async ({ userId, ctx }) => removeCourse(userId, ctx, field(fd, "itemId")));
}
