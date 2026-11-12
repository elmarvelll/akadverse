// REAL-BROWSER test: the AkadVerse name in the shared top bar (DashboardNavbar) — used by every Marketplace page, the student hub, the
// admin area and the faculty hub — takes the signed-in user to THEIR dashboard, as a normal link (not router.back()), and the Marketplace's
// own navigation still works. Needs a running server. Run:
//   PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3200 npx tsx --env-file=.env scripts/verify-marketplace-brand-link.ts

import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { prisma as core } from "../src/lib/prisma";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };

async function main() {
  const acct = async (email: string) => { const u = await core.user.findUniqueOrThrow({ where: { email } }); return encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600, token: { id: u.id, email: u.email, name: u.firstName, firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } }); };
  const biz = await core.business.findFirstOrThrow({ where: { user: { email: "marvelousifezue31@gmail.com" } }, select: { id: true } });
  const who = {
    student: { cookie: await acct("marvelousifezue31@gmail.com"), home: "/studashboard", pages: ["/studashboard/marketplace", "/studashboard/marketplace/explore", "/studashboard/marketplace/orders", "/studashboard/marketplace/business/create", "/studashboard/marketplace/vendor/apply", `/studashboard/marketplace/vendor-dashboard/${biz.id}`, "/studashboard/admin"] },
    faculty: { cookie: await acct("marvelousifezue31@faculty.cu.edu.ng"), home: "/facultydashboard", pages: ["/facultydashboard"] },
  } as const;
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const hydration: string[] = [];
  const open = async (who_: keyof typeof who, width: number) => {
    const page = await browser.newPage();
    page.on("console", (m: { type(): string; text(): string }) => { if (m.type() === "error" && /hydrat|didn't match/i.test(m.text())) hydration.push(m.text().slice(0, 200)); });
    await page.evaluateOnNewDocument("window.__name = (f) => f;");
    await page.setViewport({ width, height: 800, isMobile: width < 768, hasTouch: width < 768 });
    await page.setCookie({ name: "next-auth.session-token", value: who[who_].cookie, url: BASE });
    return page;
  };
  const LOGO = 'nav a[aria-label^="AkadVerse"]';

  try {
    for (const width of [375, 768, 1280]) {
      for (const role of Object.keys(who) as (keyof typeof who)[]) {
        for (const path of who[role].pages) {
          const page = await open(role, width);
          await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }); // marketplace pages keep a live notification stream open, so "network idle" never happens
          await page.waitForSelector(LOGO, { timeout: 60000 });
          const here = new URL(page.url()).pathname;
          const label = `[${role} @${width}px] ${path.replace("/studashboard/", "")}`;
          if (here !== path) { ok(`${label}: page stayed on its route (no unexpected redirect)`, false, `ended on ${here}`); await page.close(); continue; }
          const info = await page.evaluate((sel: string) => ({ count: document.querySelectorAll(sel).length, href: document.querySelector(sel)?.getAttribute("href"), brandTexts: Array.from(document.querySelectorAll("body *")).filter((e) => e.children.length === 0 && e.textContent?.trim() === "Akadverse").length, hist: history.length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }), LOGO);
          ok(`${label}: one AkadVerse link in the top bar, no overflow`, info.count === 1 && info.brandTexts === 1 && !info.overflow, JSON.stringify(info));
          if (path === who[role].home) { // already on the dashboard: clicking stays there
            await page.click(LOGO); await new Promise((r) => setTimeout(r, 1500));
            ok(`${label}: on the dashboard itself, clicking the name keeps you on your dashboard`, new URL(page.url()).pathname === who[role].home);
            await page.close(); continue;
          }
          await page.click(LOGO);
          await page.waitForFunction((h: string) => location.pathname === h, { timeout: 30000 }, who[role].home);
          const after = await page.evaluate(() => ({ path: location.pathname, hist: history.length }));
          ok(`${label}: clicking AkadVerse lands on the ${role} dashboard (${who[role].home})`, after.path === who[role].home, `landed ${after.path}`);
          ok(`${label}: it added a NEW history entry (a link, not router.back())`, after.hist === info.hist + 1, `history ${info.hist} -> ${after.hist}`);
          await page.goBack();
          await page.waitForFunction((d: string) => location.pathname === d, { timeout: 30000 }, path);
          ok(`${label}: browser Back returns to the page you came from`, true);
          await page.close();
        }
      }
    }
    // the Marketplace's OWN navigation is untouched (its secondary bar exists on the marketplace home and Explore pages)
    {
      const page = await open("student", 1280);
      await page.goto(`${BASE}/studashboard/marketplace/explore`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForSelector('a[href="/studashboard/marketplace"]', { timeout: 60000 });
      await page.evaluate(() => (document.querySelector('a[href="/studashboard/marketplace"]') as HTMLAnchorElement).click());
      await page.waitForFunction(() => location.pathname === "/studashboard/marketplace", { timeout: 60000 });
      ok("the 'Student Marketplace' logo still goes to the marketplace home (unchanged)", true);
      await page.waitForSelector('a[href="/studashboard/marketplace/explore"]', { timeout: 60000 });
      await page.evaluate(() => (document.querySelector('a[href="/studashboard/marketplace/explore"]') as HTMLAnchorElement).click());
      await page.waitForFunction(() => location.pathname === "/studashboard/marketplace/explore", { timeout: 60000 });
      ok("the marketplace 'Explore' link still works", true);
      await page.evaluate(() => (document.querySelector('a[href="/studashboard/marketplace/orders"]') as HTMLAnchorElement).click());
      await page.waitForFunction(() => location.pathname === "/studashboard/marketplace/orders", { timeout: 60000 });
      ok("the marketplace 'Orders' link still works", true);
      await page.close();
    }
    {
      const page = await open("student", 1280);
      await page.goto(`${BASE}/studashboard/marketplace/explore?role=faculty&next=/facultydashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForSelector(LOGO, { timeout: 60000 });
      ok("a ?role=faculty query does not change where the Student's logo goes", (await page.$eval(LOGO, (e: Element) => e.getAttribute("href"))) === "/");
      await page.click(LOGO);
      await page.waitForFunction(() => location.pathname === "/studashboard", { timeout: 30000 });
      ok("…and it still lands on the Student dashboard", true);
      await page.close();
    }
    {
      const page = await open("student", 1280);
      await page.goto(`${BASE}/studashboard/marketplace/orders`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForSelector(LOGO, { timeout: 60000 });
      await page.focus(LOGO); await page.keyboard.press("Enter");
      await page.waitForFunction(() => location.pathname === "/studashboard", { timeout: 30000 });
      ok("keyboard: Tab-focus + Enter on the name navigates (accessible)", true);
      await page.close();
    }
    ok("no hydration errors were logged during the whole run", hydration.length === 0, hydration[0] ?? "");
  } finally {
    await browser.close();
  }
  console.log(`\n${p} passed, ${f} failed`);
  await core.$disconnect();
  process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
