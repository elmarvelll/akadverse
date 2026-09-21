"use server";

// src/app/e-learning/dapu/course-structure/actions.ts
//
// Every action re-checks DAPU authority on the server and re-validates the whole
// context chain and every selected id in the service layer — the form fields are just
// hints. Expected failures (ServiceError) come back as a message on the page, not a 500.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { ServiceError } from "@/lib/service-error";
import { saveCourseSelection } from "@/services/e-learning/dapu/curriculum/save-course-selection";
import { type StructureContext } from "@/services/e-learning/dapu/curriculum/context";
import { linkCcmasProgramme } from "@/services/e-learning/dapu/ccmas-reference";

const BASE = "/e-learning/dapu/course-structure";
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function contextFrom(fd: FormData): StructureContext {
  return {
    collegeId: field(fd, "college"), departmentId: field(fd, "department"), programmeId: field(fd, "programme"),
    level: Number(field(fd, "level")), academicSessionId: field(fd, "session"), semesterId: field(fd, "semester"),
  };
}

function urlFor(fd: FormData, extra: Record<string, string>) {
  const q = new URLSearchParams();
  for (const k of ["college", "department", "programme", "level", "session", "semester"]) if (field(fd, k)) q.set(k, field(fd, k));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `${BASE}?${q.toString()}`;
}

async function dapuOnly() {
  const session = await requireElearningRole(["dapu"]);
  await requireDapuProfile(session);
  return session.user.id;
}

// "Save Courses": stores the complete selection (creating or updating the one saved
// structure for this programme + session + semester) and opens Review Saved Courses.
// Nothing is sent to the HOD or students.
export async function saveCoursesAction(fd: FormData) {
  const userId = await dapuOnly();
  let id: string;
  let message = "Courses saved. Review them, then publish to the HOD when ready.";
  try {
    const r = await saveCourseSelection(userId, contextFrom(fd), {
      ccmasCourseIds: fd.getAll("ccmasCourseId").map(String),
      electiveCourseIds: fd.getAll("electiveCourseId").map(String),
    });
    id = r.curriculumId;
    if (r.reopened) message = `Changes saved. The structure went back to the HOD for re-approval, and ${r.clearedRegistrations} student registration${r.clearedRegistrations === 1 ? " was" : "s were"} cleared — students will register again once the HOD re-approves.`;
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    redirect(urlFor(fd, { error: e.message }));
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/review`);
  redirect(`${BASE}/review?curriculum=${id}&ok=${encodeURIComponent(message)}`);
}

export async function linkProgrammeAction(fd: FormData) {
  await dapuOnly();
  let extra: Record<string, string>;
  try {
    await linkCcmasProgramme(field(fd, "programme"), field(fd, "ccmasProgrammeId") || null);
    extra = { ok: "Programme linked to the CCMAS reference." };
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    extra = { error: e.message };
  }
  revalidatePath(BASE);
  redirect(urlFor(fd, extra));
}
