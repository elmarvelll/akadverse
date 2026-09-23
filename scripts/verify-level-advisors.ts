// scripts/verify-level-advisors.ts
//
// Level Advisor assignment checks against the real E-Learning DB: the service rules, the
// database constraints (unique / FK / CHECK), department + programme + level + session
// distinctness, change-with-history, HOD scope, persistence, and the rendered HOD page
// (fetched from the running dev server as the HOD test account).
// Temporary records are created and removed; the real assignment is never touched.
//
// Run: npx tsx --env-file=.env scripts/verify-level-advisors.ts   (page check uses BASE_URL, default the dev server on :3000)

import { encode } from "next-auth/jwt";
import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/service-error";
import { assignOrChangeLevelAdvisor, listAdvisorContexts } from "../services/e-learning/hod/level-advisors";
import { syncAllFacultyAdvisorState } from "../services/e-learning/shared/level-advisor-state";

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};
async function rejects(name: string, status: number, fn: () => Promise<unknown>) {
  try { await fn(); ok(name, false, "was accepted"); } catch (e) { ok(name, e instanceof ServiceError && e.status === status, e instanceof ServiceError ? `${e.status} ${e.message}` : String(e)); }
}
async function dbRejects(name: string, fn: () => Promise<unknown>, what: RegExp) {
  try { await fn(); ok(name, false, "the database accepted it"); } catch (e) { const m = String((e as Error).message); ok(name, what.test(m) || (e as { code?: string }).code === "P2002" || (e as { code?: string }).code === "P2003", (e as { code?: string }).code ?? m.slice(0, 90)); }
}

async function main() {
  const tag = `VERIFY-${Date.now()}`;
  const hod = (await db.hodProfile.findFirstOrThrow({ include: { department: true } }));
  const dept = hod.department;
  const otherDept = (await db.department.findFirstOrThrow({ where: { id: { not: dept.id } } }));
  const progs = await db.programme.findMany({ where: { departmentId: dept.id, code: { in: ["ICE", "CPE"] } }, orderBy: { code: "asc" } });
  const [cpe, ice] = [progs.find((p) => p.code === "CPE")!, progs.find((p) => p.code === "ICE")!];
  const current = (await db.academicSession.findFirstOrThrow({ where: { isCurrent: true }, include: { semesters: true } }));
  const realBefore = await db.levelAdvisorAssignment.findMany({ orderBy: { id: "asc" } });
  const realFacultyBefore = await db.facultyProfile.findMany({ where: { userId: { in: realBefore.map((a) => a.facultyUserId) } }, select: { userId: true, isLevelAdviser: true, levelAdvisorId: true, levelAdviserOf: true } });
  const tmp = { faculty: [] as string[], sessionId: "", progId: "", courseId: "" };
  const otherHod = { ...hod, userId: "verify-other-hod", departmentId: otherDept.id };
  const fac = async (id: string, departmentId = dept.id) => { tmp.faculty.push(id); return db.facultyProfile.create({ data: { userId: id, departmentId } }); };
  let originalCurrent = current.id;

  try {
    const A = await fac("verify-la-A"), B = await fac("verify-la-B"), C = await fac("verify-la-C"), F = await fac("verify-la-F", otherDept.id);
    const otherProg = await db.programme.create({ data: { code: tag, name: `${tag} programme`, departmentId: otherDept.id } });
    tmp.progId = otherProg.id;
    const tmpSession = await db.academicSession.create({ data: { name: tag } });
    tmp.sessionId = tmpSession.id;

    // ---- Test 1: a lecturer can also be a Level Advisor -----------------------------------------
    const course = await db.course.create({ data: { code: `ZZL ${Date.now() % 900 + 100}`, title: `${tag} lecture course`, creditUnits: 2 } });
    tmp.courseId = course.id;
    await db.courseAssignment.create({ data: { courseId: course.id, facultyUserId: A.userId, academicSessionId: current.id, semesterId: current.semesters[0].id } });
    const r1 = await assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 500, academicSessionId: current.id, facultyUserId: A.userId });
    const a1 = await db.facultyProfile.findUniqueOrThrow({ where: { userId: A.userId } });
    ok("Test 1: a lecturer is assigned as Level Advisor", r1.changed && a1.isLevelAdviser && a1.levelAdvisorId === r1.assignmentId && a1.levelAdviserOf === 500);
    ok("Test 1: …and is still a lecturer", (await db.courseAssignment.count({ where: { facultyUserId: A.userId } })) === 1);
    const asg = await db.levelAdvisorAssignment.findUniqueOrThrow({ where: { id: r1.assignmentId } });
    ok("assignment records programme, level and academic session (department via programme)", asg.programmeId === ice.id && asg.level === 500 && asg.academicSessionId === current.id && ice.departmentId === dept.id);

    // ---- Test 2: one assignment, one faculty — enforced by the DATABASE ----------------------------
    await dbRejects("Test 2: a second faculty member can't point at the same assignment (unique levelAdvisorId)", () => db.facultyProfile.update({ where: { userId: B.userId }, data: { levelAdvisorId: r1.assignmentId, isLevelAdviser: true } }), /Unique/i);
    await dbRejects("Test 2: a second row for the same programme+level+session is rejected (unique)", () => db.levelAdvisorAssignment.create({ data: { programmeId: ice.id, level: 500, academicSessionId: current.id, facultyUserId: B.userId, createdByUserId: "x" } }), /Unique/i);
    await dbRejects("an assignment needs a real faculty profile (foreign key)", () => db.levelAdvisorAssignment.create({ data: { programmeId: ice.id, level: 400, academicSessionId: current.id, facultyUserId: "nobody", createdByUserId: "x" } }), /Foreign key/i);
    await dbRejects("isLevelAdviser without an assignment is rejected (CHECK)", () => db.facultyProfile.update({ where: { userId: B.userId }, data: { isLevelAdviser: true } }), /check|constraint/i);
    await dbRejects("an assignment pointer without the flag is rejected (CHECK)", () => db.facultyProfile.update({ where: { userId: B.userId }, data: { levelAdvisorId: r1.assignmentId } }), /check|constraint|Unique/i);

    // ---- Tests 3 & 4: distinct by department and by programme ---------------------------------------
    await assignOrChangeLevelAdvisor(otherHod, { programmeId: otherProg.id, level: 500, academicSessionId: current.id, facultyUserId: F.userId });
    await assignOrChangeLevelAdvisor(hod, { programmeId: cpe.id, level: 500, academicSessionId: current.id, facultyUserId: C.userId });
    const mine = await listAdvisorContexts(hod, current.id);
    const theirs = await listAdvisorContexts(otherHod, current.id);
    const l500 = mine.contexts.filter((c) => c.level === 500);
    ok("Test 3: each department sees only its own Level 500", mine.department.name === dept.name && theirs.department.name === otherDept.name && !mine.contexts.some((c) => c.programme.id === otherProg.id) && theirs.contexts.every((c) => c.programme.id === otherProg.id));
    ok("Test 4: two programmes at Level 500 stay distinguishable", l500.length >= 2 && new Set(l500.map((c) => c.programme.id)).size === l500.length && l500.some((c) => c.programme.code === "ICE") && l500.some((c) => c.programme.code === "CPE"));

    // ---- Test 5: different sessions keep separate assignments ----------------------------------------------
    await assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 500, academicSessionId: tmpSession.id, facultyUserId: B.userId });
    const inCurrent = (await listAdvisorContexts(hod, current.id)).contexts.find((c) => c.programme.id === ice.id && c.level === 500)!;
    const inOther = (await listAdvisorContexts(hod, tmpSession.id)).contexts.find((c) => c.programme.id === ice.id && c.level === 500)!;
    ok("Test 5: same programme+level, two sessions, two different advisors", inCurrent.assignment?.facultyUserId === A.userId && inOther.assignment?.facultyUserId === B.userId && inCurrent.assignment!.id !== inOther.assignment!.id);
    const bOld = await db.facultyProfile.findUniqueOrThrow({ where: { userId: B.userId } });
    ok("only the CURRENT session drives isLevelAdviser (B's other-session assignment doesn't flag B)", !bOld.isLevelAdviser && bOld.levelAdvisorId === null);

    // ---- Test 6: change advisor ----------------------------------------------------------------------------------
    await rejects("a person advises one level per session", 409, () => assignOrChangeLevelAdvisor(hod, { programmeId: cpe.id, level: 500, academicSessionId: current.id, facultyUserId: A.userId }));
    const rowsBefore = await db.levelAdvisorAssignment.count({ where: { programmeId: ice.id, level: 500, academicSessionId: current.id } });
    const r6 = await assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 500, academicSessionId: current.id, facultyUserId: B.userId });
    const [aAfter, bAfter] = await Promise.all([db.facultyProfile.findUniqueOrThrow({ where: { userId: A.userId } }), db.facultyProfile.findUniqueOrThrow({ where: { userId: B.userId } })]);
    ok("Test 6: the same assignment row now belongs to B (no duplicate)", r6.changed && r6.assignmentId === r1.assignmentId && rowsBefore === 1 && (await db.levelAdvisorAssignment.count({ where: { programmeId: ice.id, level: 500, academicSessionId: current.id } })) === 1);
    ok("Test 6: A no longer has the active assignment; B does", !aAfter.isLevelAdviser && aAfter.levelAdvisorId === null && aAfter.levelAdviserOf === null && bAfter.isLevelAdviser && bAfter.levelAdvisorId === r6.assignmentId && bAfter.levelAdviserOf === 500);
    const hist = await db.levelAdvisorAssignmentChange.findMany({ where: { assignmentId: r6.assignmentId }, orderBy: { changedAt: "asc" } });
    ok("Test 6: history preserved (A assigned, then A→B)", hist.length === 2 && hist[0].toFacultyUserId === A.userId && hist[1].fromFacultyUserId === A.userId && hist[1].toFacultyUserId === B.userId && hist[1].changedByUserId === hod.userId);
    ok("Test 6: the other session's assignment was untouched", (await db.levelAdvisorAssignment.findUnique({ where: { programmeId_level_academicSessionId: { programmeId: ice.id, level: 500, academicSessionId: tmpSession.id } } }))?.facultyUserId === B.userId);
    const noop = await assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 500, academicSessionId: current.id, facultyUserId: B.userId });
    ok("re-assigning the same person changes nothing and adds no history", !noop.changed && (await db.levelAdvisorAssignmentChange.count({ where: { assignmentId: r6.assignmentId } })) === 2);

    // ---- Test 7: HOD scope --------------------------------------------------------------------------------------------
    await rejects("Test 7: another department's HOD can't assign in this programme", 403, () => assignOrChangeLevelAdvisor(otherHod, { programmeId: ice.id, level: 400, academicSessionId: current.id, facultyUserId: F.userId }));
    await rejects("Test 7: this HOD can't assign in another department's programme", 403, () => assignOrChangeLevelAdvisor(hod, { programmeId: otherProg.id, level: 400, academicSessionId: current.id, facultyUserId: A.userId }));
    await rejects("Test 7: this HOD can't use another department's faculty", 400, () => assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 400, academicSessionId: current.id, facultyUserId: F.userId }));
    await rejects("invalid level", 400, () => assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 150, academicSessionId: current.id, facultyUserId: A.userId }));
    await rejects("unknown session", 400, () => assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 400, academicSessionId: "nope", facultyUserId: A.userId }));
    await rejects("unknown faculty", 400, () => assignOrChangeLevelAdvisor(hod, { programmeId: ice.id, level: 400, academicSessionId: current.id, facultyUserId: "nope" }));
    await rejects("unknown programme", 403, () => assignOrChangeLevelAdvisor(hod, { programmeId: "nope", level: 400, academicSessionId: current.id, facultyUserId: A.userId }));

    // ---- Session switch re-derives everyone's flags ----------------------------------------------------------------
    await db.academicSession.updateMany({ data: { isCurrent: false } });
    await db.academicSession.update({ where: { id: tmpSession.id }, data: { isCurrent: true } });
    await syncAllFacultyAdvisorState();
    const swB = await db.facultyProfile.findUniqueOrThrow({ where: { userId: B.userId } });
    const swReal = realFacultyBefore.length ? await db.facultyProfile.findUniqueOrThrow({ where: { userId: realFacultyBefore[0].userId } }) : null;
    ok("switching the current session re-derives the flags (B's tmp-session assignment is now current; real advisor's is not)", swB.isLevelAdviser && (!swReal || !swReal.isLevelAdviser));
    await db.academicSession.updateMany({ data: { isCurrent: false } });
    await db.academicSession.update({ where: { id: originalCurrent }, data: { isCurrent: true } });
    await syncAllFacultyAdvisorState();
    originalCurrent = "";
    const backReal = realFacultyBefore.length ? await db.facultyProfile.findUniqueOrThrow({ where: { userId: realFacultyBefore[0].userId } }) : null;
    ok("…and switching back restores them", !backReal || (backReal.isLevelAdviser === realFacultyBefore[0].isLevelAdviser && backReal.levelAdvisorId === realFacultyBefore[0].levelAdvisorId));

    // ---- Test 8: persistence + the rendered HOD page ----------------------------------------------------------------------
    const fresh = (await listAdvisorContexts(hod, current.id)).contexts.find((c) => c.programme.id === ice.id && c.level === 500)!;
    ok("Test 8: a fresh read (like a page refresh) still shows B assigned, from the database", fresh.assignment?.facultyUserId === B.userId && fresh.assignment.history.length === 2);
    try {
      const u = await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@hodeie.cu.stu.ng" } });
      const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 300, token: { id: u.id, email: u.email, name: "HOD", firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } });
      const res = await fetch(`${process.env.BASE_URL ?? "http://localhost:3000"}/e-learning/hod/assignments/level-advisers?session=${current.id}`, { headers: { cookie: `next-auth.session-token=${token}` }, redirect: "manual" });
      const html = (await res.text()).replace(/<!-- -->/g, "");
      ok("HOD page renders", res.status === 200);
      ok("page shows Department, Programme, Level and Session for a context", html.includes(dept.name) && html.includes(`${ice.name} (${ice.code})`) && html.includes("500 Level") && html.includes(current.name));
      ok("page shows Assigned + Change Level Advisor for the assigned context, and history", html.includes("Assigned") && html.includes("Change Level Advisor") && html.includes("History"));
      ok("page never shows another department's programme", !html.includes(otherProg.name));
      const real = realBefore[0] ? (await core.user.findUnique({ where: { id: realBefore[0].facultyUserId } })) : null;
      if (real) ok("the real existing assignment shows its advisor's full name as the Level Advisor", html.includes(`Level Advisor: <strong class="">${real.firstName} ${real.lastName}</strong>`) || new RegExp(`Level Advisor: <strong[^>]*>${real.firstName} ${real.lastName}</strong>`).test(html));
    } catch (e) { ok("HOD page check (is the dev server running on :3000?)", false, String(e).slice(0, 100)); }
  } finally {
    if (originalCurrent) { await db.academicSession.updateMany({ data: { isCurrent: false } }); await db.academicSession.update({ where: { id: originalCurrent }, data: { isCurrent: true } }); }
    // Clear pointers first (the CHECK ties them to the flag), then remove test rows.
    await db.facultyProfile.updateMany({ where: { userId: { in: tmp.faculty } }, data: { isLevelAdviser: false, levelAdvisorId: null, levelAdviserOf: null } });
    await db.levelAdvisorAssignment.deleteMany({ where: { facultyUserId: { in: tmp.faculty } } });
    await db.courseAssignment.deleteMany({ where: { facultyUserId: { in: tmp.faculty } } });
    await db.facultyProfile.deleteMany({ where: { userId: { in: tmp.faculty } } });
    if (tmp.courseId) await db.course.delete({ where: { id: tmp.courseId } }).catch(() => {});
    if (tmp.progId) await db.programme.delete({ where: { id: tmp.progId } }).catch(() => {});
    if (tmp.sessionId) await db.academicSession.delete({ where: { id: tmp.sessionId } }).catch(() => {});
    await syncAllFacultyAdvisorState();
    const after = await db.levelAdvisorAssignment.findMany({ orderBy: { id: "asc" } });
    const facAfter = await db.facultyProfile.findMany({ where: { userId: { in: realBefore.map((a) => a.facultyUserId) } }, select: { userId: true, isLevelAdviser: true, levelAdvisorId: true, levelAdviserOf: true } });
    ok("cleanup: the real assignment and the real advisor's flags are exactly as before", JSON.stringify(after.map((a) => [a.id, a.facultyUserId, a.level])) === JSON.stringify(realBefore.map((a) => [a.id, a.facultyUserId, a.level])) && JSON.stringify(facAfter) === JSON.stringify(realFacultyBefore));
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
