// scripts/verify-student-registration.ts
//
// Registration lifecycle against the real E-Learning + Core DBs, with the real test student,
// Level Adviser and HOD, through the SAME service functions the pages/actions call. It works in the
// non-current semester (Omega) with temporary courses, students, a credit rule and a registration
// period, and removes everything it created (the real Alpha data is never touched).
//
//   STUDENT registerCourses -> PENDING_LEVEL_ADVISOR -> LEVEL ADVISOR (approve / approve all)
//   -> PENDING_HOD -> HOD -> APPROVED -> history + My Courses      (no DAPU step anywhere)
//
// Run: npx tsx --env-file=.env scripts/verify-student-registration.ts

import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/service-error";
import { registerCourses, findRegistration, getRegistrationView, getRegistrationHistory } from "../services/e-learning/student/registration";
import { getRegisteredCourses } from "../services/e-learning/student/registered-courses";
import { approveRegistration as laApprove, approveAll as laApproveAll, rejectRegistration as laReject, getReviewQueue } from "../services/e-learning/level-adviser/registrations";
import { approveRegistration as hodApprove } from "../services/e-learning/hod/registration-approvals";
import { getTimeFrame, phaseAt } from "../services/e-learning/shared/timeframes";
import { upsertTimeFrame } from "../services/e-learning/dapu/timeframes";
import { assignOrChangeLevelAdvisor } from "../services/e-learning/hod/level-advisors";

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};
async function rejects(name: string, status: number, fn: () => Promise<unknown>, msg?: RegExp) {
  try { await fn(); ok(name, false, "was accepted"); } catch (e) {
    const good = e instanceof ServiceError && e.status === status && (!msg || msg.test(e.message));
    ok(name, good, e instanceof ServiceError ? `${e.status} ${e.message}` : String(e));
  }
}

async function main() {
  const startedAt = new Date();
  const tag = `VERIFY-${Date.now()}`;
  const u = await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } });
  const student = await db.studentProfile.findUniqueOrThrow({ where: { userId: u.id } });
  const session = await db.academicSession.findFirstOrThrow({ where: { isCurrent: true }, include: { semesters: true } });
  const alpha = session.semesters.find((s) => s.isCurrent)!;
  const omega = session.semesters.find((s) => !s.isCurrent)!;
  const ctx = { session, semester: omega };
  const assignment = await db.levelAdvisorAssignment.findUniqueOrThrow({ where: { programmeId_level_academicSessionId: { programmeId: student.programmeId!, level: student.level, academicSessionId: session.id } } });
  const adviser = await db.facultyProfile.findUniqueOrThrow({ where: { userId: assignment.facultyUserId } });
  const hod = await db.hodProfile.findUniqueOrThrow({ where: { departmentId: student.departmentId } });
  const otherDept = await db.department.findFirstOrThrow({ where: { id: { not: student.departmentId } } });
  const cpe = await db.programme.findFirstOrThrow({ where: { departmentId: student.departmentId, id: { not: student.programmeId! } } });
  const alphaRegBefore = await db.courseRegistration.findMany({ where: { studentUserId: student.userId, semesterId: alpha.id }, select: { id: true, status: true } });
  const hadFrame = await db.academicTimeFrame.findFirst({ where: { type: "COURSE_REGISTRATION", semesterId: omega.id } });
  const tmp = { courses: [] as string[], students: [] as string[], faculty: [] as string[], rule: "" };
  const notif = (userId: string, type: string) => core.notification.count({ where: { userId, type, createdAt: { gte: startedAt } } });
  const H = 3600_000;
  const setPeriod = async (s: number | null, e: number | null) => {
    await db.academicTimeFrame.deleteMany({ where: { type: "COURSE_REGISTRATION", academicSessionId: session.id, semesterId: omega.id } });
    if (s !== null && e !== null) await upsertTimeFrame("COURSE_REGISTRATION", session.id, omega.id, new Date(Date.now() + s), new Date(Date.now() + e));
  };
  const mkStudent = async (id: string, programmeId: string, level: number) => { tmp.students.push(id); return db.studentProfile.create({ data: { userId: id, departmentId: student.departmentId, programmeId, level, admissionSessionId: session.id } }); };
  const mkReg = async (studentUserId: string, courseIds: string[], status: "PENDING_LEVEL_ADVISOR" | "PENDING_HOD" = "PENDING_LEVEL_ADVISOR") =>
    db.courseRegistration.create({ data: { studentUserId, academicSessionId: session.id, semesterId: omega.id, status, submittedAt: new Date(), items: { create: courseIds.map((courseId) => ({ courseId })) } } });

  try {
    // ---- temporary curriculum: EEE 300 Omega = A(core 3) B(core 3) F(core 3) C(elective 2); D is 400L; E belongs to another programme ----
    const mk = async (code: string, title: string, units: number) => { const c = await db.course.create({ data: { code, title: `${tag} ${title}`, creditUnits: units } }); tmp.courses.push(c.id); return c; };
    const n = Date.now() % 900;
    const [A, B, F, C, D, E] = [await mk(`ZZA ${n + 100}`, "A", 3), await mk(`ZZB ${n + 100}`, "B", 3), await mk(`ZZF ${n + 100}`, "F", 3), await mk(`ZZC ${n + 100}`, "C", 2), await mk(`ZZD ${n + 100}`, "D 400L", 2), await mk(`ZZE ${n + 100}`, "E other", 3)];
    const cur = await db.curriculum.create({ data: { programmeId: student.programmeId!, academicSessionId: session.id, semesterId: omega.id, name: tag, status: "PUBLISHED", createdByUserId: "verify-student", version: 900 + Math.floor(Math.random() * 90) } });
    await db.curriculumCourse.createMany({ data: [
      { curriculumId: cur.id, courseId: A.id, level: 300, creditUnits: 3, courseType: "CORE" }, { curriculumId: cur.id, courseId: B.id, level: 300, creditUnits: 3, courseType: "CORE" },
      { curriculumId: cur.id, courseId: F.id, level: 300, creditUnits: 3, courseType: "CORE" }, { curriculumId: cur.id, courseId: C.id, level: 300, creditUnits: 2, courseType: "ELECTIVE" },
      { curriculumId: cur.id, courseId: D.id, level: 400, creditUnits: 2, courseType: "CORE" },
    ] });
    const cur2 = await db.curriculum.create({ data: { programmeId: cpe.id, academicSessionId: session.id, semesterId: omega.id, name: `${tag}-cpe`, status: "PUBLISHED", createdByUserId: "verify-student" } });
    await db.curriculumCourse.create({ data: { curriculumId: cur2.id, courseId: E.id, level: 300, creditUnits: 3, courseType: "CORE" } });
    tmp.rule = (await db.academicRule.create({ data: { programmeId: student.programmeId!, level: 300, semesterId: omega.id, minCreditUnits: 5, maxCreditUnits: 8 } })).id;

    // ---- registration period phases ------------------------------------------------------------------------------------
    await setPeriod(null, null);
    await rejects("NOT_CONFIGURED: registering is rejected", 403, () => registerCourses(student, ctx, [A.id]), /not currently available/);
    await setPeriod(H, 2 * H);
    const up = await getRegistrationView(student, ctx);
    ok("UPCOMING: courses are viewable and the start time is provided for the countdown", up.state === "READY" && up.period.phase === "UPCOMING" && up.courses.length === 4 && !!up.period.startAt);
    ok("UPCOMING: viewing wrote nothing", (await findRegistration(student.userId, ctx)) === null);
    await rejects("UPCOMING: registering is rejected", 403, () => registerCourses(student, ctx, [A.id, B.id]), /hasn't opened yet/);
    ok("UPCOMING: nothing was created by the rejected attempt", (await findRegistration(student.userId, ctx)) === null);
    await setPeriod(-H, H);
    ok("ACTIVE is derived from the timestamps", (await getTimeFrame("COURSE_REGISTRATION", session.id, omega.id)).phase === "ACTIVE");
    const v = await getRegistrationView(student, ctx);
    ok("only this student's programme + level + session + semester + PUBLISHED courses are offered (not D=400L, not E=other programme)", v.state === "READY" && v.courses.length === 4 && [A, B, F, C].every((c) => v.courses.some((x) => x.id === c.id)) && !v.courses.some((x) => x.id === D.id || x.id === E.id));

    // ---- Register Courses: validation -------------------------------------------------------------------------------------
    await rejects("register with nothing selected", 400, () => registerCourses(student, ctx, []));
    await rejects("a course from another level is rejected", 403, () => registerCourses(student, ctx, [A.id, D.id]), /published course structure/);
    await rejects("a course from another programme is rejected", 403, () => registerCourses(student, ctx, [A.id, E.id]), /published course structure/);
    await rejects("an unknown course id is rejected", 403, () => registerCourses(student, ctx, ["nope"]), /published course structure/);
    await rejects("credit limit exceeded (11 > 8)", 400, () => registerCourses(student, ctx, [A.id, B.id, F.id, C.id]), /Credit limit exceeded/);
    await rejects("below the credit minimum (3 < 5)", 400, () => registerCourses(student, ctx, [A.id]), /minimum/);
    ok("no failed attempt created a registration", (await findRegistration(student.userId, ctx)) === null);

    // ---- a double submit can create only one registration (the DB is the last line of defence) ----------------------------
    const race = await mkStudent("verify-race", student.programmeId!, 300);
    const results = await Promise.allSettled([registerCourses(race, ctx, [A.id, B.id]), registerCourses(race, ctx, [A.id, B.id])]);
    ok("two simultaneous submits → exactly one succeeds", results.filter((r) => r.status === "fulfilled").length === 1 && (await db.courseRegistration.count({ where: { studentUserId: race.userId, semesterId: omega.id } })) === 1);

    // ---- successful registration -------------------------------------------------------------------------------------------
    const nLA = await notif(adviser.userId, "REGISTRATION_SUBMITTED");
    await registerCourses(student, ctx, [A.id, B.id, A.id]); // a duplicate id in the payload is collapsed
    const reg = (await findRegistration(student.userId, ctx))!;
    ok("Register Courses → PENDING_LEVEL_ADVISOR with the selected courses (duplicates collapsed)", reg.status === "PENDING_LEVEL_ADVISOR" && reg.items.length === 2 && !!reg.submittedAt);
    ok("the correct Level Advisor was notified", (await notif(adviser.userId, "REGISTRATION_SUBMITTED")) >= nLA + 1);
    await rejects("registering again is rejected (one registration per semester)", 403, () => registerCourses(student, ctx, [A.id, B.id]), /already registered/);

    // ---- other students in and out of the adviser's scope ----------------------------------------------------------------------
    const s2 = await mkStudent("verify-s2", student.programmeId!, 300), s3 = await mkStudent("verify-s3", student.programmeId!, 400), s4 = await mkStudent("verify-s4", cpe.id, 300), s6 = await mkStudent("verify-s6", student.programmeId!, 300);
    const r2 = await mkReg(s2.userId, [A.id, B.id, C.id]), r3 = await mkReg(s3.userId, [D.id]), r4 = await mkReg(s4.userId, [E.id]), r6 = await mkReg(s6.userId, [A.id, B.id]);
    void r3; void r4;

    // ---- Level Advisor review ---------------------------------------------------------------------------------------------------
    const q = await getReviewQueue(adviser, ctx);
    if (q.state !== "READY") throw new Error("review queue not ready: " + q.state);
    const mine = q.registrations.find((x) => x.id === reg.id)!;
    ok("the review shows exactly the adviser's students (EEE 300): real student, race, s2, s6 — not s3 (400L) or s4 (other programme)", [reg.id, r2.id, r6.id].every((id) => q.registrations.some((x) => x.id === id)) && !q.registrations.some((x) => [r3.id, r4.id].includes(x.id)));
    ok("student context shown: name, level, programme/department/session/semester", !!mine.studentName && mine.level === 300 && q.context.programme.includes(String((await db.programme.findUniqueOrThrow({ where: { id: student.programmeId! } })).code)) && q.context.session === session.name && q.context.semester === omega.name && !!q.context.department);
    ok("counts computed from the database: 4 applicable, 2 submitted, 2 not selected", mine.summary.applicableCourses === 4 && mine.summary.submittedCourses === 2 && mine.summary.notSelectedCourses === 2);
    ok("units: curriculum 11, required (core) 9, submitted 6", mine.summary.curriculumUnits === 11 && mine.summary.requiredCoreUnits === 9 && mine.summary.submittedUnits === 6);
    ok("the FULL curriculum is compared (4 rows) with Submitted / Not Selected and correct types", mine.rows.length === 4 && mine.rows.find((r) => r.courseId === A.id)?.status === "Submitted" && mine.rows.find((r) => r.courseId === F.id)?.status === "Not Selected" && mine.rows.find((r) => r.courseId === C.id)?.courseType === "ELECTIVE" && mine.rows.find((r) => r.courseId === F.id)?.courseType === "CORE");
    ok("only an unselected CORE course counts as missing — the unselected elective is not flagged", JSON.stringify(mine.summary.missingCore) === JSON.stringify([F.code]) && !mine.summary.missingCore.includes(C.code));
    ok("the credit rule is shown (5–8)", q.rule?.min === 5 && q.rule?.max === 8);

    // ---- authorization ---------------------------------------------------------------------------------------------------------------
    const stranger = await db.facultyProfile.create({ data: { userId: "verify-stranger", departmentId: student.departmentId } });
    tmp.faculty.push(stranger.userId);
    await rejects("a faculty member who isn't a Level Advisor can't approve", 403, () => laApprove(stranger, reg.id), /scope/);
    await rejects("…nor Approve All", 403, () => laApproveAll(stranger, ctx), /no Level Advisor assignment/);
    const otherAdv = await db.facultyProfile.create({ data: { userId: "verify-other-adviser", departmentId: student.departmentId } });
    tmp.faculty.push(otherAdv.userId);
    await assignOrChangeLevelAdvisor(hod, { programmeId: cpe.id, level: 300, academicSessionId: session.id, facultyUserId: otherAdv.userId });
    const otherAdvisor = await db.facultyProfile.findUniqueOrThrow({ where: { userId: otherAdv.userId } });
    await rejects("another programme's Level Advisor can't approve this student", 403, () => laApprove(otherAdvisor, reg.id), /scope/);
    await rejects("the adviser can't approve another LEVEL's registration (400L)", 403, () => laApprove(adviser, r3.id), /scope/);
    await rejects("the adviser can't approve another PROGRAMME's registration", 403, () => laApprove(adviser, r4.id), /scope/);
    await rejects("HOD can't approve before the Level Advisor has", 403, () => hodApprove(hod, reg.id), /isn't awaiting HOD/);

    // ---- reject then register again --------------------------------------------------------------------------------------------------
    await laReject(adviser, r6.id, "verification");
    ok("Level Advisor rejects → REJECTED", (await db.courseRegistration.findUnique({ where: { id: r6.id } }))?.status === "REJECTED");
    await rejects("a rejected registration can't be approved", 403, () => laApprove(adviser, r6.id), /isn't awaiting/);
    await registerCourses(s6, ctx, [A.id, B.id, C.id]);
    const r6b = (await findRegistration(s6.userId, ctx))!;
    ok("after a rejection the student can register again (same record, new courses, back to PENDING_LEVEL_ADVISOR)", r6b.id === r6.id && r6b.status === "PENDING_LEVEL_ADVISOR" && r6b.items.length === 3 && r6b.decisionNote === null);

    // ---- approval: individual, then Approve All ----------------------------------------------------------------------------------------------
    const nHod = await notif(hod.userId, "REGISTRATION_PENDING_HOD");
    await laApprove(adviser, reg.id);
    ok("Level Advisor approves → PENDING_HOD, HOD notified", (await findRegistration(student.userId, ctx))?.status === "PENDING_HOD" && (await notif(hod.userId, "REGISTRATION_PENDING_HOD")) === nHod + 1);
    const all = await laApproveAll(adviser, ctx);
    const statusOf = async (id: string) => (await db.courseRegistration.findUnique({ where: { id } }))?.status;
    ok("Approve All approved every remaining registration in the adviser's scope (race, s2, s6)", all.approved === 3 && (await statusOf(r2.id)) === "PENDING_HOD" && (await statusOf(r6.id)) === "PENDING_HOD");
    ok("…and did NOT touch other levels/programmes", (await statusOf(r3.id)) === "PENDING_LEVEL_ADVISOR" && (await statusOf(r4.id)) === "PENDING_LEVEL_ADVISOR");
    ok("Approve All notified the HOD once", (await notif(hod.userId, "REGISTRATION_PENDING_HOD")) === nHod + 2);
    ok("running Approve All again approves nothing", (await laApproveAll(adviser, ctx)).approved === 0);
    const cpeAll = await laApproveAll(otherAdvisor, ctx);
    ok("another adviser's Approve All only reaches their own scope (CPE 300)", cpeAll.approved === 1 && (await statusOf(r4.id)) === "PENDING_HOD" && (await statusOf(r3.id)) === "PENDING_LEVEL_ADVISOR");

    // ---- the period governs the Level Advisor (server-side) ------------------------------------------------------------------------------------
    const s7 = await mkStudent("verify-s7", student.programmeId!, 300);
    const r7 = await mkReg(s7.userId, [A.id]);
    await setPeriod(-2 * H, -5); // ended 5 ms ago
    ok("ENDED at the exact end instant (end is exclusive)", (await getTimeFrame("COURSE_REGISTRATION", session.id, omega.id)).phase === "ENDED" && phaseAt(new Date(1000), new Date(0), new Date(1000)) === "ENDED" && phaseAt(new Date(999), new Date(0), new Date(1000)) === "ACTIVE");
    await rejects("ENDED: individual Level Advisor approval is rejected", 403, () => laApprove(adviser, r7.id), /closed/);
    await rejects("ENDED: Approve All is rejected", 403, () => laApproveAll(adviser, ctx), /closed/);
    await rejects("ENDED: Level Advisor rejection is rejected", 403, () => laReject(adviser, r7.id, null), /closed/);
    ok("…and nothing changed", (await statusOf(r7.id)) === "PENDING_LEVEL_ADVISOR");
    await setPeriod(H, 2 * H);
    await rejects("UPCOMING: Level Advisor approval is rejected too", 403, () => laApprove(adviser, r7.id), /hasn't opened/);
    await setPeriod(null, null);
    await rejects("NOT_CONFIGURED: Level Advisor approval is rejected", 403, () => laApprove(adviser, r7.id), /not currently available/);
    await rejects("ENDED/closed: a student can't register", 403, () => registerCourses(s7, ctx, [A.id]), /already registered|not currently/);

    // ---- HOD: final approval, NOT gated by the registration period ---------------------------------------------------------------------------------
    await setPeriod(-2 * H, -5); // registration is closed
    await rejects("another department's HOD can't approve", 403, () => hodApprove({ ...hod, departmentId: otherDept.id }, reg.id), /department/);
    const nStu = await notif(student.userId, "REGISTRATION_APPROVED");
    await hodApprove(hod, reg.id);
    const approved = (await findRegistration(student.userId, ctx))!;
    ok("HOD approves → APPROVED, even though registration has closed (no HOD period)", approved.status === "APPROVED" && !!approved.decidedAt);
    ok("the student was notified", (await notif(student.userId, "REGISTRATION_APPROVED")) === nStu + 1);
    await rejects("an approved registration can't be approved again", 403, () => hodApprove(hod, reg.id), /isn't awaiting HOD/);
    const types = (await db.$queryRaw<{ enumlabel: string }[]>`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'TimeFrameType'`).map((r) => r.enumlabel);
    ok("there is no HOD (or DAPU-approval) registration period type", !types.some((t) => /HOD|DAPU/i.test(t)), types.join(", "));
    ok("no registration is stuck awaiting DAPU (that step is retired)", (await db.courseRegistration.count({ where: { status: "PENDING_DAPU" } })) === 0);

    // ---- history + My Courses ------------------------------------------------------------------------------------------------------------------------
    const hist = await getRegistrationHistory(student.userId);
    ok("history keeps the approved registration after registration closed (and the real Alpha one)", hist.some((h) => h.id === reg.id && h.status === "APPROVED" && h.items.length === 2) && hist.length === alphaRegBefore.length + 1);
    const mine2 = await getRegisteredCourses(student.userId, ctx);
    ok("My Courses = only the APPROVED registration's courses (A and B), with code, full title, type, units", JSON.stringify(mine2.map((c) => c.code).sort()) === JSON.stringify([A.code, B.code].sort()) && mine2.every((c) => c.title.length > 0 && c.courseType === "CORE" && c.creditUnits === 3 && c.semesterName === omega.name));
    ok("…not every curriculum course (F, C are absent) and not other levels/programmes", !mine2.some((c) => [F.code, C.code, D.code, E.code].includes(c.code)));
    ok("a PENDING_HOD registration's courses are NOT in My Courses", (await getRegisteredCourses(s2.userId, ctx)).length === 0);
    ok("a PENDING_LEVEL_ADVISOR registration's courses are NOT in My Courses", (await getRegisteredCourses(s3.userId, ctx)).length === 0);
    await db.courseRegistration.update({ where: { id: r6.id }, data: { status: "REJECTED" } });
    ok("a REJECTED registration's courses are NOT in My Courses", (await getRegisteredCourses(s6.userId, ctx)).length === 0);
    ok("a student with no registration has an empty My Courses", (await getRegisteredCourses(s7.userId, ctx)).length === 0);
  } finally {
    // ---- cleanup: clear the flag with the pointer first (the DB CHECK ties them together) ----------------------------------------------------------------
    await db.facultyProfile.updateMany({ where: { userId: { in: tmp.faculty } }, data: { isLevelAdviser: false, levelAdvisorId: null, levelAdviserOf: null } });
    await db.levelAdvisorAssignment.deleteMany({ where: { facultyUserId: { in: tmp.faculty } } });
    await db.courseRegistration.deleteMany({ where: { OR: [{ studentUserId: { in: tmp.students } }, { studentUserId: student.userId, semesterId: omega.id }] } });
    await db.curriculum.deleteMany({ where: { createdByUserId: "verify-student" } });
    await db.course.deleteMany({ where: { id: { in: tmp.courses } } });
    if (tmp.rule) await db.academicRule.delete({ where: { id: tmp.rule } }).catch(() => {});
    await db.studentProfile.deleteMany({ where: { userId: { in: tmp.students } } });
    await db.facultyProfile.deleteMany({ where: { userId: { in: tmp.faculty } } });
    await db.academicTimeFrame.deleteMany({ where: { type: "COURSE_REGISTRATION", academicSessionId: session.id, semesterId: omega.id } });
    if (hadFrame) await db.academicTimeFrame.create({ data: { type: hadFrame.type, academicSessionId: hadFrame.academicSessionId, semesterId: hadFrame.semesterId, startDate: hadFrame.startDate, endDate: hadFrame.endDate } });
    await core.notification.deleteMany({ where: { scope: "ELEARNING", createdAt: { gte: startedAt }, type: { startsWith: "REGISTRATION_" } } });
    const alphaAfter = await db.courseRegistration.findMany({ where: { studentUserId: student.userId, semesterId: alpha.id }, select: { id: true, status: true } });
    ok("cleanup: no test records remain, and the student's real Alpha registration is untouched", (await db.course.count({ where: { title: { startsWith: "VERIFY-" } } })) === 0 && (await db.curriculum.count({ where: { createdByUserId: "verify-student" } })) === 0 && (await db.courseRegistration.count({ where: { semesterId: omega.id } })) === 0 && JSON.stringify(alphaAfter) === JSON.stringify(alphaRegBefore));
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
