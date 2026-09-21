"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { ServiceError } from "@/lib/service-error";
import { hodApproveCurriculum, hodReturnCurriculum, getCurriculumForHod } from "@/services/e-learning/hod/curriculum-review";
import { assignOrChangeLevelAdvisor } from "@/services/e-learning/hod/level-advisors";

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function run(fd: FormData, work: () => Promise<string>) {
  const id = field(fd, "curriculumId");
  let outcome: string;
  try {
    outcome = `ok=${encodeURIComponent(await work())}`;
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    outcome = `error=${encodeURIComponent(e.message)}`;
  }
  revalidatePath(`/e-learning/hod/curriculum/${id}`);
  redirect(`/e-learning/hod/curriculum/${id}?${outcome}`);
}

export async function assignLevelAdvisorAction(fd: FormData) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  await run(fd, async () => {
    // Programme and session come from the curriculum itself (department-checked), not from the form.
    const c = await getCurriculumForHod(hod, field(fd, "curriculumId"));
    await assignOrChangeLevelAdvisor(hod, { facultyUserId: field(fd, "facultyUserId"), programmeId: c.programmeId, level: Number(field(fd, "level")), academicSessionId: c.academicSessionId });
    return "Level Advisor assigned.";
  });
}

export async function returnCurriculumAction(fd: FormData) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  await run(fd, async () => {
    await hodReturnCurriculum(hod, field(fd, "curriculumId"), field(fd, "note"));
    return "Returned to DAPU with your note.";
  });
}

export async function approveCurriculumAction(fd: FormData) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  await run(fd, async () => {
    await hodApproveCurriculum(hod, field(fd, "curriculumId"));
    return "Course structure approved and published — students can now see it.";
  });
}
