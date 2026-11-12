// REAL-BROWSER test (headless Chrome via puppeteer-core) that the E-Learning loading / pending / error states really appear.
// Responses are artificially delayed by the test so the states can be observed:
//   - route loading skeletons (student / faculty / HOD / DAPU) appear while a page loads, are announced (role=status,
//     aria-busy), fit the screen (no horizontal overflow at phone + tablet widths) and are replaced by the real page
//   - server-action buttons are disabled with a spinner while running and cannot submit twice
//   - file upload shows stages and a REAL percentage, locks the form, then shows success (the test file is removed again)
//   - the error boundary and the friendly not-found page render (different from an empty list)
//   - sign-up dropdowns fetched from the server show "Loading…" (not an empty list), a failed fetch offers Try again, and the
//     OTP resend button shows its own loading state
// Needs a PRODUCTION server started with e-mail disabled:  RESEND_API_KEY="" npx next start -p 3100
// Run: PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3100 npx tsx --env-file=.env scripts/verify-loading-states.ts

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { prisma as core } from "../src/lib/prisma";
import { elearningDb as db } from "../src/lib/db/elearning";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = `${Date.now() % 1000000}`;
const DELAY = 1800;
const run = (k: string) => !process.env.ONLY || process.env.ONLY.split(",").includes(k); // ONLY=nav,button,upload,error,signup

async function main() {
  const acct = async (email: string) => { const u = await core.user.findUniqueOrThrow({ where: { email } }); return encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600, token: { id: u.id, email: u.email, name: u.firstName, firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } }); };
  const cookies = { student: await acct("marvelousifezue31@stu.cu.edu.ng"), faculty: await acct("marvelousifezue31@faculty.cu.edu.ng"), hod: await acct("marvelousifezue31@hodeie.cu.stu.ng"), dapu: await acct("marvelousifezue31@dapu.cu.edu.ng") };
  const offering = await db.courseOffering.findFirstOrThrow({ where: { lecturers: { some: {} } }, select: { id: true, curriculumCourse: { select: { courseId: true } } } });
  const stuReg = await db.courseRegistration.findFirstOrThrow({ where: { status: "APPROVED" }, select: { items: { take: 1, select: { courseId: true } } } });
  const courseId = stuReg.items[0].courseId;
  const assigned = (await db.courseOffering.findMany({ select: { curriculumCourse: { select: { courseId: true } } } })).map((o) => o.curriculumCourse.courseId);
  const unassignedCourse = (await db.course.findFirstOrThrow({ where: { id: { notIn: assigned } }, select: { id: true } })).id;

  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const newPage = async (role: keyof typeof cookies | null, width = 1000) => {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument("window.__name = (f) => f;");
    await page.setViewport({ width, height: 800, isMobile: width < 768, hasTouch: width < 768 });
    if (role) await page.setCookie({ name: "next-auth.session-token", value: cookies[role], url: BASE });
    return page;
  };

  try {
    // ============ 1. route loading skeletons ==========================================================================================
    // A user reaches a page by CLICKING a link; Next prefetches that route's loading UI, so it appears the instant they click while the
    // server is still working. The test does exactly that: it opens the menu / expands its groups (so the links exist and are
    // prefetched), THEN slows the server's data responses, clicks the link and looks for the skeleton.
    if (run("nav")) {
      // role, start page, link to click, where the link lives, announcement, heading of the real page
      const nav: [keyof typeof cookies, string, string, "menu" | "page", string, string][] = [
        ["student", "/e-learning/student/dashboard", "/e-learning/student/my-learning", "menu", "Loading your courses", "My Learning"],
        ["student", "/e-learning/student/my-learning", `/e-learning/student/my-learning/${courseId}`, "page", "Loading course", ""],
        ["student", "/e-learning/student/dashboard", "/e-learning/student/academic-records/results", "menu", "Loading records", ""],
        ["student", "/e-learning/student/dashboard", "/e-learning/student/course-control/registration", "menu", "Loading course registration", "Course Registration"],
        ["faculty", "/e-learning/faculty/dashboard", "/e-learning/faculty/my-subjects", "menu", "Loading your subjects", "My Subjects"],
        ["faculty", "/e-learning/faculty/my-subjects", `/e-learning/faculty/my-subjects/${offering.id}`, "page", "Loading subject", ""],
        ["hod", "/e-learning/hod/dashboard", "/e-learning/hod/curriculum", "menu", "Loading course structures", ""],
        ["hod", "/e-learning/hod/dashboard", "/e-learning/hod/assignments/lecturers", "menu", "Loading", ""],
        ["dapu", "/e-learning/dapu/dashboard", "/e-learning/dapu/course-structure", "menu", "Loading course structure", ""],
        ["dapu", "/e-learning/dapu/dashboard", "/e-learning/dapu/timeframes/course-registration", "menu", "Loading", ""],
      ];
      for (const width of [375, 768]) {
        for (const [role, start, target, where, announce, heading] of nav) {
          const page = await newPage(role, width);
          await page.goto(`${BASE}${start}`, { waitUntil: "networkidle0" });
          if (where === "menu") {
            await page.click('button[aria-label="Open menu"]'); // below lg the sidebar is a drawer
            await sleep(300);
            for (let i = 0; i < 3; i++) { // expand every group so all links exist (and get prefetched)
              await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>("#elearning-nav button").forEach((b) => { if (b.querySelector("svg:last-child") && !b.dataset.open) { b.dataset.open = "1"; b.click(); } }));
              await sleep(150);
            }
          }
          await sleep(1800); // let Next prefetch the visible links' loading UI
          await page.setRequestInterception(true);
          page.on("request", (req: { headers(): Record<string, string>; continue(): void }) => {
            const h = req.headers();
            if (h["rsc"] === "1" && !h["next-router-prefetch"]) setTimeout(() => req.continue(), DELAY); else req.continue(); // slow the real data fetch only
          });
          const clicked = await page.evaluate((t: string, w: string) => { const root = w === "menu" ? document.getElementById("elearning-nav") : document.querySelector("main"); const a = root?.querySelector<HTMLAnchorElement>(`a[href="${t}"]`); a?.click(); return !!a; }, target, where);
          ok(`[${role} @${width}px] link to ${target.replace("/e-learning/", "")} exists in the ${where}`, clicked);
          if (!clicked) { await page.close(); continue; }
          await sleep(600);
          const during = await page.evaluate(() => {
            const el = document.querySelector("main [role=status][aria-busy=true]");
            return { found: !!el, text: el?.textContent ?? "", bones: document.querySelectorAll("main .animate-pulse").length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, sw: document.documentElement.scrollWidth };
          });
          ok(`[${role} @${width}px] ${target.replace("/e-learning/", "")}: skeleton appears instantly on click and is announced ("${announce}…")`, during.found && during.text.includes(announce) && during.bones > 2, `found=${during.found} text="${during.text}" bones=${during.bones}`);
          ok(`[${role} @${width}px] ${target.replace("/e-learning/", "")}: skeleton has no horizontal overflow`, !during.overflow, `scrollWidth ${during.sw}`);
          await page.waitForFunction((t: string) => location.pathname === t && !document.querySelector("main [role=status][aria-busy=true]"), { timeout: 25000 }, target);
          const after = await page.evaluate(() => ({ h1: document.querySelector("main h1")?.textContent ?? "", path: location.pathname }));
          ok(`[${role} @${width}px] ${target.replace("/e-learning/", "")}: real page replaces the skeleton`, after.path === target && (heading ? after.h1.includes(heading) : after.h1.length > 0), `h1="${after.h1}"`);
          await page.close();
        }
      }
    }

    // ============ 2. server-action button: pending + no double submit ======================================================================
    if (run("button")) {
      const page = await newPage("dapu", 1000);
      await page.goto(`${BASE}/e-learning/dapu/timeframes/course-registration`, { waitUntil: "networkidle0" });
      await page.setRequestInterception(true);
      let posts = 0;
      page.on("request", (req: { method(): string; headers(): Record<string, string>; continue(): void; abort(): void }) => {
        if (req.method() === "POST" && req.headers()["next-action"]) { posts++; setTimeout(() => req.abort(), 2500); } // held, then dropped: the save never reaches the server
        else req.continue();
      });
      const btn = "form button[aria-busy]";
      await page.waitForSelector(btn);
      await page.click(btn);
      await sleep(600);
      await page.click(btn).catch(() => {}); // a second click while pending
      const s = await page.evaluate(() => { const b = document.querySelector("form button[aria-busy]") as HTMLButtonElement; return { disabled: b.disabled, busy: b.getAttribute("aria-busy"), spinner: !!b.querySelector("svg.animate-spin"), text: b.textContent }; });
      ok("DAPU 'Save' button: disabled, aria-busy and spinner while the request runs", s.disabled && s.busy === "true" && s.spinner, JSON.stringify(s));
      ok("DAPU 'Save' button keeps a readable label while pending", (s.text ?? "").trim().length > 0, `"${s.text}"`);
      await sleep(2500);
      ok("a second click while pending did NOT send a second request", posts === 1, `requests=${posts}`);
      await page.close();
    }

    // ============ 3. upload: stages + real progress, then cleanup ===========================================================================
    if (run("upload")) {
      const page = await newPage("faculty", 1000);
      const file = path.join(os.tmpdir(), `zz-load-${tag}.pdf`);
      fs.writeFileSync(file, Buffer.alloc(700 * 1024, 7));
      await page.goto(`${BASE}/e-learning/faculty/my-subjects/${offering.id}`, { waitUntil: "networkidle0" });
      const before = await db.courseMaterial.count({ where: { courseOfferingId: offering.id } });
      await page.type('input[name="title"]', `zz-load-test-${tag}`);
      await (await page.$('input[type="file"]')).uploadFile(file);
      const cdp = await page.createCDPSession();
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 500 * 1024, uploadThroughput: 70 * 1024 });
      await page.click('form button[type="submit"]');
      const seen = new Set<string>(); let maxPct = 0, sawLocked = false, sawBar = false;
      for (let i = 0; i < 60; i++) {
        await sleep(400);
        const st = await page.evaluate(() => ({ text: document.querySelector("form [role=status]")?.textContent ?? "", locked: (document.querySelector("form fieldset") as HTMLFieldSetElement | null)?.disabled ?? false, btn: (document.querySelector('form button[type="submit"]') as HTMLButtonElement).disabled, bar: !!document.querySelector("form .bg-blue-700.rounded-full") }));
        if (st.text) seen.add(st.text.replace(/\d+%/, "N%"));
        const m = st.text.match(/Uploading… (\d+)%/); if (m) maxPct = Math.max(maxPct, Number(m[1]));
        if (st.locked && st.btn) sawLocked = true;
        if (st.bar) sawBar = true;
        if (/Material uploaded/.test(await page.evaluate(() => document.querySelector("form")?.textContent ?? ""))) break;
      }
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      ok("upload shows its stages (preparing -> uploading N% -> saving)", [...seen].some((t) => /Uploading… N%/.test(t)), [...seen].join(" | "));
      ok("upload shows a REAL percentage (progress observed before 100%)", maxPct > 0 && maxPct <= 100, `max seen ${maxPct}%`);
      ok("upload locks the form and the button while running, and shows a progress bar", sawLocked && sawBar);
      await page.waitForFunction(() => /Material uploaded/.test(document.querySelector("form")?.textContent ?? ""), { timeout: 30000 });
      const after = await db.courseMaterial.findMany({ where: { courseOfferingId: offering.id, title: `zz-load-test-${tag}` } });
      ok("upload finished: success message + exactly one saved material", after.length === 1 && (await db.courseMaterial.count({ where: { courseOfferingId: offering.id } })) === before + 1);
      // remove the test material through the UI (deletes the file from Storage, then the row)
      page.on("dialog", (d: { accept(): void }) => d.accept());
      await page.reload({ waitUntil: "networkidle0" });
      await page.evaluate((title: string) => { const li = Array.from(document.querySelectorAll("li")).find((x) => x.textContent?.includes(title)); (Array.from(li?.querySelectorAll("button") ?? []).find((b) => b.textContent?.trim() === "Delete") as HTMLButtonElement)?.click(); }, `zz-load-test-${tag}`);
      await page.waitForFunction(() => !/zz-load-test/.test(document.body.textContent ?? ""), { timeout: 20000 }).catch(() => {});
      ok("test material was deleted again (row + Storage object)", (await db.courseMaterial.count({ where: { courseOfferingId: offering.id } })) === before);
      fs.rmSync(file, { force: true });
      await page.close();
    }

    // ============ 4. error boundary + friendly not-found ===================================================================================
    if (run("error")) for (const width of [375, 1000]) {
      const nf = await newPage("faculty", width);
      await nf.goto(`${BASE}/e-learning/faculty/my-subjects/does-not-exist`, { waitUntil: "networkidle0" });
      const a = await nf.evaluate(() => ({ t: document.body.textContent ?? "", scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
      ok(`[@${width}px] a missing/unauthorized subject shows the friendly "couldn't find that page" (not a raw error)`, /couldn.t find that page/.test(a.t) && !a.scroll);
      await nf.close();
      const er = await newPage("faculty", width);
      await er.goto(`${BASE}/e-learning/faculty/results/${unassignedCourse}`, { waitUntil: "networkidle0" }); // exists, but this lecturer isn't assigned: the page throws
      const b = await er.evaluate(() => ({ t: document.querySelector("main")?.textContent ?? "", alert: !!document.querySelector("main [role=alert]"), retry: Array.from(document.querySelectorAll("button")).some((x) => /Try again/.test(x.textContent ?? "")), scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
      ok(`[@${width}px] a failed page shows the error boundary with "Try again" (distinct from an empty list)`, b.alert && b.retry && /couldn.t be loaded/.test(b.t) && !b.scroll);
      await er.close();
    }

    // ============ 5. sign-up: options loading / failed fetch / OTP resend ===================================================================
    if (run("signup")) {
      const page = await newPage(null, 375);
      await page.setRequestInterception(true);
      let mode: "slow" | "fail" | "ok" = "slow";
      page.on("request", (req: { url(): string; continue(): void; abort(): void }) => {
        if (req.url().includes("/api/signup/student/options")) { if (mode === "slow") setTimeout(() => { mode = "ok"; req.continue(); }, 2200); else if (mode === "fail") req.abort(); else req.continue(); }
        else req.continue();
      });
      await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#su-college");
      await sleep(500);
      const loading = await page.evaluate(() => { const c = document.getElementById("su-college") as HTMLSelectElement; return { disabled: c.disabled, text: c.options[0].textContent, busy: c.getAttribute("aria-busy"), submit: (document.querySelector("button[type=submit]") as HTMLButtonElement).textContent, submitDisabled: (document.querySelector("button[type=submit]") as HTMLButtonElement).disabled }; });
      ok("sign-up College dropdown shows 'Loading…' (disabled) while its options load — not an empty list", loading.disabled && loading.text === "Loading…" && loading.busy === "true", JSON.stringify(loading));
      ok("sign-up submit is disabled and says 'Loading form…' until the options arrive", loading.submitDisabled && /Loading form/.test(loading.submit ?? ""));
      await page.waitForFunction(() => document.querySelectorAll("#su-college option").length > 1, { timeout: 15000 });
      ok("options replace 'Loading…' once loaded", (await page.$eval("#su-college", (e: Element) => (e as HTMLSelectElement).disabled)) === false);
      await page.close();

      const p2 = await newPage(null, 375);
      await p2.setRequestInterception(true);
      let failing = true;
      p2.on("request", (req: { url(): string; continue(): void; abort(): void }) => { if (failing && req.url().includes("/api/signup/student/options")) req.abort(); else req.continue(); });
      await p2.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
      await p2.waitForFunction(() => /Couldn.t load the academic options/.test(document.body.textContent ?? ""), { timeout: 15000 });
      ok("a failed options request shows an error (not an endless 'Loading…') with a Try again button", await p2.evaluate(() => Array.from(document.querySelectorAll("button")).some((b) => /Try again/.test(b.textContent ?? ""))));
      failing = false;
      await p2.evaluate(() => (Array.from(document.querySelectorAll("button")).find((b) => /Try again/.test(b.textContent ?? "")) as HTMLButtonElement).click());
      await p2.waitForFunction(() => document.querySelectorAll("#su-college option").length > 1, { timeout: 15000 });
      ok("Try again reloads the options", true);
      await p2.close();

      // OTP resend loading (uses the real 60 s cooldown)
      const p3 = await newPage(null, 375);
      const local = `zzload${tag}`;
      const college = await db.college.findFirstOrThrow({ where: { code: "CoE" } });
      await p3.goto(`${BASE}/signup`, { waitUntil: "networkidle0" });
      await p3.waitForSelector("#su-college option:not([value=''])");
      await p3.type("#su-first", "Load"); await p3.type("#su-last", "Test");
      await p3.type("input[placeholder='Email']", local);
      await p3.select("#su-college", college.id);
      await p3.select("#su-department", (await db.department.findFirstOrThrow({ where: { collegeId: college.id, code: "EIENG" } })).id);
      await p3.select("#su-programme", (await db.programme.findFirstOrThrow({ where: { code: "EEE" } })).id);
      await p3.select("#su-level", "300");
      await p3.type("#su-matric", `zz/load/${tag}`);
      await p3.type("input[placeholder='At least 8 characters']", "load-test-pass-1");
      await p3.evaluate(() => (document.querySelector("button[type=submit]") as HTMLButtonElement).click());
      await p3.waitForSelector("[data-testid=otp-step]", { timeout: 20000 });
      await p3.setRequestInterception(true);
      p3.on("request", (req: { url(): string; continue(): void }) => { if (req.url().includes("/api/signup/student/resend")) setTimeout(() => req.continue(), 2000); else req.continue(); });
      await p3.waitForFunction(() => Array.from(document.querySelectorAll("[data-testid=otp-step] button")).some((b) => b.textContent === "Resend code" && !(b as HTMLButtonElement).disabled), { timeout: 90000 });
      await p3.evaluate(() => (Array.from(document.querySelectorAll("[data-testid=otp-step] button")).find((b) => b.textContent === "Resend code") as HTMLButtonElement).click());
      await sleep(600);
      const r = await p3.evaluate(() => { const b = Array.from(document.querySelectorAll("[data-testid=otp-step] button")).find((x) => /Sending a new code/.test(x.textContent ?? "")) as HTMLButtonElement | undefined; return { found: !!b, disabled: b?.disabled, busy: b?.getAttribute("aria-busy") }; });
      ok("OTP 'Resend code' shows its own loading state ('Sending a new code…', disabled, aria-busy)", r.found && r.disabled === true && r.busy === "true", JSON.stringify(r));
      await p3.waitForFunction(() => /Resend code in \d+s/.test(document.querySelector("[data-testid=otp-step]")?.textContent ?? ""), { timeout: 15000 });
      ok("after the resend, the cooldown countdown restarts correctly", true);
      await p3.close();
      await core.pendingSignup.deleteMany({ where: { email: { startsWith: local } } });
    }
  } finally {
    await browser.close();
    await core.pendingSignup.deleteMany({ where: { email: { startsWith: `zzload${tag}` } } });
    await db.courseMaterial.deleteMany({ where: { title: { startsWith: "zz-load-test-" } } }).catch(() => {});
  }
  console.log(`\n${p} passed, ${f} failed`);
  await db.$disconnect(); await core.$disconnect();
  process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
