// scripts/verify-student-browser.ts
//
// REAL-BROWSER test of the student registration page (headless Chrome via puppeteer-core) against a
// running server (BASE_URL, default http://localhost:3100). It checks what only a browser can:
//   * selecting / removing a course makes ZERO network requests and updates instantly,
//   * "Register Courses" makes exactly ONE request for the whole selection,
//   * a failed registration keeps the selection and allows a retry,
//   * the countdown ticks every second,
//   * before start / after end the buttons are disabled,
//   * approved courses appear on My Courses as cards that open the course detail page.
// It uses a temporary student and temporarily replaces the real Alpha registration window and credit
// rule; all of it is restored exactly.
//
// Run:  PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3100 npx tsx --env-file=.env scripts/verify-student-browser.ts

import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";
import { approveRegistration as laApprove } from "../services/e-learning/level-adviser/registrations";
import { approveRegistration as hodApprove } from "../services/e-learning/hod/registration-approvals";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
let passed = 0, failed = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) passed++; else failed++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const startedAt = new Date();
  const tag = `VERIFY-${Date.now()}`;
  const real = await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } });
  const realProfile = await db.studentProfile.findUniqueOrThrow({ where: { userId: real.id } });
  const session = await db.academicSession.findFirstOrThrow({ where: { isCurrent: true }, include: { semesters: true } });
  const alpha = session.semesters.find((s) => s.isCurrent)!;
  const ctx = { session, semester: alpha };
  const frameKey = { type: "COURSE_REGISTRATION" as const, academicSessionId: session.id, semesterId: alpha.id };
  const originalFrame = await db.academicTimeFrame.findUnique({ where: { type_academicSessionId_semesterId: frameKey } });
  const originalRule = await db.academicRule.findUnique({ where: { programmeId_level_semesterId: { programmeId: realProfile.programmeId!, level: 300, semesterId: alpha.id } } });
  const adviserRow = await db.facultyProfile.findFirstOrThrow({ where: { isLevelAdviser: true } });
  const hod = await db.hodProfile.findUniqueOrThrow({ where: { departmentId: realProfile.departmentId } });
  const H = 3600_000;
  const setPeriod = async (s: number, e: number) => { await db.academicTimeFrame.deleteMany({ where: frameKey }); await db.academicTimeFrame.create({ data: { ...frameKey, startDate: new Date(Date.now() + s), endDate: new Date(Date.now() + e) } }); };
  const tmpId = "verify-browser-student";
  const tmp = { courses: [] as string[], curriculum: "" };

  const cookieFor = async (userId: string, email: string, role: string) => encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 1800, token: { id: userId, email, name: "Verify Student", firstName: "Verify", role, isAdmin: false } as never });
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });

  try {
    // ---- setup: temp student, temp PUBLISHED courses in Alpha, relaxed credit rule (restored later) ----
    await db.studentProfile.create({ data: { userId: tmpId, departmentId: realProfile.departmentId, programmeId: realProfile.programmeId, level: 300, admissionSessionId: session.id } });
    const mk = async (code: string, title: string) => { const c = await db.course.create({ data: { code, title: `${tag} ${title}`, creditUnits: 2 } }); tmp.courses.push(c.id); return c; };
    const k = Date.now() % 900 + 100;
    const [cA, cB, cC] = [await mk(`ZZA ${k}`, "Alpha course"), await mk(`ZZB ${k}`, "Beta course"), await mk(`ZZC ${k}`, "Gamma course")];
    const cur = await db.curriculum.create({ data: { programmeId: realProfile.programmeId!, academicSessionId: session.id, semesterId: alpha.id, name: tag, status: "PUBLISHED", createdByUserId: "verify-browser", version: 900 + Math.floor(Math.random() * 90) } });
    tmp.curriculum = cur.id;
    await db.curriculumCourse.createMany({ data: [cA, cB, cC].map((c) => ({ curriculumId: cur.id, courseId: c.id, level: 300, creditUnits: 2, courseType: "CORE" as const })) });
    await db.academicRule.deleteMany({ where: { programmeId: realProfile.programmeId!, level: 300, semesterId: alpha.id } });

    const page = await browser.newPage();
    const studentCookie = { name: "next-auth.session-token", value: await cookieFor(tmpId, "verify-browser@example.test", "student"), domain: new URL(BASE).hostname, path: "/" };
    await page.setCookie(studentCookie);
    const requests: { method: string; url: string; type: string; action: boolean }[] = [];
    let capture = false;
    page.on("request", (r: { method(): string; url(): string; resourceType(): string; headers(): Record<string, string> }) => {
      if (capture) requests.push({ method: r.method(), url: r.url().replace(BASE, ""), type: r.resourceType(), action: "next-action" in r.headers() });
    });
    const REG = `${BASE}/e-learning/student/course-control/registration`;
    const btn = (area: string, code: string, action: string) => `[data-testid="${area}"] li[data-course="${code}"] button[data-action="${action}"]`;
    const idle = () => page.waitForNetworkIdle({ idleTime: 900, timeout: 15000 }).catch(() => {});
    const text = (sel: string) => page.$eval(sel, (el: Element) => (el.textContent ?? "").trim()).catch(() => null);
    const count = (sel: string) => page.$$eval(sel, (els: Element[]) => els.length);
    const disabledAll = (sel: string) => page.$$eval(sel, (els: HTMLButtonElement[]) => els.length > 0 && els.every((e) => e.disabled));

    // ============ NOT CONFIGURED ============
    await db.academicTimeFrame.deleteMany({ where: frameKey });
    await page.goto(REG, { waitUntil: "networkidle0" });
    ok("NOT_CONFIGURED: 'Course registration is not currently available.', no countdown, Select disabled", (await page.$eval("main", (el: Element) => el.textContent ?? "")).includes("Course registration is not currently available.") && (await count('p[aria-live="off"]')) === 0 && (await disabledAll('button[data-action="select"]')));

    // ---- no published curriculum / no academic information (separate temporary students) ----
    for (const [id, programmeId, level] of [["verify-browser-500", realProfile.programmeId, 500], ["verify-browser-none", null, 300]] as const) {
      await db.studentProfile.create({ data: { userId: id, departmentId: realProfile.departmentId, programmeId, level, admissionSessionId: session.id } });
    }
    await setPeriod(-H, H);
    const other = async (id: string) => { await page.setCookie({ name: "next-auth.session-token", value: await cookieFor(id, `${id}@example.test`, "student"), domain: new URL(BASE).hostname, path: "/" }); await page.goto(REG, { waitUntil: "networkidle0" }); return page.$eval("main", (el: Element) => el.textContent ?? ""); };
    ok("valid academic context but no published curriculum → 'Course structure is not available yet.'", (await other("verify-browser-500")).includes("Course structure is not available yet."));
    ok("no academic information → 'Your academic information is not available yet.' (no crash, no unrelated courses)", (await other("verify-browser-none")).includes("Your academic information is not available yet."));
    await page.setCookie(studentCookie);

    // ============ UPCOMING ============
    await setPeriod(H, 2 * H);
    await page.goto(REG, { waitUntil: "networkidle0" });
    const banner = await page.$eval("main", (el: Element) => el.textContent ?? "");
    ok("UPCOMING: 'Registration opens in' banner is shown", banner.includes("Registration opens in"));
    ok("UPCOMING: courses are visible but every Select button is disabled", (await count('[data-testid="available-courses"] li')) >= 3 && (await disabledAll('button[data-action="select"]')));
    const t1 = await text('p[aria-live="off"]'); await sleep(1300); const t2 = await text('p[aria-live="off"]');
    ok("UPCOMING: countdown shows Days/Hours/Minutes/Seconds and TICKS every second", /^\d+ Days \d+ Hours \d+ Minutes \d+ Seconds$/.test(t1 ?? "") && t1 !== t2, `${t1}  →  ${t2}`);

    // ============ ACTIVE: selection is frontend-only ============
    await setPeriod(-H, H);
    await page.goto(REG, { waitUntil: "networkidle0" });
    await idle();
    ok("ACTIVE: 'Registration closes in' banner and an enabled Select button", (await page.$eval("main", (el: Element) => el.textContent ?? "")).includes("Registration closes in") && !(await disabledAll('button[data-action="select"]')));
    const c1 = await text('p[aria-live="off"]'); await sleep(1300); const c2 = await text('p[aria-live="off"]');
    ok("ACTIVE: the countdown ticks", /^\d+ Days \d+ Hours \d+ Minutes \d+ Seconds$/.test(c1 ?? "") && c1 !== c2, `${c1}  →  ${c2}`);

    capture = true; requests.length = 0;
    await page.click(btn("available-courses", cA.code, "select"));
    await page.click(btn("available-courses", cB.code, "select"));
    const afterSelect = { selected: await count(`[data-testid="selected-courses"] li[data-course]`), inAvailable: await count(btn("available-courses", cA.code, "select")) };
    ok("select: the courses MOVE instantly from Available to Selected", afterSelect.selected === 2 && afterSelect.inAvailable === 0);
    await sleep(1200);
    ok("select: ZERO network requests were made", requests.length === 0, requests.map((r) => `${r.method} ${r.url}`).join(" | ") || "none");
    requests.length = 0;
    await page.click(btn("selected-courses", cA.code, "remove"));
    ok("remove: the course returns to Available instantly", (await count(`[data-testid="selected-courses"] li[data-course="${cA.code}"]`)) === 0 && (await count(btn("available-courses", cA.code, "select"))) === 1);
    await sleep(1200);
    ok("remove: ZERO network requests were made", requests.length === 0, requests.map((r) => `${r.method} ${r.url}`).join(" | ") || "none");
    await page.click(btn("available-courses", cA.code, "select"));
    const codes = await page.$$eval('[data-testid="selected-courses"] li[data-course]', (els: Element[]) => els.map((e) => e.getAttribute("data-course")));
    ok("no duplicates in Selected Courses", new Set(codes).size === codes.length && codes.length === 2);
    ok("nothing was written to the database by selecting/removing", (await db.courseRegistration.count({ where: { studentUserId: tmpId } })) === 0);
    const unitsText = await page.$eval('[data-testid="selected-courses"]', (el: Element) => el.textContent ?? "");
    ok("the selected units update locally (2 courses × 2 = 4)", unitsText.includes("Selected: 4 units"));

    // ============ FAILED registration keeps the selection ============
    await db.academicTimeFrame.deleteMany({ where: frameKey });
    await db.academicTimeFrame.create({ data: { ...frameKey, startDate: new Date(Date.now() - 2 * H), endDate: new Date(Date.now() - 1000) } }); // now ended, but the open page doesn't know
    requests.length = 0;
    await page.click('button[data-action="register"]');
    await page.waitForSelector('[role="alert"]', { timeout: 15000 });
    const err = await text('[data-testid="selected-courses"] [role="alert"]');
    ok("FAILED registration: an error is shown", !!err && /closed/i.test(err), err ?? "");
    ok("FAILED registration: the selected courses are still selected (can retry)", (await count(`[data-testid="selected-courses"] li[data-course]`)) === 2);
    ok("FAILED registration: it was one request, and nothing was saved", requests.filter((r) => r.method === "POST").length === 1 && (await db.courseRegistration.count({ where: { studentUserId: tmpId } })) === 0);

    // ============ RETRY succeeds: ONE request for the whole selection ============
    await setPeriod(-H, H);
    requests.length = 0;
    await page.click('button[data-action="register"]');
    await page.waitForFunction(() => document.body.textContent?.includes("Registered Courses"), { timeout: 15000 });
    await idle();
    ok("Register Courses: exactly ONE POST for the two selected courses", requests.filter((r) => r.method === "POST").length === 1, requests.filter((r) => r.method === "POST").length + " POST(s)");
    const reg = await db.courseRegistration.findUnique({ where: { studentUserId_academicSessionId_semesterId: { studentUserId: tmpId, academicSessionId: session.id, semesterId: alpha.id } }, include: { items: true } });
    ok("registration saved as PENDING_LEVEL_ADVISOR with exactly the two selected courses", reg?.status === "PENDING_LEVEL_ADVISOR" && reg.items.length === 2 && reg.items.every((i) => [cA.id, cB.id].includes(i.courseId)));
    ok("the page now shows the registered courses and the selection area is gone", (await count('[data-testid="selected-courses"]')) === 0 && (await page.$eval("main", (el: Element) => el.textContent ?? "")).includes("Pending Level Advisor approval"));
    capture = false;

    // ============ Level Advisor review page (real adviser) ============
    await setPeriod(-H, H);
    const advUser = await core.user.findUniqueOrThrow({ where: { id: adviserRow.userId } });
    const advPage = await browser.newPage();
    await advPage.setCookie({ name: "next-auth.session-token", value: await cookieFor(advUser.id, advUser.email, "faculty"), domain: new URL(BASE).hostname, path: "/" });
    await advPage.goto(`${BASE}/e-learning/faculty/level-adviser/approvals`, { waitUntil: "networkidle0" });
    const advText = await advPage.$eval("main", (el: Element) => (el.textContent ?? "").replace(/\s+/g, " "));
    ok("Level Advisor page: shows the student's registration with the full comparison (Submitted / Not Selected), counts and units", advText.includes(cA.code) && advText.includes("Submitted") && advText.includes("Not selected") && advText.includes("Applicable courses") && advText.includes("Submitted units") && advText.includes(cC.code));
    ok("Level Advisor page: Approve All and Approve are available while registration is active", advText.includes("Approve All") && (await advPage.$$eval("button", (bs: HTMLButtonElement[]) => bs.some((b) => b.textContent?.trim() === "Approve All" && !b.disabled))));
    await setPeriod(-2 * H, -1000);
    await advPage.reload({ waitUntil: "networkidle0" });
    ok("Level Advisor page after the period ends: decision buttons disabled and a closed notice is shown", (await advPage.$$eval("button", (bs: HTMLButtonElement[]) => bs.filter((b) => ["Approve All", "Approve", "Reject"].includes(b.textContent?.trim() ?? "")).every((b) => b.disabled))) && (await advPage.$eval("main", (el: Element) => el.textContent ?? "")).includes("Course registration is closed"));
    await advPage.close();

    // ============ approve through the chain, then ENDED view + My Courses ============
    await setPeriod(-H, H);
    const tmpProfile = await db.studentProfile.findUniqueOrThrow({ where: { userId: tmpId } });
    void tmpProfile;
    await laApprove(adviserRow, reg!.id);
    await setPeriod(-2 * H, -1000); // registration ended; HOD approval is not gated by it
    await hodApprove(hod, reg!.id);
    ok("LA → HOD approvals reach APPROVED (no DAPU step)", (await db.courseRegistration.findUnique({ where: { id: reg!.id } }))?.status === "APPROVED");

    // The tabs share one cookie jar; the Level Advisor tab replaced the student cookie, so restore it.
    await page.setCookie(studentCookie);
    await page.goto(REG, { waitUntil: "networkidle0" });
    const ended = await page.$eval("main", (el: Element) => el.textContent ?? "");
    ok("ENDED: 'Course registration is closed.' and the approved registration remains visible", ended.includes("Course registration is closed.") && ended.includes("Registered Courses") && ended.includes(cA.code));
    ok("ENDED: no selection controls at all", (await count('button[data-action="select"]')) === 0 && (await count('button[data-action="register"]')) === 0);

    await page.goto(`${BASE}/e-learning/student/my-learning`, { waitUntil: "networkidle0" });
    const cards: string[] = await page.$$eval('[data-testid="course-card"]', (els: Element[]) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ")));
    ok("My Courses: shows exactly the 2 approved courses (not the whole curriculum)", cards.length === 2 && cards.some((c) => c.includes(cA.code)) && cards.some((c) => c.includes(cB.code)) && !cards.some((c) => c.includes(cC.code)));
    ok("My Courses: each card shows the course code and the FULL course name", cards.every((c) => /ZZ[AB] \d+/.test(c)) && cards.some((c) => c.includes(`${tag} Alpha course`)) && cards.some((c) => c.includes(`${tag} Beta course`)));
    const pageTitle = await text("h1");
    ok("the section is called 'My Courses' (not 'My Learning')", pageTitle === "My Courses" && !(await page.content()).includes("My Learning"));
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('[data-testid="course-card"]')]);
    const detail = await page.$eval("main", (el: Element) => (el.textContent ?? "").replace(/\s+/g, " "));
    ok("clicking a card opens that course's detail page", /\/my-courses\/[^/]+$/.test(page.url()) && detail.includes(`${tag} Alpha course`) && detail.includes("Syllabus") && detail.includes("Learning Resources") && detail.includes("Alpha"));
    await page.goto(`${BASE}/e-learning/student/my-learning/${cC.id}`, { waitUntil: "networkidle0" });
    ok("a course that isn't registered can't be opened by URL", (await page.$eval("main", (el: Element) => el.textContent ?? "")).includes("isn't one of your registered courses"));
  } finally {
    await browser.close().catch(() => {});
    await db.courseRegistration.deleteMany({ where: { studentUserId: tmpId } });
    await db.curriculum.deleteMany({ where: { createdByUserId: "verify-browser" } });
    await db.course.deleteMany({ where: { id: { in: tmp.courses } } });
    await db.studentProfile.deleteMany({ where: { userId: { startsWith: "verify-browser" } } });
    await db.academicTimeFrame.deleteMany({ where: frameKey });
    if (originalFrame) await db.academicTimeFrame.create({ data: { ...frameKey, startDate: originalFrame.startDate, endDate: originalFrame.endDate } });
    await db.academicRule.deleteMany({ where: { programmeId: realProfile.programmeId!, level: 300, semesterId: alpha.id } });
    if (originalRule) await db.academicRule.create({ data: { programmeId: originalRule.programmeId, level: originalRule.level, semesterId: originalRule.semesterId, minCreditUnits: originalRule.minCreditUnits, maxCreditUnits: originalRule.maxCreditUnits } });
    await core.notification.deleteMany({ where: { scope: "ELEARNING", createdAt: { gte: startedAt }, type: { startsWith: "REGISTRATION_" } } });
    const frame = await db.academicTimeFrame.findUnique({ where: { type_academicSessionId_semesterId: frameKey } });
    const rule = await db.academicRule.findUnique({ where: { programmeId_level_semesterId: { programmeId: realProfile.programmeId!, level: 300, semesterId: alpha.id } } });
    ok("restored exactly: the real Alpha registration window and credit rule", (!originalFrame && !frame) || (!!originalFrame && !!frame && frame.startDate.getTime() === originalFrame.startDate.getTime() && frame.endDate.getTime() === originalFrame.endDate.getTime()));
    ok("…and the credit rule", (!originalRule && !rule) || (!!originalRule && !!rule && rule.minCreditUnits === originalRule.minCreditUnits && rule.maxCreditUnits === originalRule.maxCreditUnits));
    ok("cleanup: no test records remain", (await db.course.count({ where: { title: { startsWith: "VERIFY-" } } })) === 0 && (await db.curriculum.count({ where: { createdByUserId: "verify-browser" } })) === 0 && (await db.studentProfile.count({ where: { userId: { startsWith: "verify-browser" } } })) === 0);
    void ctx;
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
