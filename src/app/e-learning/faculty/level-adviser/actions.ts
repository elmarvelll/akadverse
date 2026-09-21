"use server";

// src/app/e-learning/faculty/level-adviser/actions.ts
//
// Server Actions for the Level Adviser review screen. Every one re-derives the session and
// re-checks requireLevelAdviserProfile. The adviser's scope (programme + level + session) is
// resolved from the database inside services/e-learning/level-adviser/registrations.ts — the
// registrationId in a form is only routing, and "Approve All" takes no ids at all. The DAPU
// registration period is enforced there too. Expected failures come back as a message, not a 500.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireLevelAdviserProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { ServiceError } from "@/lib/service-error";
import { approveAll, approveRegistration, rejectRegistration } from "@/services/e-learning/level-adviser/registrations";

const PAGE = "/e-learning/faculty/level-adviser/approvals";

async function run(work: (adviser: Awaited<ReturnType<typeof requireLevelAdviserProfile>>) => Promise<string>) {
  const session = await requireElearningRole(["faculty"]);
  const adviser = await requireLevelAdviserProfile(session);
  let outcome: string;
  try {
    outcome = `ok=${encodeURIComponent(await work(adviser))}`;
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    outcome = `error=${encodeURIComponent(e.message)}`;
  }
  revalidatePath(PAGE);
  revalidatePath("/e-learning/faculty/level-adviser/registrations");
  redirect(`${PAGE}?${outcome}`);
}

export async function approveRegistrationAction(fd: FormData) {
  await run(async (adviser) => { await approveRegistration(adviser, String(fd.get("registrationId") ?? "")); return "Registration approved and sent to the HOD."; });
}

export async function approveAllAction() {
  await run(async (adviser) => {
    const r = await approveAll(adviser, await getCurrentAcademicContext());
    return r.approved === 0 ? "There were no registrations waiting for you." : `Approved ${r.approved} registration${r.approved === 1 ? "" : "s"} and sent ${r.approved === 1 ? "it" : "them"} to the HOD.`;
  });
}

export async function rejectRegistrationAction(fd: FormData) {
  await run(async (adviser) => { await rejectRegistration(adviser, String(fd.get("registrationId") ?? ""), String(fd.get("note") ?? "").trim() || null); return "Registration rejected."; });
}
