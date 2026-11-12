// Real-browser responsiveness audit of every E-Learning page (headless Chrome via puppeteer-core), as the real
// test accounts of each role. For each page at phone/tablet widths it fails when the PAGE scrolls sideways or an
// element sticks out of the viewport without sitting inside its own horizontal scroll container (tables are
// allowed to scroll inside their wrapper). Pages that need real ids (course, offering, curriculum) get temporary,
// reversible fixture data (long titles / file names on purpose) which is removed afterwards.
//
// Run: PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3100 npx tsx --env-file=.env scripts/verify-responsive.ts

import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
const WIDTHS = [320, 375, 768];
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };

const LONG = "A very long course document title that keeps going to test wrapping on narrow phone screens";
const LONG_FILE = "Introduction-to-Electrical-Machines-and-Power-Systems-Lecture-Notes-Final-Version-2026.pdf";

async function main() {
  const acct = async (email: string) => { const u = await core.user.findUniqueOrThrow({ where: { email } }); return { u, cookie: await encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 1800, token: { id: u.id, email: u.email, name: u.firstName, firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } }) }; };
  const student = await acct("marvelousifezue31@stu.cu.edu.ng");
  const faculty = await acct("marvelousifezue31@faculty.cu.edu.ng");
  const hodA = await acct("marvelousifezue31@hodeie.cu.stu.ng");
  const dapu = await acct("marvelousifezue31@dapu.cu.edu.ng");

  const sp = await db.studentProfile.findUniqueOrThrow({ where: { userId: student.u.id } });
  const session = await db.academicSession.findFirstOrThrow({ where: { isCurrent: true } });
  const sem = await db.semester.findFirstOrThrow({ where: { academicSessionId: session.id, isCurrent: true } });
  const tag = `ZZR${Date.now() % 10000}`;
  const made = { courses: [] as string[], curId: "", addedItems: [] as string[], regCreated: "", regRestore: null as null | { id: string; status: string } };

  try {
    // ---- reversible fixtures in the CURRENT semester ---------------------------------------------------------------------
    const cA = await db.course.create({ data: { code: `${tag} 1`, title: "Responsive fixture course with a deliberately very long title to test wrapping", creditUnits: 3, description: "A long description. ".repeat(20) } });
    made.courses.push(cA.id);
    const cur = await db.curriculum.create({ data: { programmeId: sp.programmeId!, academicSessionId: session.id, semesterId: sem.id, name: "RESP", version: 9000 + (Date.now() % 900), status: "PUBLISHED", createdByUserId: "resp" } });
    made.curId = cur.id;
    const cc = await db.curriculumCourse.create({ data: { curriculumId: cur.id, courseId: cA.id, level: sp.level, creditUnits: 3 } });
    const off = await db.courseOffering.create({ data: { curriculumCourseId: cc.id, lecturers: { create: [{ facultyUserId: faculty.u.id, role: "COORDINATOR" }] } } });
    const mats = [
      { title: LONG, type: "NOTES" as const, startWeek: 1, endWeek: 3, fileName: LONG_FILE, mimeType: "application/pdf" },
      { title: "Assignment 1", type: "ASSIGNMENT" as const, startWeek: 2, endWeek: 2, fileName: "a1.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      { title: "Quiz 1", type: "QUIZ" as const, startWeek: 2, endWeek: 2, fileName: "q1.zip", mimeType: "application/zip" },
      { title: "Slides", type: "NOTES" as const, startWeek: 2, endWeek: 2, fileName: "s.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
    ];
    for (const [i, m] of mats.entries()) await db.courseMaterial.create({ data: { ...m, courseOfferingId: off.id, uploadedByFacultyUserId: faculty.u.id, fileSize: 123456, storageBucket: "x", storagePath: `resp/${tag}/${i}` } });
    // the student must hold an APPROVED registration containing the fixture course
    const existing = await db.courseRegistration.findUnique({ where: { studentUserId_academicSessionId_semesterId: { studentUserId: student.u.id, academicSessionId: session.id, semesterId: sem.id } } });
    if (existing) {
      made.regRestore = { id: existing.id, status: existing.status };
      const item = await db.courseRegistrationItem.create({ data: { courseRegistrationId: existing.id, courseId: cA.id } });
      made.addedItems.push(item.id);
      await db.courseRegistration.update({ where: { id: existing.id }, data: { status: "APPROVED" } });
    } else {
      const r = await db.courseRegistration.create({ data: { studentUserId: student.u.id, academicSessionId: session.id, semesterId: sem.id, status: "APPROVED", items: { create: [{ courseId: cA.id }] } } });
      made.regCreated = r.id;
    }

    const pages: { role: string; cookie: string; path: string }[] = [];
    const add = (role: string, cookie: string, paths: string[]) => paths.forEach((path) => pages.push({ role, cookie, path }));
    add("student", student.cookie, ["dashboard", "my-learning", `my-learning/${cA.id}`, "academic-records/results", "academic-records/gpa-cgpa", "academic-records/academic-history", "course-control/registration", "course-control/add-drop", "course-control/registration-status"].map((x) => `/e-learning/student/${x}`));
    add("faculty", faculty.cookie, ["dashboard", "my-subjects", `my-subjects/${off.id}`, "results", `results/${cA.id}`, "level-adviser/registrations", "level-adviser/approvals"].map((x) => `/e-learning/faculty/${x}`));
    add("hod", hodA.cookie, ["dashboard", "curriculum", `curriculum/${cur.id}`, "assignments/lecturers", "assignments/level-advisers", "assignments/history", "approvals/course-registration", "approvals/result-upload", "results/by-level", "results/by-course", "results/by-student"].map((x) => `/e-learning/hod/${x}`));
    add("dapu", dapu.cookie, ["dashboard", "course-structure", "course-structure/review", "course-structure/receive", "course-structure/send-to-hod", "add-course", "timeframes/course-registration", "timeframes/result-upload", "timeframes/result-revalidation", "timeframes/change-of-course", "timeframes/makeup-application", "timetable/review", "timetable/approve", "timetable/send-to-hods"].map((x) => `/e-learning/dapu/${x}`));

    const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
    const shots = process.env.SHOTS_DIR;
    try {
      for (const w of WIDTHS) {
        for (const pg of pages) {
          const page = await browser.newPage();
          await page.evaluateOnNewDocument("window.__name = (f) => f;"); // tsx/esbuild helper used inside evaluate()
          await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
          await page.setCookie({ name: "next-auth.session-token", value: pg.cookie, url: BASE });
          let status = 0;
          try { status = (await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle0", timeout: 45000 })).status(); } catch { /* reported below */ }
          const res = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const clipped = (el: Element) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; };
            const bad: string[] = [];
            for (const el of Array.from(document.querySelectorAll("main *, body > * *")).filter((e, i, a) => a.indexOf(e) === i)) {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              if (getComputedStyle(el).position === "fixed") continue;
              if (r.right > vw + 1 && !clipped(el)) bad.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 50)} "${(el.textContent ?? "").trim().slice(0, 30)}" right=${Math.round(r.right)}`);
            }
            return { pageScrolls: document.documentElement.scrollWidth > vw + 1, vw, sw: document.documentElement.scrollWidth, bad: bad.slice(0, 4), title: document.querySelector("h1")?.textContent ?? "" };
          });
          const good = status === 200 && !res.pageScrolls && res.bad.length === 0;
          ok(`${pg.path} @${w}px`, good, good ? "" : `status=${status} scrollWidth=${res.sw}/${res.vw} ${res.bad.join(" | ")}`);
          if (shots && w === 375 && ["dashboard", "my-learning", "my-subjects", "assignments/lecturers", "course-structure"].some((k) => pg.path.endsWith(k) || pg.path.includes(`my-learning/${cA.id}`) || pg.path.includes(`my-subjects/${off.id}`))) {
            await page.screenshot({ path: `${shots}/${pg.role}-${pg.path.split("/").slice(3).join("_")}-${w}.png`, fullPage: false });
          }
          await page.close();
        }
      }
      // the mobile drawer: closed by default, opens from the header button, closes on Escape
      const page = await browser.newPage();
      await page.evaluateOnNewDocument("window.__name = (f) => f;");
      await page.setViewport({ width: 375, height: 800, isMobile: true, hasTouch: true });
      await page.setCookie({ name: "next-auth.session-token", value: student.cookie, url: BASE });
      await page.goto(`${BASE}/e-learning/student/dashboard`, { waitUntil: "networkidle0" });
      const navLeft = () => page.evaluate(() => Math.round(document.getElementById("elearning-nav")!.getBoundingClientRect().right));
      ok("mobile: sidebar drawer is closed off-screen by default", (await navLeft()) <= 0);
      await page.click('button[aria-label="Open menu"]');
      await new Promise((r) => setTimeout(r, 400));
      ok("mobile: menu button opens the drawer", (await navLeft()) > 200);
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 400));
      ok("mobile: Escape closes the drawer", (await navLeft()) <= 0);
      await page.close();
    } finally {
      await browser.close();
    }
  } finally {
    await db.courseMaterial.deleteMany({ where: { storagePath: { startsWith: `resp/${tag}/` } } });
    const offs = await db.courseOffering.findMany({ where: { curriculumCourse: { curriculum: { name: "RESP" } } }, select: { id: true } });
    await db.courseOfferingLecturer.deleteMany({ where: { courseOfferingId: { in: offs.map((o) => o.id) } } });
    await db.courseOffering.deleteMany({ where: { id: { in: offs.map((o) => o.id) } } });
    if (made.addedItems.length) await db.courseRegistrationItem.deleteMany({ where: { id: { in: made.addedItems } } });
    if (made.regRestore) await db.courseRegistration.update({ where: { id: made.regRestore.id }, data: { status: made.regRestore.status as never } });
    if (made.regCreated) await db.courseRegistration.deleteMany({ where: { id: made.regCreated } });
    await db.curriculum.deleteMany({ where: { name: "RESP" } });
    await db.result.deleteMany({ where: { courseId: { in: made.courses } } }); // the faculty results page auto-creates DRAFT rows
    await db.course.deleteMany({ where: { id: { in: made.courses } } });
  }
  console.log(`\n${p} passed, ${f} failed`);
  await db.$disconnect(); await core.$disconnect();
  process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
