// Rendered-page checks for the student portal pages and the DAPU / HOD / Level Adviser pages around
// registration, fetched from a running server (BASE_URL, default http://localhost:3100) as the real
// test accounts. (The registration page's phases/selection are covered by verify-student-browser.ts.)
import { encode } from "next-auth/jwt";
import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };

async function main() {
  const tag = `VERIFY-${Date.now()}`;
  const stu = await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } });
  const student = await db.studentProfile.findUniqueOrThrow({ where: { userId: stu.id } });
  const cur = await db.academicSession.findFirstOrThrow({ where: { isCurrent: true }, include: { semesters: true } });
  const alpha = cur.semesters.find((s) => s.isCurrent)!;
  const key = { type: "COURSE_REGISTRATION" as const, academicSessionId: cur.id, semesterId: alpha.id };
  const original = await db.academicTimeFrame.findUnique({ where: { type_academicSessionId_semesterId: key } });
  const mint = async (email: string) => { const u = await core.user.findUniqueOrThrow({ where: { email } }); return `next-auth.session-token=${await encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 600, token: { id: u.id, email: u.email, name: u.firstName, firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } })}`; };
  const get = async (cookie: string, path: string) => { const r = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" }); return { s: r.status, h: (await r.text()).replace(/<!-- -->/g, "") }; };
  // Look at the real `disabled` ATTRIBUTE — not the Tailwind class names (disabled:opacity-40), which contain the word too.
  const selectBtns = (h: string) => [...h.matchAll(/<button type="(?:submit|button)"([^>]*)>Select<\/button>/g)].map((m) => /(^|\s)disabled(=""|\s|$)/.test(m[1].replace(/class="[^"]*"/, "")));
  const setPeriod = async (s: number | null, e: number | null) => { await db.academicTimeFrame.deleteMany({ where: key }); if (s !== null && e !== null) await db.academicTimeFrame.create({ data: { ...key, startDate: new Date(Date.now() + s), endDate: new Date(Date.now() + e) } }); };
  const H = 3600_000;
  const studentC = await mint("marvelousifezue31@stu.cu.edu.ng");
  const created: { curriculum?: string; courses: string[] } = { courses: [] };
  const REG = "/e-learning/student/course-control/registration";

  try {
    // ---- other student pages + the staff pages ---------------------------------------------------------
    for (const path of ["/e-learning/student/dashboard", "/e-learning/student/course-control/registration-status", "/e-learning/student/course-control/add-drop", "/e-learning/student/my-learning"]) {
      const r = await get(studentC, path);
      ok(`student page ${path.split("/").slice(-1)[0]} renders`, r.s === 200);
    }
    const st = await get(studentC, "/e-learning/student/course-control/registration-status");
    ok("status page: shows the current registration status and a Registration History section", st.s === 200 && st.h.includes("Registration Status") && st.h.includes("Registration History"));

    const dapuC = await mint("marvelousifezue31@dapu.cu.edu.ng");
    const dp = await get(dapuC, "/e-learning/dapu/timeframes/course-registration");
    ok("DAPU period page: date AND time inputs, phase status, single 'Course Registration' period", dp.s === 200 && (dp.h.match(/type="datetime-local"/g) ?? []).length === 2 && /Upcoming|Active|Ended|Not configured/.test(dp.h) && (dp.h.includes("Start date &amp; time") || dp.h.includes("Start date & time")));
    ok("DAPU has NO registration-approval page any more (DAPU only controls the period)", (await get(dapuC, "/e-learning/dapu/approvals/course-registration")).s === 404);
    const hodC = await mint("marvelousifezue31@hodeie.cu.stu.ng");
    const hp = await get(hodC, "/e-learning/hod/approvals/course-registration");
    ok("HOD registration approvals page renders — and has no registration-period controls", hp.s === 200 && !/datetime-local|Registration (start|end)/i.test(hp.h));
    const adviser = await db.facultyProfile.findFirstOrThrow({ where: { isLevelAdviser: true } });
    const adviserUser = await core.user.findUniqueOrThrow({ where: { id: adviser.userId } });
    ok("Level Adviser approvals page renders for the assigned advisor", (await get(await mint(adviserUser.email), "/e-learning/faculty/level-adviser/approvals")).s === 200);
    const denied = await get(studentC, "/e-learning/dapu/timeframes/course-registration");
    ok("a student can't open the DAPU approvals page", denied.s !== 200 || /not have access|forbidden/i.test(denied.h));
  } finally {
    await db.academicTimeFrame.deleteMany({ where: key });
    if (original) await db.academicTimeFrame.create({ data: { ...key, startDate: original.startDate, endDate: original.endDate } });
    if (created.curriculum) await db.curriculum.delete({ where: { id: created.curriculum } }).catch(() => {});
    await db.course.deleteMany({ where: { id: { in: created.courses } } });
    const after = await db.academicTimeFrame.findUnique({ where: { type_academicSessionId_semesterId: key } });
    ok("the real Alpha registration window is restored exactly", (!original && !after) || (!!original && !!after && after.startDate.getTime() === original.startDate.getTime() && after.endDate.getTime() === original.endDate.getTime()));
    ok("temporary curriculum/courses removed", (await db.curriculum.count({ where: { createdByUserId: "verify-student" } })) === 0 && (await db.course.count({ where: { title: { startsWith: "VERIFY-" } } })) === 0);
  }
  console.log(`\n${p} passed, ${f} failed`); process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
