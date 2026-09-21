"use server";

// Assign / Change Level Advisor. The HOD's identity and department are re-derived from the
// session on the server; programmeId/level/sessionId/facultyUserId from the form are only
// hints and are all re-validated against that department in the service.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { ServiceError } from "@/lib/service-error";
import { assignOrChangeLevelAdvisor } from "@/services/e-learning/hod/level-advisors";

const PAGE = "/e-learning/hod/assignments/level-advisers";
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function assignLevelAdvisorAction(fd: FormData) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  const sessionId = field(fd, "session");
  let outcome: string;
  try {
    const r = await assignOrChangeLevelAdvisor(hod, {
      programmeId: field(fd, "programme"),
      level: Number(field(fd, "level")),
      academicSessionId: sessionId,
      facultyUserId: field(fd, "facultyUserId"),
    });
    outcome = `ok=${encodeURIComponent(r.changed ? "Level Advisor saved." : "No change — that person is already the Level Advisor.")}`;
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    outcome = `error=${encodeURIComponent(e.message)}`;
  }
  revalidatePath(PAGE);
  // Keep the HOD's filters so the page doesn't reset after assigning.
  const q = new URLSearchParams({ session: sessionId });
  if (field(fd, "fProgramme")) q.set("programme", field(fd, "fProgramme"));
  if (field(fd, "fLevel")) q.set("level", field(fd, "fLevel"));
  redirect(`${PAGE}?${q.toString()}&${outcome}`);
}
