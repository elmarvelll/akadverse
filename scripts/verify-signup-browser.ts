// REAL-BROWSER test of the student sign-up UI (headless Chrome via puppeteer-core) against a running server:
//   - the four academic fields are real <select> dropdowns with the testing options; VC/Dean are not offered
//   - Role is its OWN dropdown; it fixes the domain shown beside the email input (Student -> @stu.cu.edu.ng, ...) and the
//     FULL email preview updates when the role changes
//   - the login page has NO role/domain picker: a plain email field that accepts any address
//   - readability: text/background contrast >= 4.5:1 for labels, inputs, selects, the email preview, in dark AND light mode
//   - responsive: no horizontal overflow, no field clipped outside the viewport or covered, at phone / tablet / desktop
//   - the whole flow through the UI: details -> OTP step -> wrong code -> right code -> account created in BOTH
//     databases (Student.userId === User.id) -> signed in -> student home
// The server must be started with RESEND_API_KEY empty (so nothing is really e-mailed); the test then sets a KNOWN OTP hash
// on its own pending record (it has DB access) instead of reading an inbox. All test records are removed afterwards.
//
// Run: PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3100 npx tsx --env-file=.env scripts/verify-signup-browser.ts

import { createRequire } from "node:module";
import { prisma as core } from "../src/lib/prisma";
import { elearningDb as db } from "../src/lib/db/elearning";
import { hashOtp } from "../services/auth/student-signup/otp";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
const tag = `${Date.now() % 1000000}`;
const local = `zzbr${tag}`;
const VIEWPORTS = [{ w: 375, h: 812, mobile: true }, { w: 768, h: 1024, mobile: false }, { w: 1280, h: 800, mobile: false }];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const shots = process.env.SHOTS_DIR;
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const open = async (v: (typeof VIEWPORTS)[number], theme: "dark" | "light") => {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(`window.__name = (f) => f; try { localStorage.setItem("akadverse-theme", "${theme}"); } catch (e) {}`);
    await page.setViewport({ width: v.w, height: v.h, isMobile: v.mobile, hasTouch: v.mobile });
    await page.goto(`${BASE}/signup`, { waitUntil: "networkidle0" });
    await page.waitForSelector("#su-college option:not([value=''])"); // the options are fetched from the server after the page loads
    return page;
  };

  try {
    for (const theme of ["dark", "light"] as const) {
      for (const v of VIEWPORTS) {
        const tagName = `${theme}@${v.w}px`;
        const loc = `${local}${theme[0]}`; // unique per theme: each full flow creates its own account
        const locEmail = `${loc}@stu.cu.edu.ng`;
        const page = await open(v, theme);

        // ---- dropdowns are real selects with the testing options --------------------------------------------------------
        const dd = await page.evaluate(() => {
          const opt = (id: string) => Array.from(document.querySelectorAll(`#${id} option`)).map((o) => (o as HTMLOptionElement).textContent!.trim());
          const tags = ["su-college", "su-department", "su-programme", "su-level"].map((id) => document.getElementById(id)?.tagName);
          return { tags, college: opt("su-college"), level: opt("su-level"), role: Array.from(document.querySelectorAll('#su-role option')).map((o) => (o as HTMLOptionElement).textContent!.trim()) };
        });
        ok(`[${tagName}] College/Department/Programme/Level are <select> controls`, dd.tags.every((t: string) => t === "SELECT"));
        ok(`[${tagName}] College dropdown offers the testing college`, dd.college.some((t: string) => t.startsWith("CoE")), dd.college.join(" | "));
        ok(`[${tagName}] Level dropdown offers 300 Level`, dd.level.includes("300 Level"));
        ok(`[${tagName}] the Role field is its own dropdown: Student/Faculty/HOD/DAPU (no VC / Dean)`, dd.role.filter((r: string) => !r.startsWith("Select")).join() === "Student,Faculty,HOD,DAPU", dd.role.join());
        const roleInfo = await page.evaluate(() => ({ tag: document.getElementById("su-role")?.tagName, value: (document.getElementById("su-role") as HTMLSelectElement).value, selects: document.querySelectorAll(".flex.rounded-2xl.border select").length, domainTag: document.querySelector("[data-testid=email-domain]")?.tagName, domain: document.querySelector("[data-testid=email-domain]")?.textContent }));
        ok(`[${tagName}] Role defaults to Student and the domain beside the email is fixed text (not a dropdown/input)`, roleInfo.tag === "SELECT" && roleInfo.value === "student" && roleInfo.selects === 0 && roleInfo.domainTag === "SPAN" && roleInfo.domain === "@stu.cu.edu.ng", JSON.stringify(roleInfo));

        // cascade: department/programme are disabled until their parent is chosen, then offer the right single option
        await page.select("#su-college", await page.$eval("#su-college option:not([disabled]):not([value=''])", (o: Element) => (o as HTMLOptionElement).value));
        await page.select("#su-department", await page.$eval("#su-department option:not([disabled]):not([value=''])", (o: Element) => (o as HTMLOptionElement).value));
        const progText = await page.$eval("#su-programme", (s: Element) => Array.from((s as HTMLSelectElement).options).map((o) => o.textContent!.trim()).join("|"));
        const deptText = await page.$eval("#su-department", (s: Element) => Array.from((s as HTMLSelectElement).options).map((o) => o.textContent!.trim()).join("|"));
        ok(`[${tagName}] Department offers 'Electrical and Information Engineering'`, deptText.includes("Electrical and Information Engineering"));
        ok(`[${tagName}] Programme offers 'Electrical and Electronics Engineering'`, progText.includes("Electrical and Electronics Engineering"));

        // ---- role decides the domain; the FULL email preview is shown and updates ------------------------------------------
        await page.type("input[placeholder='Email']", loc);
        const previewOf = () => page.$eval("[data-testid=full-email]", (e: Element) => e.textContent!.trim());
        ok(`[${tagName}] full email preview shows <local>@stu.cu.edu.ng`, (await previewOf()) === locEmail, await previewOf());
        await page.select('#su-role', "faculty");
        await sleep(150);
        ok(`[${tagName}] choosing Faculty switches the preview to the faculty domain`, (await previewOf()) === `${loc}@faculty.cu.edu.ng`, await previewOf());
        ok(`[${tagName}] Faculty -> fixed domain @faculty.cu.edu.ng`, (await page.$eval("[data-testid=email-domain]", (e: Element) => e.textContent)) === "@faculty.cu.edu.ng");
        await page.waitForSelector("#su-college option:not([value=''])");
        const staffFields = () => page.evaluate(() => ({ college: !!document.getElementById("su-college"), department: !!document.getElementById("su-department"), programme: !!document.getElementById("su-programme"), level: !!document.getElementById("su-level"), matric: !!document.getElementById("su-matric"), scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
        const ff = await staffFields();
        ok(`[${tagName}] Faculty sign-up shows College + Department dropdowns (and no programme/level/matric)`, ff.college && ff.department && !ff.programme && !ff.level && !ff.matric && !ff.scrolls, JSON.stringify(ff));
        await page.select("#su-college", await page.$eval("#su-college option:not([disabled]):not([value=''])", (o: Element) => (o as HTMLOptionElement).value));
        ok(`[${tagName}] Faculty Department dropdown offers 'Electrical and Information Engineering' after choosing the college`, (await page.$eval("#su-department", (e: Element) => Array.from((e as HTMLSelectElement).options).map((o) => o.textContent).join("|"))).includes("Electrical and Information Engineering"));
        await page.select("#su-role", "hod");
        await sleep(100);
        ok(`[${tagName}] HOD -> the existing HOD domain, preview follows`, (await page.$eval("[data-testid=email-domain]", (e: Element) => e.textContent)) === "@hodeie.cu.stu.ng" && (await previewOf()) === `${loc}@hodeie.cu.stu.ng`, await previewOf());
        const hf = await staffFields();
        ok(`[${tagName}] HOD sign-up also shows College + Department`, hf.college && hf.department && !hf.programme && !hf.scrolls, JSON.stringify(hf));
        await page.select("#su-role", "dapu");
        await sleep(100);
        const df = await staffFields();
        ok(`[${tagName}] DAPU sign-up has no College/Department (university-wide)`, !df.college && !df.department && !df.scrolls, JSON.stringify(df));
        ok(`[${tagName}] DAPU -> the existing DAPU domain, preview follows`, (await page.$eval("[data-testid=email-domain]", (e: Element) => e.textContent)) === "@dapu.cu.edu.ng" && (await previewOf()) === `${loc}@dapu.cu.edu.ng`, await previewOf());
        await page.select("#su-role", "student");
        await sleep(100);
        await page.waitForSelector("#su-college option:not([value=''])"); // the student form re-mounts and re-fetches its options
        await page.select("#su-college", await page.$eval("#su-college option:not([disabled]):not([value=''])", (o: Element) => (o as HTMLOptionElement).value));
        await page.select("#su-department", await page.$eval("#su-department option:not([disabled]):not([value=''])", (o: Element) => (o as HTMLOptionElement).value));
        await page.select("#su-programme", await page.$eval("#su-programme option:not([disabled]):not([value=''])", (o: Element) => (o as HTMLOptionElement).value));
        await page.select("#su-level", "300");
        await page.type("#su-first", "Browser");
        await page.type("#su-last", "Tester");
        await page.type("#su-matric", `zz/br/${tag}${theme[0]}`);
        await page.type("input[placeholder='At least 8 characters']", "browser-pass-1");

        // ---- responsive + readable ------------------------------------------------------------------------------------------
        const audit = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
          const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true })!;
          const parse = (s: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }; }; // canvas resolves any CSS colour syntax to sRGB
          const bgOf = (el: Element) => { let acc = [255, 255, 255]; const chain: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) chain.push(e); for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) acc = acc.map((v, i) => Math.round(c.rgb[i] * c.a + v * (1 - c.a))); } return acc; };
          const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
          const checks: { name: string; ratio: number }[] = [];
          const add = (name: string, el: Element | null) => { if (!el) return; const c = parse(getComputedStyle(el).color); checks.push({ name, ratio: ratio(c.rgb, bgOf(el)) }); };
          add("first-name text", document.getElementById("su-first")); add("matric text", document.getElementById("su-matric"));
          for (const id of ["su-college", "su-department", "su-programme", "su-level"]) add(`${id} selected value`, document.getElementById(id));
          add("full email preview", document.querySelector("[data-testid=full-email]"));
          document.querySelectorAll("label").forEach((l) => add(`label "${l.textContent!.trim().slice(0, 18)}"`, l));
          add("role dropdown", document.getElementById("su-role"));
          const hidden: string[] = [];
          for (const el of Array.from(document.querySelectorAll("input, select, button, [data-testid=full-email]"))) {
            const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
            if (r.left < -1 || r.right > vw + 1) hidden.push(`${el.tagName}#${(el as HTMLElement).id} outside viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
          }
          return { scrolls: document.documentElement.scrollWidth > vw + 1, sw: document.documentElement.scrollWidth, vw, checks, hidden };
        });
        ok(`[${tagName}] no horizontal page overflow`, !audit.scrolls, `scrollWidth ${audit.sw} / ${audit.vw}`);
        ok(`[${tagName}] no field clipped outside the viewport`, audit.hidden.length === 0, audit.hidden.join("; "));
        const low = audit.checks.filter((c: { ratio: number }) => c.ratio < 4.5);
        ok(`[${tagName}] text is readable (contrast >= 4.5:1) on ${audit.checks.length} elements`, low.length === 0, low.map((c: { name: string; ratio: number }) => `${c.name} ${c.ratio.toFixed(2)}`).join("; "));
        const covered = await page.evaluate(() => Array.from(document.querySelectorAll("#su-first, #su-college, #su-matric, [data-testid=full-email]")).filter((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1)); return r.top < innerHeight && top && !el.contains(top) && !top.contains(el); }).map((e) => (e as HTMLElement).id || "email-preview"));
        ok(`[${tagName}] no field is covered by another element`, covered.length === 0, covered.join(","));
        if (shots && v.w === 375) await page.screenshot({ path: `${shots}/signup-form-${theme}-375.png`, fullPage: true });

        // ---- the full flow, once per theme at phone width and once desktop ---------------------------------------------------
        if ((theme === "dark" && v.w === 375) || (theme === "light" && v.w === 1280)) {
          const flowEmail = locEmail;
          await page.evaluate(() => (document.querySelector("button[type=submit]") as HTMLButtonElement).click());
          await page.waitForSelector("[data-testid=otp-step]", { timeout: 20000 });
          ok(`[${tagName}] after Submit the OTP step appears and shows the institutional email`, (await page.$eval("[data-testid=otp-step]", (e: Element) => e.textContent!)).includes(flowEmail));
          ok(`[${tagName}] no User exists yet (created only after the OTP)`, !(await core.user.findUnique({ where: { email: flowEmail } })));
          const otpInput = await page.$("#signup-otp");
          ok(`[${tagName}] OTP field is numeric with one-time-code autofill`, (await page.$eval("#signup-otp", (e: Element) => `${e.getAttribute("inputmode")}|${e.getAttribute("autocomplete")}|${e.getAttribute("maxlength")}`)) === "numeric|one-time-code|6" && !!otpInput);
          ok(`[${tagName}] resend is disabled with a countdown during the cooldown`, /Resend code in \d+s/.test(await page.$eval("[data-testid=otp-step]", (e: Element) => e.textContent!)));
          await core.pendingSignup.update({ where: { email: flowEmail }, data: { otpHash: hashOtp("123456", flowEmail) } }); // known code (no inbox in tests)
          await page.type("#signup-otp", "654321");
          await page.evaluate(() => (document.querySelector("[data-testid=otp-step] button[type=submit]") as HTMLButtonElement).click());
          await page.waitForSelector("[data-testid=otp-step] [role=alert]", { timeout: 15000 });
          ok(`[${tagName}] a wrong code shows a clear inline error`, /isn't right/.test(await page.$eval("[data-testid=otp-step] [role=alert]", (e: Element) => e.textContent!)));
          const ovf = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          ok(`[${tagName}] OTP step has no horizontal overflow`, !ovf);
          if (shots && v.w === 375) await page.screenshot({ path: `${shots}/signup-otp-${theme}-375.png`, fullPage: true });
          await page.click("#signup-otp");
          await page.keyboard.press("End"); // the click leaves the caret mid-field; Backspace only removes what is before it
          for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace"); // the field caps at 6 digits, so clear it before typing the right code
          await page.type("#signup-otp", "123456");
          try {
            await Promise.all([page.waitForFunction(() => location.pathname !== "/signup", { timeout: 30000 }), page.evaluate(() => (document.querySelector("[data-testid=otp-step] button[type=submit]") as HTMLButtonElement).click())]);
          } catch (e) {
            const dbg = await page.evaluate(() => ({ url: location.href, text: document.querySelector("[data-testid=otp-step]")?.textContent?.slice(0, 300), code: (document.getElementById("signup-otp") as HTMLInputElement | null)?.value, btn: (document.querySelector("[data-testid=otp-step] button[type=submit]") as HTMLButtonElement | null)?.disabled }));
            console.log("DEBUG after right code:", JSON.stringify(dbg), "user:", !!(await core.user.findUnique({ where: { email: flowEmail } })));
            throw e;
          }
          await sleep(1500);
          const path = new URL(page.url()).pathname;
          ok(`[${tagName}] the right code creates the account and signs the student in (lands on ${path})`, path.startsWith("/studashboard") || path === "/", path);
          const user = await core.user.findUnique({ where: { email: flowEmail } });
          const profile = user ? await db.studentProfile.findUnique({ where: { userId: user.id } }) : null;
          const dept = profile ? await db.department.findUnique({ where: { id: profile.departmentId }, include: { college: true } }) : null;
          const prog = profile?.programmeId ? await db.programme.findUnique({ where: { id: profile.programmeId } }) : null;
          ok(`[${tagName}] Main DB has one User and E-Learning DB one StudentProfile with Student.userId === User.id`, !!user && !!profile && profile.userId === user.id && (await core.user.count({ where: { email: flowEmail } })) === 1);
          ok(`[${tagName}] profile: CoE > Electrical and Information Engineering > Electrical and Electronics Engineering, 300 Level, matric saved`,
            dept?.college.code === "CoE" && dept?.name === "Electrical and Information Engineering" && prog?.name === "Electrical and Electronics Engineering" && profile?.level === 300 && profile?.matricNumber === `ZZ/BR/${tag}${theme[0]}`.toUpperCase(), `${dept?.college.code}/${dept?.name}/${prog?.name}/${profile?.level}/${profile?.matricNumber}`);
          const me = await page.evaluate(async () => (await fetch("/api/auth/session")).json());
          ok(`[${tagName}] the session belongs to the new student (role student, same User id)`, me?.user?.id === user?.id && me?.user?.role === "student", JSON.stringify({ id: me?.user?.id === user?.id, role: me?.user?.role }));
        }
        await page.close();
      }
    }

    // ======================= LOGIN PAGE: a normal email field, no role / domain picker ==========================================
    const bcrypt = (await import("bcryptjs")).default;
    const anyEmail = `zzlogin${tag}@gmail.com`; // deliberately NOT an institutional domain: login accepts any email
    await core.user.create({ data: { firstName: "Login", lastName: "Gmail", email: anyEmail, password: await bcrypt.hash("gmail-login-1", 10) } });
    const openLogin = async (v: (typeof VIEWPORTS)[number], theme: "dark" | "light") => {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(`window.__name = (f) => f; try { localStorage.setItem("akadverse-theme", "${theme}"); } catch (e) {}`);
      await page.setViewport({ width: v.w, height: v.h, isMobile: v.mobile, hasTouch: v.mobile });
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
      await page.waitForSelector("#login-email");
      return page;
    };
    for (const theme of ["dark", "light"] as const) {
      for (const v of VIEWPORTS) {
        const t = `login ${theme}@${v.w}px`;
        const page = await openLogin(v, theme);
        const info = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const inp = document.getElementById("login-email") as HTMLInputElement;
          const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true })!;
          const parse = (s: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }; };
          const lum = (c: number[]) => { const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
          const bgOf = (el: Element) => { let acc = [255, 255, 255]; const chain: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) chain.push(e); for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) acc = acc.map((x, i) => Math.round(c.rgb[i] * c.a + x * (1 - c.a))); } return acc; };
          const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
          const cr = (el: Element) => ratio(parse(getComputedStyle(el).color).rgb, bgOf(el));
          const pw = document.querySelector("input[type=password]")!;
          return {
            selects: document.querySelectorAll("select").length,
            domainText: /@(stu\.cu|faculty\.cu|hodeie|dapu)/i.test(document.body.innerText),
            type: inp.type, autocomplete: inp.autocomplete,
            scrolls: document.documentElement.scrollWidth > vw + 1, sw: document.documentElement.scrollWidth, vw,
            low: [["email input", cr(inp)], ["password input", cr(pw)], ["email label", cr(document.querySelector("label[for=login-email]")!)]].filter(([, r]) => (r as number) < 4.5).map(([n, r]) => `${n} ${(r as number).toFixed(2)}`),
            outside: [inp, pw].some((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > vw; }),
          };
        });
        ok(`[${t}] no role / domain dropdown anywhere on the login page`, info.selects === 0 && !info.domainText, `selects=${info.selects}`);
        ok(`[${t}] email is a normal email field (type=email, autocomplete=email)`, info.type === "email" && info.autocomplete === "email");
        ok(`[${t}] no horizontal overflow and fields inside the viewport`, !info.scrolls && !info.outside, `scrollWidth ${info.sw}/${info.vw}`);
        ok(`[${t}] text is readable (contrast >= 4.5:1)`, info.low.length === 0, info.low.join("; "));
        if (shots && v.w === 375) await page.screenshot({ path: `${shots}/login-${theme}-375.png`, fullPage: true });
        await page.close();
      }
    }
    const signInAs = async (typedEmail: string, password: string) => {
      const page = await openLogin(VIEWPORTS[0], "dark");
      await (await page.createCDPSession()).send("Network.clearBrowserCookies"); // each login starts signed out
      await page.type("#login-email", typedEmail);
      await page.type("input[type=password]", password);
      await page.evaluate(() => (document.querySelector("button[type=submit]") as HTMLButtonElement).click());
      await sleep(3500);
      const path = new URL(page.url()).pathname;
      const session = await page.evaluate(async () => (await fetch("/api/auth/session")).json());
      const err = await page.$("[class*=text-red]").then((h: unknown) => !!h);
      await page.close();
      return { path, email: session?.user?.email as string | undefined, err };
    };
    const a1 = await signInAs(anyEmail, "gmail-login-1");
    ok("login works with ANY email (a Gmail-style address typed in full)", a1.path !== "/login" && a1.email === anyEmail, JSON.stringify(a1));
    const studentEmail = `${local}d@stu.cu.edu.ng`;
    const a2 = await signInAs(studentEmail.toUpperCase(), "browser-pass-1");
    ok("the student created through sign-up can log in by typing the full email (any letter case)", a2.path !== "/login" && a2.email === studentEmail, JSON.stringify(a2));
    const a3 = await signInAs(anyEmail, "wrong-password");
    ok("a wrong password stays on /login with a visible error", a3.path === "/login" && a3.err && !a3.email, JSON.stringify(a3));
  } finally {
    await browser.close();
    const users = await core.user.findMany({ where: { email: { startsWith: `zzbr${tag}` } }, select: { id: true } });
    await db.studentProfile.deleteMany({ where: { OR: [{ userId: { in: users.map((u) => u.id) } }, { matricNumber: { startsWith: "ZZ/BR/" } }] } });
    await core.user.deleteMany({ where: { OR: [{ email: { startsWith: `zzbr${tag}` } }, { email: `zzlogin${tag}@gmail.com` }] } });
    await core.pendingSignup.deleteMany({ where: { email: { startsWith: `zzbr${tag}` } } });
  }
  console.log(`\n${p} passed, ${f} failed`);
  await db.$disconnect(); await core.$disconnect();
  process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
