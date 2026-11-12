// REAL-BROWSER test: the AkadVerse logo in the E-Learning header takes each role to ITS OWN dashboard.
//   - destination = the signed-in role's dashboard (from the server-side session), from any deep page, at phone/tablet/desktop widths
//   - it is a normal link (new history entry) — NOT router.back(): after clicking, browser Back returns to the page you came from
//   - only one logo exists; a ?role=... query cannot change the destination; works from the keyboard; closes the mobile drawer
//   - no hydration errors are logged
// Needs a running server:  BASE_URL=http://localhost:3200 (dev) — Run: PP_DIR=<dir with puppeteer-core> npx tsx --env-file=.env scripts/verify-brand-link.ts

import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { prisma as core } from "../src/lib/prisma";
import { elearningDb as db } from "../src/lib/db/elearning";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const acct = async (email: string) => { const u = await core.user.findUniqueOrThrow({ where: { email } }); return encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600, token: { id: u.id, email: u.email, name: u.firstName, firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } }); };
  const offering = await db.courseOffering.findFirstOrThrow({ where: { lecturers: { some: {} } }, select: { id: true, curriculumCourse: { select: { courseId: true } } } });
  const roles = {
    student: { cookie: await acct("marvelousifezue31@stu.cu.edu.ng"), home: "/e-learning/student/dashboard", deep: [`/e-learning/student/my-learning/${offering.curriculumCourse.courseId}`, "/e-learning/student/academic-records/results", "/e-learning/student/course-control/registration"] },
    faculty: { cookie: await acct("marvelousifezue31@faculty.cu.edu.ng"), home: "/e-learning/faculty/dashboard", deep: [`/e-learning/faculty/my-subjects/${offering.id}`, "/e-learning/faculty/results", "/e-learning/faculty/level-adviser/registrations"] },
    hod: { cookie: await acct("marvelousifezue31@hodeie.cu.stu.ng"), home: "/e-learning/hod/dashboard", deep: ["/e-learning/hod/curriculum", "/e-learning/hod/assignments/lecturers"] },
    dapu: { cookie: await acct("marvelousifezue31@dapu.cu.edu.ng"), home: "/e-learning/dapu/dashboard", deep: ["/e-learning/dapu/course-structure", "/e-learning/dapu/timeframes/course-registration"] },
  } as const;
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const hydration: string[] = [];
  const open = async (role: keyof typeof roles, width: number) => {
    const page = await browser.newPage();
    page.on("console", (m: { type(): string; text(): string }) => { if (m.type() === "error" && /hydrat|didn't match/i.test(m.text())) hydration.push(m.text().slice(0, 200)); });
    await page.evaluateOnNewDocument("window.__name = (f) => f;");
    await page.setViewport({ width, height: 800, isMobile: width < 768, hasTouch: width < 768 });
    await page.setCookie({ name: "next-auth.session-token", value: roles[role].cookie, url: BASE });
    return page;
  };
  const LOGO = 'header a[aria-label^="AkadVerse"]';

  try {
    for (const width of [375, 768, 1280]) {
      for (const role of Object.keys(roles) as (keyof typeof roles)[]) {
        const { home, deep } = roles[role];
        for (const path of deep) {
          const page = await open(role, width);
          await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
          const info = await page.evaluate((sel: string) => ({ count: document.querySelectorAll(sel).length, href: document.querySelector(sel)?.getAttribute("href"), inHeader: !!document.querySelector(`header ${sel.replace("header ", "")}`), brandText: Array.from(document.querySelectorAll("body *")).filter((e) => e.children.length === 0 && e.textContent?.trim() === "Akadverse").length, hist: history.length }), LOGO);
          const label = `[${role} @${width}px] ${path.replace("/e-learning/", "")}`;
          ok(`${label}: exactly one AkadVerse logo, and it is a link to ${home}`, info.count === 1 && info.href === home && info.brandText === 1, JSON.stringify({ count: info.count, href: info.href, texts: info.brandText }));
          await page.click(LOGO);
          await page.waitForFunction((h: string) => location.pathname === h, { timeout: 30000 }, home);
          const after = await page.evaluate(() => ({ path: location.pathname, hist: history.length, h1: document.querySelector("main h1")?.textContent ?? "" }));
          ok(`${label}: clicking it lands on the ${role} dashboard`, after.path === home, `landed ${after.path}, h1="${after.h1}"`);
          ok(`${label}: it added a NEW history entry (a link, not router.back())`, after.hist === info.hist + 1, `history ${info.hist} -> ${after.hist}`);
          await page.goBack();
          await page.waitForFunction((d: string) => location.pathname === d, { timeout: 30000 }, path);
          ok(`${label}: browser Back still returns to the page you came from`, true);
          await page.close();
        }
      }
    }

    // ---- extra behaviour --------------------------------------------------------------------------------------------------------------
    {
      const page = await open("student", 1280);
      await page.goto(`${BASE}/e-learning/student/academic-records/results?role=faculty&next=/e-learning/faculty/dashboard`, { waitUntil: "networkidle0" });
      const href = await page.$eval(LOGO, (e: Element) => e.getAttribute("href"));
      ok("a ?role=faculty query does NOT change where a Student's logo goes", href === roles.student.home, `href=${href}`);
      await page.close();
    }
    {
      const page = await open("faculty", 1280);
      await page.goto(`${BASE}/e-learning/faculty/results`, { waitUntil: "networkidle0" });
      await page.focus(LOGO);
      await page.keyboard.press("Enter");
      await page.waitForFunction((h: string) => location.pathname === h, { timeout: 30000 }, roles.faculty.home);
      ok("keyboard: Tab-focus + Enter on the logo navigates (accessible)", true);
      await page.close();
    }
    {
      const page = await open("student", 375);
      await page.goto(`${BASE}${roles.student.home}`, { waitUntil: "networkidle0" });
      await page.click('button[aria-label="Open menu"]');
      await sleep(400);
      const open1 = await page.evaluate(() => Math.round(document.getElementById("elearning-nav")!.getBoundingClientRect().right) > 100);
      await page.click(LOGO); // already on the dashboard, drawer open
      await sleep(600);
      const closed = await page.evaluate(() => Math.round(document.getElementById("elearning-nav")!.getBoundingClientRect().right) <= 0);
      ok("mobile: with the menu open, clicking the logo closes it (even when already on the dashboard)", open1 && closed && new URL(page.url()).pathname === roles.student.home);
      await page.close();
    }
    {
      // the logo is not covered / clipped at any width
      for (const width of [320, 375, 768, 1280]) {
        const page = await open("student", width);
        await page.goto(`${BASE}${roles.student.home}`, { waitUntil: "networkidle0" });
        const r = await page.evaluate((sel: string) => { const a = document.querySelector(sel)!; const b = a.getBoundingClientRect(); const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { visible: b.width > 20 && b.height > 10 && b.left >= 0 && b.right <= document.documentElement.clientWidth, topIsLogo: !!top && a.contains(top), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; }, LOGO);
        ok(`[@${width}px] logo is visible, clickable (not covered) and causes no overflow`, r.visible && r.topIsLogo && !r.overflow, JSON.stringify(r));
        await page.close();
      }
    }
    ok("no hydration errors were logged during the whole run", hydration.length === 0, hydration[0] ?? "");
  } finally {
    await browser.close();
  }
  console.log(`\n${p} passed, ${f} failed`);
  await core.$disconnect(); await db.$disconnect();
  process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
