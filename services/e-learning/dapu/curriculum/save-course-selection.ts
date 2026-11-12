// services/e-learning/dapu/curriculum/save-course-selection.ts
//
// DAPU: "Save Courses" — stores the complete selection for one level of a structure in one transaction, and reopens
// a PUBLISHED structure (back to the HOD, affected registrations cleared) when the change is real.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict } from "@/lib/service-error";
import { notifyUsers } from "@/services/e-learning/shared/identity";
import type { CurriculumCourseType } from "@/generated/prisma-elearning";
import { resolveContext, currentCurriculum, EDITABLE, courseTypeFromLetter, type StructureContext } from "@/services/e-learning/dapu/curriculum/context";

// "Save Courses": stores the COMPLETE selection for one level of a structure, in one
// transaction. It creates the structure the first time and updates the same one every
// time after (never a duplicate), replacing that level's courses with exactly what was
// selected. Nothing is sent to the HOD or to students. Only SAVED/RETURNED structures
// can be changed; saving a RETURNED one makes it SAVED again, ready to re-publish.
export async function saveCourseSelection(
  dapuUserId: string,
  ctx: StructureContext,
  sel: { ccmasCourseIds: string[]; electiveCourseIds: string[] }
) {
  const resolved = await resolveContext(ctx);
  const ccmasIds = [...new Set(sel.ccmasCourseIds)];
  const electiveIds = [...new Set(sel.electiveCourseIds)];

  // Validate everything against the database before writing.
  if (ccmasIds.length && !resolved.programme.ccmasProgrammeId) throw badRequest("Link this programme to a CCMAS programme first.");
  const ccmasRows = ccmasIds.length
    ? await elearningDb.cCMASProgrammeCourse.findMany({
        where: { id: { in: ccmasIds }, programmeId: resolved.programme.ccmasProgrammeId!, level: ctx.level },
        include: { course: { select: { code: true } } },
      })
    : [];
  if (ccmasRows.length !== ccmasIds.length) throw badRequest("One or more selected courses aren't part of this programme's CCMAS list at this level.");

  const electives = electiveIds.length ? await elearningDb.course.findMany({ where: { id: { in: electiveIds }, isActive: true } }) : [];
  if (electives.length !== electiveIds.length) throw badRequest("One or more selected elective courses don't exist.");
  if (electives.length) {
    const asCcmas = await elearningDb.cCMASCourse.findFirst({ where: { code: { in: electives.map((e) => e.code) } }, select: { code: true } });
    if (asCcmas) throw badRequest(`${asCcmas.code} is a CCMAS course — select it from the CCMAS list, not as an elective.`);
  }
  if (ccmasRows.length + electives.length === 0) {
    const any = await currentCurriculum(resolved.programme.id, resolved.session.id, resolved.semester.id);
    if (!any) throw badRequest("Select at least one course before saving.");
  }

  // Changing a PUBLISHED structure sends it back to the HOD, so there must be a HOD to re-approve it.
  const before = await currentCurriculum(resolved.programme.id, resolved.session.id, resolved.semester.id);
  const hodForReopen = before?.status === "PUBLISHED" ? await elearningDb.hodProfile.findUnique({ where: { departmentId: resolved.programme.departmentId } }) : null;
  if (before?.status === "PUBLISHED" && !hodForReopen) throw badRequest("This programme's department has no HOD to re-approve the change.");

  const result = await elearningDb.$transaction(async (tx) => {
    const existing = await currentCurriculum(resolved.programme.id, resolved.session.id, resolved.semester.id, tx);
    if (existing && !EDITABLE.includes(existing.status)) {
      throw conflict(`This course structure is ${existing.status.replaceAll("_", " ").toLowerCase()} and can't be changed.`);
    }
    const now = new Date();
    let created = false;
    const curriculum =
      existing ??
      (created = true,
      await tx.curriculum.create({
        data: {
          programmeId: resolved.programme.id, academicSessionId: resolved.session.id, semesterId: resolved.semester.id,
          version: ((await tx.curriculum.findFirst({ where: { programmeId: resolved.programme.id, academicSessionId: resolved.session.id, semesterId: resolved.semester.id }, orderBy: { version: "desc" } }))?.version ?? 0) + 1,
          name: `${resolved.programme.name} — ${resolved.session.name} ${resolved.semester.name}`,
          status: "SAVED", savedAt: now, createdByUserId: dapuUserId,
        },
      }));

    // Reuse operational Courses by code (one query); create only the missing CCMAS-derived ones.
    const codes = ccmasRows.map((r) => r.course.code);
    const have = new Map((await tx.course.findMany({ where: { code: { in: codes } } })).map((c) => [c.code, c]));
    const desired = new Map<string, { courseId: string; creditUnits: number; courseType: CurriculumCourseType; source: "CCMAS" | "UNIVERSITY"; ccmasProgrammeCourseId: string | null }>();
    for (const row of ccmasRows) {
      let course = have.get(row.course.code);
      if (!course) course = await tx.course.create({ data: { code: row.course.code, title: row.titleAsListed, creditUnits: row.creditUnits, description: row.description } });
      desired.set(course.id, { courseId: course.id, creditUnits: row.creditUnits, courseType: courseTypeFromLetter(row.statusLetter), source: "CCMAS", ccmasProgrammeCourseId: row.id });
    }
    for (const e of electives) desired.set(e.id, { courseId: e.id, creditUnits: e.creditUnits, courseType: "ELECTIVE", source: "UNIVERSITY", ccmasProgrammeCourseId: null });

    const all = await tx.curriculumCourse.findMany({ where: { curriculumId: curriculum.id } });
    const atLevel = all.filter((c) => c.level === ctx.level);
    const elsewhere = new Map(all.filter((c) => c.level !== ctx.level).map((c) => [c.courseId, c.level]));
    for (const id of desired.keys()) {
      if (elsewhere.has(id)) throw conflict(`A selected course is already in this structure at ${elsewhere.get(id)} Level.`);
    }
    const remove = atLevel.filter((c) => !desired.has(c.courseId));
    const byCourse = new Map(atLevel.map((c) => [c.courseId, c]));

    // A PUBLISHED structure is only reopened by a REAL change — saving an identical selection does nothing.
    const reopening = existing?.status === "PUBLISHED";
    const changed = remove.length > 0 || [...desired.values()].some((d) => { const c = byCourse.get(d.courseId); return !c || c.creditUnits !== d.creditUnits || c.courseType !== d.courseType || c.source !== d.source; });
    if (reopening && !changed) return { curriculumId: curriculum.id, created: false, saved: desired.size, reopened: false as const, clearedRegistrations: 0, clearedStudentUserIds: [] as string[] };

    if (remove.length) {
      // A removed course's offering goes with it — unless lecturers have already shared materials there,
      // which are never destroyed silently.
      const offerings = await tx.courseOffering.findMany({
        where: { curriculumCourseId: { in: remove.map((c) => c.id) } },
        include: { _count: { select: { materials: true } }, curriculumCourse: { include: { course: { select: { code: true } } } } },
      });
      const withMaterials = offerings.filter((o) => o._count.materials > 0);
      if (withMaterials.length) throw conflict(`${withMaterials.map((o) => o.curriculumCourse.course.code).join(", ")} already ${withMaterials.length === 1 ? "has" : "have"} course materials, so ${withMaterials.length === 1 ? "it" : "they"} can't be removed from the structure.`);
      if (offerings.length) await tx.courseOffering.deleteMany({ where: { id: { in: offerings.map((o) => o.id) } } }); // lecturers/days cascade
      await tx.curriculumCourse.deleteMany({ where: { id: { in: remove.map((c) => c.id) } } });
    }
    for (const d of desired.values()) {
      const cur = byCourse.get(d.courseId);
      if (!cur) {
        await tx.curriculumCourse.create({ data: { curriculumId: curriculum.id, level: ctx.level, createdByUserId: dapuUserId, ...d } });
      } else if (cur.creditUnits !== d.creditUnits || cur.courseType !== d.courseType || cur.source !== d.source) {
        await tx.curriculumCourse.update({ where: { id: cur.id }, data: { creditUnits: d.creditUnits, courseType: d.courseType, source: d.source, ccmasProgrammeCourseId: d.ccmasProgrammeCourseId } });
      }
    }
    if ((await tx.curriculumCourse.count({ where: { curriculumId: curriculum.id } })) === 0) throw badRequest("A saved course structure needs at least one course.");
    if (!reopening) {
      await tx.curriculum.update({ where: { id: curriculum.id }, data: { status: "SAVED", savedAt: now } });
      return { curriculumId: curriculum.id, created, saved: desired.size, reopened: false as const, clearedRegistrations: 0, clearedStudentUserIds: [] as string[] };
    }

    // REOPEN: back to the HOD for re-approval (students stop seeing it until then), and the registrations
    // of the students this change affects — this programme + this level, this session + semester — are cleared
    // so they re-register from the re-approved structure. Registration items go with them (cascade).
    await tx.curriculum.update({
      where: { id: curriculum.id },
      data: {
        status: "PENDING_HOD", savedAt: now, passedToHodAt: now, approvedByUserId: null, approvedAt: null, publishedAt: null,
        hodNote: "Revised by DAPU after publication — please re-approve. Affected students' registrations were cleared.",
      },
    });
    const students = await tx.studentProfile.findMany({ where: { programmeId: resolved.programme.id, level: ctx.level }, select: { userId: true } });
    const regs = await tx.courseRegistration.findMany({
      where: { studentUserId: { in: students.map((x) => x.userId) }, academicSessionId: resolved.session.id, semesterId: resolved.semester.id },
      select: { id: true, studentUserId: true },
    });
    if (regs.length) await tx.courseRegistration.deleteMany({ where: { id: { in: regs.map((r) => r.id) } } });
    return { curriculumId: curriculum.id, created, saved: desired.size, reopened: true as const, clearedRegistrations: regs.length, clearedStudentUserIds: regs.map((r) => r.studentUserId) };
  });

  // Told only after the change has committed.
  if (result.reopened && hodForReopen) {
    const label = `${resolved.programme.name} — ${resolved.session.name} ${resolved.semester.name}`;
    await notifyUsers([hodForReopen.userId], {
      type: "CURRICULUM_REVIEW",
      title: "Published course structure changed — re-approval needed",
      message: `DAPU changed the published ${ctx.level} Level course structure for ${label}. Please review and re-approve it. Affected students' registrations were cleared.`,
      link: `/e-learning/hod/curriculum/${result.curriculumId}`,
    });
    await notifyUsers(result.clearedStudentUserIds, {
      type: "REGISTRATION_CLEARED",
      title: "Your course registration was cleared",
      message: `The ${ctx.level} Level course structure for ${resolved.session.name} ${resolved.semester.name} was changed, so your registration was cleared. Once the HOD re-approves it, please register your courses again.`,
      link: "/e-learning/student/course-control/registration",
    });
  }
  return result;
}
