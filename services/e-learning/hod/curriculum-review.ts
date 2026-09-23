// services/e-learning/hod/curriculum-review.ts
//
// HOD side of the Course Structure workflow: department-scoped reads, and approve (= publish) / return a structure.
// DAPU's half lives in services/e-learning/dapu/curriculum/.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, forbidden, notFound } from "@/lib/service-error";
import { notifyUsers } from "@/services/e-learning/shared/identity";
import type { CurriculumStatus, HodProfile } from "@/generated/prisma-elearning";
import { levelAdvisorChecklist } from "@/services/e-learning/shared/curriculum/level-advisor-checklist";

// Department scope is enforced here, on the server, for every HOD read/write.
export async function getCurriculumForHod(hod: HodProfile, curriculumId: string) {
  const c = await elearningDb.curriculum.findUnique({
    where: { id: curriculumId },
    include: { programme: { include: { department: true } }, semester: true, academicSession: true, courses: { include: { course: true }, orderBy: [{ level: "asc" }, { course: { code: "asc" } }] } },
  });
  if (!c) throw notFound("Curriculum not found.");
  if (c.programme.departmentId !== hod.departmentId) throw forbidden("This curriculum belongs to another department.");
  return c;
}

// The HOD's structures, department-scoped on the server. Each carries a per-level summary
// (courses + units per level). Optional filters: programme (must be in the HOD's department)
// and level (structures that contain courses at that level). Filter options come from the
// database too, so a HOD only ever sees their own department's programmes and levels.
const HOD_VISIBLE: CurriculumStatus[] = ["PENDING_HOD", "RETURNED", "APPROVED", "PUBLISHED"];

export async function listCurriculaForHod(hod: HodProfile, filter: { programmeId?: string; level?: number } = {}) {
  const scope = { programme: { departmentId: hod.departmentId }, status: { in: HOD_VISIBLE } };
  const [rows, programmes, levelRows] = await Promise.all([
    elearningDb.curriculum.findMany({
      where: {
        ...scope,
        ...(filter.programmeId ? { programmeId: filter.programmeId } : {}),
        ...(filter.level ? { courses: { some: { level: filter.level } } } : {}),
      },
      include: { programme: true, semester: true, academicSession: true, courses: { select: { level: true, creditUnits: true } } },
      orderBy: [{ passedToHodAt: "desc" }],
    }),
    elearningDb.programme.findMany({ where: { departmentId: hod.departmentId }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    elearningDb.curriculumCourse.findMany({ where: { curriculum: scope }, distinct: ["level"], select: { level: true }, orderBy: { level: "asc" } }),
  ]);
  const structures = rows.map((c) => {
    const levels = [...new Set(c.courses.map((x) => x.level))].sort((a, b) => a - b);
    return {
      ...c,
      totalCourses: c.courses.length,
      totalUnits: c.courses.reduce((n, x) => n + x.creditUnits, 0),
      byLevel: levels.map((level) => {
        const at = c.courses.filter((x) => x.level === level);
        return { level, courses: at.length, units: at.reduce((n, x) => n + x.creditUnits, 0) };
      }),
    };
  });
  return { structures, programmes, levels: levelRows.map((l) => l.level) };
}

// HOD approval IS the publication: DAPU -> HOD -> students. Approving sets the structure to
// PUBLISHED, which is what makes it the curriculum students register from — there is no further
// DAPU step. Every level needs a Level Advisor first (spec §25). One transaction: this structure
// becomes PUBLISHED and any earlier published version of the same programme/session/semester is
// archived (kept as history, never deleted). DAPU is told.
export async function hodApproveCurriculum(hod: HodProfile, curriculumId: string) {
  const c = await getCurriculumForHod(hod, curriculumId);
  if (c.status !== "PENDING_HOD") throw conflict("This curriculum isn't awaiting HOD review.");
  const missing = (await levelAdvisorChecklist(c.id)).filter((x) => !x.assigned);
  if (missing.length) throw badRequest(`Assign a Level Advisor for ${missing.map((m) => `${m.level} Level`).join(", ")} first.`);
  const now = new Date();
  await elearningDb.$transaction(async (tx) => {
    const { count } = await tx.curriculum.updateMany({
      where: { id: c.id, status: "PENDING_HOD" },
      data: { status: "PUBLISHED", approvedByUserId: hod.userId, approvedAt: now, publishedAt: now, hodNote: null },
    });
    if (count !== 1) throw conflict("This curriculum was just updated by someone else.");
    await tx.curriculum.updateMany({
      where: { programmeId: c.programmeId, academicSessionId: c.academicSessionId, semesterId: c.semesterId, status: "PUBLISHED", id: { not: c.id } },
      data: { status: "ARCHIVED" },
    });
  });
  await notifyUsers([c.createdByUserId], {
    type: "CURRICULUM_PUBLISHED",
    title: "Course structure approved and published",
    message: `${c.programme.name} — ${c.academicSession.name} ${c.semester.name} was approved by the HOD and is now available to students.`,
    link: `/e-learning/dapu/course-structure/review?curriculum=${c.id}`,
  });
}

// HOD sends the structure back to DAPU with a note (department-scoped). DAPU is told;
// editing the structure makes it a draft again, then it is re-saved and re-published.
export async function hodReturnCurriculum(hod: HodProfile, curriculumId: string, note: string) {
  const c = await getCurriculumForHod(hod, curriculumId);
  const text = note.trim();
  if (!text) throw badRequest("Tell DAPU what needs to change.");
  if (c.status !== "PENDING_HOD") throw conflict("This curriculum isn't awaiting HOD review.");
  const { count } = await elearningDb.curriculum.updateMany({ where: { id: c.id, status: "PENDING_HOD" }, data: { status: "RETURNED", hodNote: text } });
  if (count !== 1) throw conflict("This curriculum was just updated by someone else.");
  await notifyUsers([c.createdByUserId], {
    type: "CURRICULUM_RETURNED",
    title: "Course structure returned by HOD",
    message: `${c.programme.name} — ${c.academicSession.name} ${c.semester.name} was returned: ${text}`,
    link: `/e-learning/dapu/course-structure/review?curriculum=${c.id}`,
  });
}
