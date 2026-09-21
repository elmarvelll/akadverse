// services/e-learning/dapu/curriculum/publish-structures.ts
//
// DAPU: "Publish to HOD(s)" — SAVED -> PENDING_HOD for one or many structures, and the single-structure form.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, notFound } from "@/lib/service-error";
import { notifyUsers } from "@/services/e-learning/shared/identity";
import { label } from "@/services/e-learning/shared/curriculum/load-curriculum";
import { levelAdvisorChecklist } from "@/services/e-learning/shared/curriculum/level-advisor-checklist";

export interface PublishResult {
  published: { id: string; label: string }[];
  skipped: { id: string; label: string; reason: string }[];
}

// "Publish to HOD(s)": SAVED -> PENDING_HOD for one or many structures. The HOD of
// each structure is found through its programme's department (never chosen by the
// caller). Only SAVED structures with a HOD are submitted; everything else is
// skipped with a reason. All submissions commit in ONE transaction, each guarded
// by a status check, so a repeat click / concurrent publish can't duplicate a
// submission or notification. HODs are notified only after the commit.
export async function publishStructuresToHods(curriculumIds: string[]): Promise<PublishResult> {
  const ids = [...new Set(curriculumIds)];
  if (ids.length === 0) throw badRequest("Select at least one saved course structure.");
  const list = await elearningDb.curriculum.findMany({
    where: { id: { in: ids } },
    include: { programme: true, semester: true, academicSession: true, courses: true },
  });
  if (list.length !== ids.length) throw notFound("One or more course structures were not found.");

  const hods = await elearningDb.hodProfile.findMany({ where: { departmentId: { in: [...new Set(list.map((c) => c.programme.departmentId))] } } });
  const hodByDept = new Map(hods.map((h) => [h.departmentId, h]));
  const result: PublishResult = { published: [], skipped: [] };
  const eligible: typeof list = [];
  for (const c of list) {
    const l = label(c);
    if (c.status !== "SAVED") result.skipped.push({ id: c.id, label: l, reason: c.status === "RETURNED" ? "Returned by the HOD — edit and save it again first." : c.status === "PENDING_HOD" ? "Awaiting HOD review." : `Already ${c.status.replaceAll("_", " ").toLowerCase()}.` });
    else if (c.courses.length === 0) result.skipped.push({ id: c.id, label: l, reason: "It has no courses." });
    else if (!hodByDept.has(c.programme.departmentId)) result.skipped.push({ id: c.id, label: l, reason: "Its department has no HOD." });
    else eligible.push(c);
  }

  if (eligible.length) {
    await elearningDb.$transaction(async (tx) => {
      for (const c of eligible) {
        const { count } = await tx.curriculum.updateMany({ where: { id: c.id, status: "SAVED" }, data: { status: "PENDING_HOD", passedToHodAt: new Date(), hodNote: null } });
        if (count !== 1) throw conflict(`${label(c)} was just changed by someone else — nothing was published.`);
      }
    });
    for (const c of eligible) {
      const hod = hodByDept.get(c.programme.departmentId)!;
      const units = c.courses.reduce((n, x) => n + x.creditUnits, 0);
      const levels = [...new Set(c.courses.map((x) => x.level))].sort((a, b) => a - b).map((l) => `${l}L`).join(", ");
      await notifyUsers([hod.userId], {
        type: "CURRICULUM_REVIEW",
        title: "New curriculum requires review",
        message: `New curriculum requires review — ${label(c)} (${levels}): ${c.courses.length} courses, ${units} credit units, submitted by DAPU. Open to review and approve or return.`,
        link: `/e-learning/hod/curriculum/${c.id}`,
      });
      const missing = (await levelAdvisorChecklist(c.id)).filter((x) => !x.assigned);
      if (missing.length) {
        await notifyUsers([hod.userId], {
          type: "LEVEL_ADVISOR_MISSING",
          title: "Level Advisors not assigned",
          message: `No Level Advisor assigned for ${missing.map((m) => `${m.level} Level`).join(", ")} — ${label(c)}.`,
          link: `/e-learning/hod/curriculum/${c.id}`,
        });
      }
      result.published.push({ id: c.id, label: label(c) });
    }
  }
  return result;
}

// Single-structure publish: same path as bulk; a skip is an error for the caller.
export async function submitCourseStructure(curriculumId: string) {
  const r = await publishStructuresToHods([curriculumId]);
  if (r.skipped.length) throw conflict(r.skipped[0].reason);
}
