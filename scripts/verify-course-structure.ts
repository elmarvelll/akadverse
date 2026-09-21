// scripts/verify-course-structure.ts
//
// End-to-end + negative checks, run against the real E-Learning + Core DBs through the
// same service functions the pages call, then cleaned up:
//   Add Course -> Course Structure (select CCMAS + Select Elective Course) -> Save Courses
//   -> Review Saved Courses -> Continue Editing -> Save Courses (same structure)
//   -> Publish to HOD(s) / All HODs -> HOD approve / return -> DAPU makes it available
//   -> student query on the published curriculum.
// There is no draft state anywhere in this flow.
// (Role gating — requireElearningRole/requireDapuProfile — lives in the server actions and
// needs a real session, so it is not exercised here.)
//
// Run: npx tsx --env-file=.env scripts/verify-course-structure.ts [EEE|CPE|ICE]

import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/service-error";
import { createCourse } from "../services/e-learning/dapu/course-structure";
import { saveCourseSelection } from "../services/e-learning/dapu/curriculum/save-course-selection";
import { getStructureView } from "../services/e-learning/dapu/curriculum/get-structure-view";
import { listElectiveCandidates } from "../services/e-learning/dapu/curriculum/list-elective-candidates";
import { listStructuresForReview } from "../services/e-learning/dapu/curriculum/list-structures-for-review";
import { publishStructuresToHods, submitCourseStructure } from "../services/e-learning/dapu/curriculum/publish-structures";
import { hodApproveCurriculum, hodReturnCurriculum, getCurriculumForHod } from "../services/e-learning/hod/curriculum-review";
import { type StructureContext } from "../services/e-learning/dapu/curriculum/context";
import { assignOrChangeLevelAdvisor } from "../services/e-learning/hod/level-advisors";

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};
async function rejects(name: string, status: number, fn: () => Promise<unknown>) {
  try { await fn(); ok(name, false, "was accepted"); } catch (e) { ok(name, e instanceof ServiceError && e.status === status, e instanceof ServiceError ? `${e.status} ${e.message}` : String(e)); }
}

async function main() {
  const startedAt = new Date();
  const tag = `VERIFY-${Date.now()}`;
  const dapu = "verify-dapu";
  const college = (await db.college.findUnique({ where: { code: "CoE" } }))!;
  const prog = (await db.programme.findUnique({ where: { code: process.argv[2] ?? "ICE" }, include: { ccmasProgramme: true, department: true } }))!;
  const dept = prog.department;
  const otherDept = (await db.department.findFirst({ where: { collegeId: college.id, id: { not: dept.id } } }))!;
  const session = (await db.academicSession.findFirst({ where: { isCurrent: true }, include: { semesters: true } }))!;
  const semester = session.semesters.find((s) => s.sequence === 2)!; // Omega: not the current semester
  const created = { sessionId: "", programmeId: "", hodProfileId: "" };
  const tmpFaculty: string[] = [];
  const uniq = () => `${Date.now() % 900 + 100}`;

  ok("programme is linked to CCMAS and named exactly as CCMAS", !!prog.ccmasProgramme && prog.name === prog.ccmasProgramme.name, `"${prog.name}"`);
  const base: StructureContext = { collegeId: college.id, departmentId: dept.id, programmeId: prog.id, level: 100, academicSessionId: session.id, semesterId: semester.id };
  const rows = (await getStructureView(base)).ccmasCourses;
  ok("CCMAS courses come from the database", rows.length >= 6, `${rows.length} rows at level 100`);
  const hod = await db.hodProfile.findUnique({ where: { departmentId: dept.id } });
  if (!hod) { ok("department has a HOD (link a HOD account)", false); return; }
  const notifCount = (type: string) => core.notification.count({ where: { userId: hod.userId, type, createdAt: { gte: startedAt } } });
  const curriculaBefore = await db.curriculum.count();
  const coursesBefore = await db.course.count();

  try {
    // ---- A. Add Course: a reusable Course only, no curriculum ----------------------------------
    const code = `ZZZ ${uniq()}`;
    const a1 = await createCourse({ code: code.toLowerCase(), title: `${tag} elective`, creditUnits: 2, departmentId: dept.id, description: "test" });
    ok("Add Course creates a reusable Course", a1.created && a1.course.code === code, a1.course.code);
    ok("Add Course created NO curriculum and no CurriculumCourse", (await db.curriculum.count()) === curriculaBefore && (await db.curriculumCourse.count({ where: { courseId: a1.course.id } })) === 0);
    const a2 = await createCourse({ code, title: "different title", creditUnits: 5 });
    ok("creating the same code again reuses it (no duplicate)", !a2.created && a2.course.id === a1.course.id && (await db.course.count({ where: { code } })) === 1);
    const ccmasCode = (await db.cCMASCourse.findFirst({ where: { code: { not: { in: (await db.course.findMany({ select: { code: true } })).map((c) => c.code) } } } }))!.code;
    await rejects("a CCMAS course code can't be created as a university course", 400, () => createCourse({ code: ccmasCode, title: "x", creditUnits: 2 }));
    await rejects("invalid credit units", 400, () => createCourse({ code: "ZZQ 001", title: "x", creditUnits: 0 }));
    const elective2 = (await createCourse({ code: `ZZY ${uniq()}`, title: `${tag} second elective`, creditUnits: 3 })).course;

    // ---- B. Course Structure: context + CCMAS load + elective candidates ------------------------
    await rejects("invalid College→Department→Programme", 400, () => getStructureView({ ...base, departmentId: otherDept.id }));
    const tmpSession = await db.academicSession.create({ data: { name: tag } });
    created.sessionId = tmpSession.id;
    await rejects("semester from another session", 400, () => getStructureView({ ...base, academicSessionId: tmpSession.id }));
    const cands = await listElectiveCandidates();
    ok("Select Elective Course offers university courses created via Add Course", cands.some((c) => c.id === a1.course.id) && cands.some((c) => c.id === elective2.id));
    ok("…and no CCMAS-coded courses", !cands.some((c) => rows.some((r) => r.code === c.code)));

    // ---- C/D. Save Courses: complete selection, no draft, no HOD, no students --------------------
    const pick = rows.slice(0, 4);
    const n0 = await notifCount("CURRICULUM_REVIEW");
    await rejects("saving an empty selection with nothing saved", 400, () => saveCourseSelection(dapu, base, { ccmasCourseIds: [], electiveCourseIds: [] }));
    await rejects("CCMAS course of another programme (ID tampering)", 400, async () => saveCourseSelection(dapu, base, { ccmasCourseIds: [(await db.cCMASProgrammeCourse.findFirst({ where: { programmeId: { not: prog.ccmasProgrammeId! } } }))!.id], electiveCourseIds: [] }));
    const otherLevelRow = await db.cCMASProgrammeCourse.findFirst({ where: { programmeId: prog.ccmasProgrammeId!, level: { not: 100 } } });
    await rejects("CCMAS course of another level", 400, () => saveCourseSelection(dapu, base, { ccmasCourseIds: [otherLevelRow!.id], electiveCourseIds: [] }));
    await rejects("unknown elective id", 400, () => saveCourseSelection(dapu, base, { ccmasCourseIds: [pick[0].id], electiveCourseIds: ["nope"] }));
    const ccmasAsCourse = await db.course.create({ data: { code: ccmasCode, title: `${tag} ccmas-coded`, creditUnits: 2 } });
    await rejects("a CCMAS-coded course can't be saved as an elective", 400, () => saveCourseSelection(dapu, base, { ccmasCourseIds: [pick[0].id], electiveCourseIds: [ccmasAsCourse.id] }));
    ok("failed saves left nothing behind", (await db.curriculum.count()) === curriculaBefore);

    const s1 = await saveCourseSelection(dapu, base, { ccmasCourseIds: pick.map((p) => p.id), electiveCourseIds: [a1.course.id] });
    const cur1 = (await db.curriculum.findUnique({ where: { id: s1.curriculumId }, include: { courses: { include: { course: true } } } }))!;
    ok("Save Courses stores the complete selection (4 CCMAS + 1 elective)", s1.created && cur1.courses.length === 5);
    ok("status is SAVED — there is no draft", cur1.status === "SAVED" && !!cur1.savedAt && !cur1.passedToHodAt);
    ok("nothing is DRAFT anywhere", (await db.curriculum.count({ where: { status: "DRAFT" } })) === 0);
    const el = cur1.courses.find((c) => c.courseId === a1.course.id);
    ok("elective saved as ELECTIVE / UNIVERSITY with no CCMAS link", el?.courseType === "ELECTIVE" && el.source === "UNIVERSITY" && !el.ccmasProgrammeCourseId);
    ok("CCMAS courses saved with exact code/title/units and source CCMAS", pick.every((p) => cur1.courses.some((c) => c.course.code === p.code && c.course.title === p.title && c.creditUnits === p.creditUnits && c.source === "CCMAS")));
    ok("saving did NOT notify the HOD", (await notifCount("CURRICULUM_REVIEW")) === n0);
    ok("students see nothing yet (no PUBLISHED curriculum)", (await db.curriculumCourse.count({ where: { curriculumId: s1.curriculumId, curriculum: { status: "PUBLISHED" } } })) === 0);

    // ---- E. Review Saved Courses -----------------------------------------------------------------
    const lvl2 = await db.cCMASProgrammeCourse.findFirst({ where: { programmeId: prog.ccmasProgrammeId!, level: { not: 100 } } });
    if (lvl2) await saveCourseSelection(dapu, { ...base, level: lvl2.level }, { ccmasCourseIds: [lvl2.id], electiveCourseIds: [] });
    const expected = 5 + (lvl2 ? 1 : 0);
    const review = (await listStructuresForReview({ programmeId: prog.id, academicSessionId: session.id, semesterId: semester.id })).filter((s) => s.id === s1.curriculumId);
    const rv = review[0];
    const dbUnits = (await db.curriculumCourse.findMany({ where: { curriculumId: s1.curriculumId } })).reduce((n, c) => n + c.creditUnits, 0);
    ok("Review Saved Courses lists ALL saved courses (both levels)", review.length === 1 && rv.totalCourses === expected, `${rv?.totalCourses}/${expected}`);
    ok("total credit units come from the database", rv.totalUnits === dbUnits, `${rv.totalUnits}`);
    ok("grouped by level, one structure for this programme+session+semester", rv.byLevel.length === (lvl2 ? 2 : 1));
    ok("context is correct", rv.programme.name === prog.name && rv.academicSession.name === session.name && rv.semester.name === semester.name);
    const alpha = (await db.semester.findFirst({ where: { academicSessionId: session.id, sequence: 1 } }))!;
    ok("another semester's structures are not mixed in", !(await listStructuresForReview({ programmeId: prog.id, semesterId: alpha.id })).some((s) => s.id === s1.curriculumId));

    // ---- F. Continue Editing: same structure, updated -------------------------------------------
    const view = await getStructureView(base);
    ok("Continue Editing loads the saved selection (CCMAS ticked, elective selected)", view.ccmasCourses.filter((c) => c.alreadySelected).length === 4 && view.selectedElectiveIds.includes(a1.course.id) && view.editable);
    const s2 = await saveCourseSelection(dapu, base, { ccmasCourseIds: [pick[0].id, pick[1].id, pick[2].id, rows[4].id], electiveCourseIds: [elective2.id] });
    const cur2 = await db.curriculumCourse.findMany({ where: { curriculumId: s1.curriculumId, level: 100 }, include: { course: true } });
    ok("saving again UPDATES the same structure (no duplicate curriculum)", s2.curriculumId === s1.curriculumId && !s2.created && (await db.curriculum.count({ where: { programmeId: prog.id, academicSessionId: session.id, semesterId: semester.id, status: { not: "ARCHIVED" } } })) === 1);
    ok("removed courses are gone; new ones are in", !cur2.some((c) => c.course.code === pick[3].code) && cur2.some((c) => c.course.code === rows[4].code) && !cur2.some((c) => c.courseId === a1.course.id) && cur2.some((c) => c.courseId === elective2.id), `${cur2.length} courses at 100L`);
    ok("the other level's courses were left untouched", !lvl2 || (await db.curriculumCourse.count({ where: { curriculumId: s1.curriculumId, level: lvl2.level } })) === 1);
    const ex = await db.course.findUnique({ where: { id: a1.course.id } });
    ok("a de-selected elective still exists as a reusable Course", !!ex);
    ok("still SAVED and HOD still not notified", (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "SAVED" && (await notifCount("CURRICULUM_REVIEW")) === n0);
    const expected2 = 5 + (lvl2 ? 1 : 0);

    // ---- G. Publish to HOD(s) ------------------------------------------------------------------
    const tmpProg = await db.programme.create({ data: { code: tag, name: `${tag} programme`, departmentId: otherDept.id } });
    created.programmeId = tmpProg.id;
    const ctxB: StructureContext = { collegeId: college.id, departmentId: otherDept.id, programmeId: tmpProg.id, level: 100, academicSessionId: session.id, semesterId: semester.id };
    const b = await saveCourseSelection(dapu, ctxB, { ccmasCourseIds: [], electiveCourseIds: [elective2.id] });
    ok("an unlinked programme can still save electives", b.created);

    const nA = await notifCount("CURRICULUM_REVIEW");
    const all = await publishStructuresToHods([s1.curriculumId, b.curriculumId]);
    ok("Publish to All HODs: A goes to its department's HOD; B skipped (its department has no HOD)", all.published.length === 1 && all.published[0].id === s1.curriculumId && all.skipped.some((s) => s.id === b.curriculumId && /no HOD/.test(s.reason)));
    ok("A is PENDING_HOD; B stays SAVED", (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "PENDING_HOD" && (await db.curriculum.findUnique({ where: { id: b.curriculumId } }))?.status === "SAVED");
    ok("the HOD got exactly one notification", (await notifCount("CURRICULUM_REVIEW")) === nA + 1);
    const note = await core.notification.findFirst({ where: { userId: hod.userId, type: "CURRICULUM_REVIEW", link: { contains: s1.curriculumId } }, orderBy: { createdAt: "desc" } });
    ok("notification names programme, session, semester, courses/units and links to the structure", !!note && note.message.includes(prog.name) && note.message.includes(session.name) && note.message.includes(semester.name) && note.message.includes(`${expected2} courses`), note?.message.slice(0, 120));
    const again = await publishStructuresToHods([s1.curriculumId]);
    ok("publishing again creates no duplicate submission or notification", again.published.length === 0 && /Awaiting HOD/i.test(again.skipped[0].reason) && (await notifCount("CURRICULUM_REVIEW")) === nA + 1);
    await rejects("single publish of an already-submitted structure", 409, () => submitCourseStructure(s1.curriculumId));
    await rejects("editing while pending HOD", 409, () => saveCourseSelection(dapu, base, { ccmasCourseIds: [pick[0].id], electiveCourseIds: [] }));
    const tmpHod = await db.hodProfile.create({ data: { userId: "verify-hod-user", departmentId: otherDept.id } });
    created.hodProfileId = tmpHod.id;
    ok("once its department has a HOD, B publishes to that HOD", (await publishStructuresToHods([b.curriculumId])).published.length === 1);

    // ---- I. HOD ------------------------------------------------------------------------------------
    const foreignHod = { ...hod, departmentId: otherDept.id };
    await rejects("another department's HOD cannot open it", 403, () => getCurriculumForHod(foreignHod, s1.curriculumId));
    await rejects("another department's HOD cannot approve it", 403, () => hodApproveCurriculum(foreignHod, s1.curriculumId));
    await rejects("another department's HOD cannot return it", 403, () => hodReturnCurriculum(foreignHod, s1.curriculumId, "x"));
    ok("the HOD receives the complete structure", (await getCurriculumForHod(hod, s1.curriculumId)).courses.length === expected2);
    await rejects("return needs a note", 400, () => hodReturnCurriculum(hod, s1.curriculumId, " "));
    await hodReturnCurriculum(hod, s1.curriculumId, "Verification: please revisit the electives.");
    ok("HOD return → RETURNED with the note", (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "RETURNED");
    await rejects("approving a returned structure", 409, () => hodApproveCurriculum(hod, s1.curriculumId));
    await saveCourseSelection(dapu, base, { ccmasCourseIds: [pick[0].id, pick[1].id, pick[2].id, rows[4].id], electiveCourseIds: [elective2.id, a1.course.id] });
    ok("editing a returned structure and saving makes it SAVED again (same curriculum)", (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "SAVED" && (await db.curriculum.count({ where: { programmeId: prog.id, academicSessionId: session.id, semesterId: semester.id, status: { not: "ARCHIVED" } } })) === 1);
    ok("revision re-published", (await publishStructuresToHods([s1.curriculumId])).published.length === 1);
    await rejects("HOD approval blocked without Level Advisors", 400, () => hodApproveCurriculum(hod, s1.curriculumId));
    // One temporary faculty member per level (a person advises one level per session), so the real assignment is never touched.
    const levels = [...new Set((await db.curriculumCourse.findMany({ where: { curriculumId: s1.curriculumId } })).map((c) => c.level))];
    {
      for (const level of levels) {
        const f = await db.facultyProfile.create({ data: { userId: `verify-fac-${level}`, departmentId: dept.id } });
        tmpFaculty.push(f.userId);
        await assignOrChangeLevelAdvisor(hod, { facultyUserId: f.userId, programmeId: prog.id, level, academicSessionId: session.id });
      }
      await hodApproveCurriculum(hod, s1.curriculumId);
      const done = await db.curriculum.findUnique({ where: { id: s1.curriculumId } });
      ok("HOD approves → PUBLISHED directly (DAPU → HOD → students; no extra step)", done?.status === "PUBLISHED" && !!done.publishedAt && !!done.approvedAt && done.approvedByUserId === hod.userId);
      // ---- J. Student ---------------------------------------------------------------------------------
      const student = await db.curriculumCourse.findMany({ where: { level: 100, curriculum: { programmeId: prog.id, academicSessionId: session.id, semesterId: semester.id, status: "PUBLISHED" } }, include: { course: true } });
      const in100 = await db.curriculumCourse.count({ where: { curriculumId: s1.curriculumId, level: 100 } });
      ok("a 100L student's courses come from the published curriculum", student.length === in100 && student.length > 0 && student.every((s) => s.course.code !== "EEE301"), `${student.length} courses`);
    }
  } finally {
    // ---- cleanup of everything this run created --------------------------------------------------------
    const cur = await db.curriculum.findMany({ where: { createdByUserId: dapu } });
    const ids = cur.map((c) => c.id);
    // Clear the flag with the pointer first: the DB CHECK ties them together.
    await db.facultyProfile.updateMany({ where: { userId: { in: tmpFaculty } }, data: { isLevelAdviser: false, levelAdvisorId: null, levelAdviserOf: null } });
    await db.levelAdvisorAssignment.deleteMany({ where: { facultyUserId: { in: tmpFaculty } } });
    await db.facultyProfile.deleteMany({ where: { userId: { in: tmpFaculty } } });
    await db.curriculum.deleteMany({ where: { id: { in: ids } } });
    await db.course.deleteMany({ where: { createdAt: { gte: startedAt }, curriculumCourses: { none: {} } } });
    if (created.hodProfileId) await db.hodProfile.delete({ where: { id: created.hodProfileId } }).catch(() => {});
    if (created.programmeId) await db.programme.delete({ where: { id: created.programmeId } }).catch(() => {});
    if (created.sessionId) await db.academicSession.delete({ where: { id: created.sessionId } }).catch(() => {});
    if (ids.length) await core.notification.deleteMany({ where: { scope: "ELEARNING", OR: ids.map((id) => ({ link: { contains: id } })) } });
    ok("cleanup restored the database (curricula and courses back to their starting counts)", (await db.curriculum.count()) === curriculaBefore && (await db.course.count()) === coursesBefore);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
