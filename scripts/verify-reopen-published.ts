// DAPU changes an already-published course structure:
//   published -> DAPU changes + saves -> back to the HOD (PENDING_HOD) + affected students'
//   registrations cleared + HOD and students notified -> HOD re-approves -> students register again.
// Real student / Level Adviser / HOD accounts, non-current semester (Omega) with a temporary
// registration period, everything created is removed afterwards.
//
// Run: npx tsx --env-file=.env scripts/verify-reopen-published.ts

import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/service-error";
import { saveCourseSelection } from "../services/e-learning/dapu/curriculum/save-course-selection";
import { publishStructuresToHods } from "../services/e-learning/dapu/curriculum/publish-structures";
import { hodApproveCurriculum } from "../services/e-learning/hod/curriculum-review";
import { getStructureView } from "../services/e-learning/dapu/curriculum/get-structure-view";
import { type StructureContext } from "../services/e-learning/dapu/curriculum/context";
import { registerCourses, findRegistration, getRegistrationView } from "../services/e-learning/student/registration";
import { upsertTimeFrame } from "../services/e-learning/dapu/timeframes";

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) passed++; else failed++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
async function rejects(n: string, status: number, fn: () => Promise<unknown>, msg?: RegExp) {
  try { await fn(); ok(n, false, "was accepted"); } catch (e) { ok(n, e instanceof ServiceError && e.status === status && (!msg || msg.test(e.message)), e instanceof ServiceError ? `${e.status} ${e.message}` : String(e)); }
}

async function main() {
  const startedAt = new Date();
  const dapu = "verify-dapu";
  const u = await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } });
  const student = await db.studentProfile.findUniqueOrThrow({ where: { userId: u.id } });
  const college = await db.college.findFirstOrThrow({ where: { departments: { some: { id: student.departmentId } } } });
  const session = await db.academicSession.findFirstOrThrow({ where: { isCurrent: true }, include: { semesters: true } });
  const alpha = session.semesters.find((s) => s.isCurrent)!;
  const omega = session.semesters.find((s) => !s.isCurrent)!;
  const prog = await db.programme.findUniqueOrThrow({ where: { id: student.programmeId! }, include: { ccmasProgramme: true } });
  const hod = await db.hodProfile.findUniqueOrThrow({ where: { departmentId: student.departmentId } });
  const ctx = { session, semester: omega };
  const base: StructureContext = { collegeId: college.id, departmentId: prog.departmentId, programmeId: prog.id, level: student.level, academicSessionId: session.id, semesterId: omega.id };
  const notif = (userId: string, type: string) => core.notification.count({ where: { userId, type, createdAt: { gte: startedAt } } });
  const alphaRegBefore = await db.courseRegistration.count({ where: { studentUserId: student.userId, semesterId: alpha.id } });
  const hadFrame = await db.academicTimeFrame.findFirst({ where: { type: "COURSE_REGISTRATION", semesterId: omega.id } });
  const tmp = { students: [] as string[], courses: [] as string[], progId: "" };

  try {
    await db.academicTimeFrame.deleteMany({ where: { type: "COURSE_REGISTRATION", semesterId: omega.id } });
    await upsertTimeFrame("COURSE_REGISTRATION", session.id, omega.id, new Date(Date.now() - 3600_000), new Date(Date.now() + 3600_000));

    // ---- publish a structure the normal way: save -> HOD -> approve -----------------------------------------------------
    const rows = await db.cCMASProgrammeCourse.findMany({ where: { programmeId: prog.ccmasProgrammeId!, level: student.level }, take: 3, include: { course: true }, orderBy: { course: { code: "asc" } } });
    const s1 = await saveCourseSelection(dapu, base, { ccmasCourseIds: rows.map((r) => r.id), electiveCourseIds: [] });
    await publishStructuresToHods([s1.curriculumId]);
    await hodApproveCurriculum(hod, s1.curriculumId);
    ok("structure is PUBLISHED via DAPU → HOD (students can see it)", (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "PUBLISHED");

    // ---- student registers; a level-400 student also has a registration ---------------------------------------------------------
    const codes = rows.map((r) => r.course.code);
    const courseId = async (code: string) => (await db.course.findUniqueOrThrow({ where: { code } })).id;
    await registerCourses(student, ctx, [await courseId(codes[0]), await courseId(codes[1])]);
    ok("the student registered (PENDING_LEVEL_ADVISOR)", (await findRegistration(student.userId, ctx))?.status === "PENDING_LEVEL_ADVISOR");
    const other = await db.studentProfile.create({ data: { userId: "verify-student-400", departmentId: student.departmentId, programmeId: student.programmeId, level: 400, admissionSessionId: session.id } });
    tmp.students.push(other.userId);
    const spare = await db.course.create({ data: { code: `ZZW ${Date.now() % 900 + 100}`, title: "VERIFY-spare", creditUnits: 2 } });
    tmp.courses.push(spare.id);
    await db.courseRegistration.create({ data: { studentUserId: other.userId, academicSessionId: session.id, semesterId: omega.id, status: "APPROVED", items: { create: [{ courseId: spare.id }] } } });

    // ---- no-op: an identical selection does NOT reopen or clear anything -----------------------------------------------------------
    const same = await saveCourseSelection(dapu, base, { ccmasCourseIds: rows.map((r) => r.id), electiveCourseIds: [] });
    ok("saving an identical selection changes nothing (still PUBLISHED, registration kept)", !same.reopened && (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "PUBLISHED" && !!(await findRegistration(student.userId, ctx)));

    // ---- DAPU changes the published structure ------------------------------------------------------------------------------------------
    const editable = await getStructureView(base);
    ok("DAPU can open a published structure for editing", editable.editable && editable.curriculum?.status === "PUBLISHED");
    const nHod = await notif(hod.userId, "CURRICULUM_REVIEW"), nStu = await notif(student.userId, "REGISTRATION_CLEARED");
    const changed = await saveCourseSelection(dapu, base, { ccmasCourseIds: [rows[0].id, rows[2].id], electiveCourseIds: [] }); // drops course #2, keeps #1 and #3
    const cur = (await db.curriculum.findUnique({ where: { id: s1.curriculumId }, include: { courses: { include: { course: true } } } }))!;
    ok("the change was applied to the SAME structure (no duplicate)", changed.curriculumId === s1.curriculumId && cur.courses.length === 2 && !cur.courses.some((c) => c.course.code === codes[1]) && (await db.curriculum.count({ where: { programmeId: prog.id, semesterId: omega.id, status: { not: "ARCHIVED" } } })) === 1);
    ok("the structure went back to the HOD: PENDING_HOD, approval/publication cleared", changed.reopened && cur.status === "PENDING_HOD" && !cur.publishedAt && !cur.approvedAt && !cur.approvedByUserId && !!cur.hodNote);
    ok("the student's registration was cleared (registration + its items)", changed.clearedRegistrations === 1 && (await findRegistration(student.userId, ctx)) === null);
    ok("students at OTHER levels keep their registration", (await db.courseRegistration.count({ where: { studentUserId: other.userId, semesterId: omega.id } })) === 1);
    ok("other semesters are untouched (the student's Alpha registration is unchanged)", (await db.courseRegistration.count({ where: { studentUserId: student.userId, semesterId: alpha.id } })) === alphaRegBefore);
    ok("the HOD was told to re-approve", (await notif(hod.userId, "CURRICULUM_REVIEW")) === nHod + 1);
    const hodNote = await core.notification.findFirst({ where: { userId: hod.userId, type: "CURRICULUM_REVIEW", link: { contains: s1.curriculumId } }, orderBy: { createdAt: "desc" } });
    ok("…with a message that names the change and links to the structure", !!hodNote && /re-approv/i.test(hodNote.message) && hodNote.link!.includes(s1.curriculumId));
    ok("the affected student was told their registration was cleared", (await notif(student.userId, "REGISTRATION_CLEARED")) === nStu + 1);

    // ---- while awaiting re-approval ------------------------------------------------------------------------------------------------------
    const view = await getRegistrationView(student, ctx);
    ok("students no longer see the structure until it is re-approved", view.state === "NO_CURRICULUM");
    const keptId = await courseId(codes[0]);
    await rejects("students can't register meanwhile", 403, () => registerCourses(student, ctx, [keptId]), /published course structure/);
    await rejects("DAPU can't keep editing while it awaits the HOD", 409, () => saveCourseSelection(dapu, base, { ccmasCourseIds: [rows[0].id], electiveCourseIds: [] }));

    // ---- HOD re-approves; students register again ---------------------------------------------------------------------------------------------
    await hodApproveCurriculum(hod, s1.curriculumId);
    ok("the HOD re-approves → PUBLISHED again with a fresh approval", (await db.curriculum.findUnique({ where: { id: s1.curriculumId } }))?.status === "PUBLISHED");
    const again = await getRegistrationView(student, ctx);
    ok("students see the NEW course list (the removed course is gone) and nothing pre-selected", again.state === "READY" && again.courses.length === 2 && !again.courses.some((c) => c.code === codes[1]) && again.registered.length === 0 && again.registration === null);
    await registerCourses(student, ctx, [await courseId(codes[0])]);
    ok("the student registers again (PENDING_LEVEL_ADVISOR)", (await findRegistration(student.userId, ctx))?.status === "PENDING_LEVEL_ADVISOR");

    // ---- a department with no HOD can't reopen (nothing is lost) --------------------------------------------------------------------------------
    const otherDept = await db.department.findFirstOrThrow({ where: { id: { not: student.departmentId }, hodProfiles: { none: {} } } });
    const tp = await db.programme.create({ data: { code: `VERIFY-${Date.now()}`, name: "VERIFY programme", departmentId: otherDept.id } });
    tmp.progId = tp.id;
    const t1 = await db.course.create({ data: { code: `ZZX ${Date.now() % 900 + 100}`, title: "VERIFY-x1", creditUnits: 2 } }), t2 = await db.course.create({ data: { code: `ZZY ${Date.now() % 900 + 100}`, title: "VERIFY-x2", creditUnits: 2 } });
    tmp.courses.push(t1.id, t2.id);
    const ctxT: StructureContext = { collegeId: college.id, departmentId: otherDept.id, programmeId: tp.id, level: 100, academicSessionId: session.id, semesterId: omega.id };
    const tc = await db.curriculum.create({ data: { programmeId: tp.id, academicSessionId: session.id, semesterId: omega.id, name: "VERIFY", status: "PUBLISHED", createdByUserId: dapu, publishedAt: new Date() } });
    await db.curriculumCourse.create({ data: { curriculumId: tc.id, courseId: t1.id, level: 100, creditUnits: 2, courseType: "ELECTIVE", source: "UNIVERSITY" } });
    await rejects("a department with no HOD can't have a published structure reopened", 400, () => saveCourseSelection(dapu, ctxT, { ccmasCourseIds: [], electiveCourseIds: [t2.id] }), /no HOD/);
    ok("…and it stays PUBLISHED, unchanged", (await db.curriculum.findUnique({ where: { id: tc.id } }))?.status === "PUBLISHED" && (await db.curriculumCourse.count({ where: { curriculumId: tc.id } })) === 1);
  } finally {
    await db.courseRegistration.deleteMany({ where: { semesterId: omega.id } });
    const cs = await db.curriculum.findMany({ where: { createdByUserId: dapu } });
    const ids = cs.map((c) => c.id);
    await db.curriculum.deleteMany({ where: { id: { in: ids } } });
    await db.course.deleteMany({ where: { OR: [{ id: { in: tmp.courses } }, { createdAt: { gte: startedAt }, curriculumCourses: { none: {} } }] } });
    await db.studentProfile.deleteMany({ where: { userId: { in: tmp.students } } });
    if (tmp.progId) await db.programme.delete({ where: { id: tmp.progId } }).catch(() => {});
    await db.academicTimeFrame.deleteMany({ where: { type: "COURSE_REGISTRATION", semesterId: omega.id } });
    if (hadFrame) await db.academicTimeFrame.create({ data: { type: hadFrame.type, academicSessionId: hadFrame.academicSessionId, semesterId: hadFrame.semesterId, startDate: hadFrame.startDate, endDate: hadFrame.endDate } });
    await core.notification.deleteMany({ where: { scope: "ELEARNING", createdAt: { gte: startedAt }, OR: [{ type: { startsWith: "REGISTRATION_" } }, ...ids.map((id) => ({ link: { contains: id } }))] } });
    ok("cleanup: no test records remain; the student's Alpha registration is untouched", (await db.curriculum.count({ where: { createdByUserId: dapu } })) === 0 && (await db.courseRegistration.count({ where: { semesterId: omega.id } })) === 0 && (await db.courseRegistration.count({ where: { studentUserId: student.userId, semesterId: alpha.id } })) === alphaRegBefore);
  }
  console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
