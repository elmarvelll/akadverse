// Real-browser check that every sidebar label (section headers, nested groups, links) stays on ONE line for every role,
// with every group expanded, on the phone drawer, tablet drawer and desktop sidebar.
//
// Run: PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3100 npx tsx --env-file=.env scripts/verify-sidebar.ts

import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { prisma as core } from "../src/lib/prisma";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
let p = 0, f = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) p++; else f++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
const ROLES = [
  { role: "student", email: "marvelousifezue31@stu.cu.edu.ng", path: "/e-learning/student/dashboard" },
  { role: "faculty", email: "marvelousifezue31@faculty.cu.edu.ng", path: "/e-learning/faculty/dashboard" },
  { role: "hod", email: "marvelousifezue31@hodeie.cu.stu.ng", path: "/e-learning/hod/dashboard" },
  { role: "dapu", email: "marvelousifezue31@dapu.cu.edu.ng", path: "/e-learning/dapu/dashboard" },
];
const VIEWPORTS = [{ w: 320, drawer: true }, { w: 375, drawer: true }, { w: 768, drawer: true }, { w: 1024, drawer: false }, { w: 1280, drawer: false }];

async function main() {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  try {
    for (const r of ROLES) {
      const u = await core.user.findUniqueOrThrow({ where: { email: r.email } });
      const cookie = await encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: 900, token: { id: u.id, email: u.email, name: u.firstName, firstName: u.firstName, role: u.role, isAdmin: u.isAdmin } });
      for (const v of VIEWPORTS) {
        const page = await browser.newPage();
        await page.evaluateOnNewDocument("window.__name = (f) => f;");
        await page.setViewport({ width: v.w, height: 900, isMobile: v.drawer && v.w < 768, hasTouch: v.drawer && v.w < 768 });
        await page.setCookie({ name: "next-auth.session-token", value: cookie, url: BASE });
        await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle0" });
        if (v.drawer) { await page.click('button[aria-label="Open menu"]'); await new Promise((res) => setTimeout(res, 400)); }
        // expand every collapsed group (several passes: expanding reveals nested group buttons)
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => { document.querySelectorAll<HTMLButtonElement>("#elearning-nav button").forEach((b) => { const chev = b.querySelector("svg:last-child"); if (chev && !b.dataset.open) { b.dataset.open = "1"; b.click(); } }); });
          await new Promise((res) => setTimeout(res, 150));
        }
        const res = await page.evaluate(() => {
          const nav = document.getElementById("elearning-nav")!;
          const wrapped: string[] = [], clipped: string[] = [];
          const navRect = nav.getBoundingClientRect();
          let count = 0;
          nav.querySelectorAll("a, button").forEach((el) => {
            const range = document.createRange();
            const textNodes: Text[] = [];
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) if ((n.textContent ?? "").trim()) textNodes.push(n as Text);
            if (!textNodes.length) return;
            count++;
            const tops = new Set<number>(); let right = 0;
            textNodes.forEach((t) => { range.selectNodeContents(t); Array.from(range.getClientRects()).forEach((rc) => { tops.add(Math.round(rc.top)); right = Math.max(right, rc.right); }); });
            const label = (el.textContent ?? "").trim();
            if (tops.size > 1) wrapped.push(label);
            if (right > navRect.right + 1) clipped.push(label);
          });
          return { count, wrapped, clipped, navWidth: Math.round(navRect.width) };
        });
        ok(`[${r.role} @${v.w}px${v.drawer ? " drawer" : " sidebar"}] all ${res.count} labels on one line (nav ${res.navWidth}px wide)`, res.wrapped.length === 0 && res.clipped.length === 0 && res.count > 3, `wrapped: ${res.wrapped.join(" | ")}; clipped: ${res.clipped.join(" | ")}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${p} passed, ${f} failed`);
  await core.$disconnect();
  process.exit(f ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
