import "../helpers/env";
import { before, it, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getStudentNav, getDashboardHref } from "@/app/e-learning/_components/nav-config";
let pathname = "/e-learning/student/dashboard";
mock.module("next/navigation", { namedExports: { usePathname: () => pathname, notFound: () => { throw new Error("NOT_FOUND"); } } });
mock.module("next/link", { defaultExport: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> });
let Sidebar: typeof import("@/app/e-learning/_components/Sidebar").default;
before(async () => { ({ default: Sidebar } = await import("@/app/e-learning/_components/Sidebar")); });
it("shares the student dashboard destination while preserving other role destinations", () => {
  assert.equal(getStudentNav().find(s => s.label === "Dashboard")?.href, "/e-learning/student/dashboard");
  assert.equal(getDashboardHref("faculty"), "/facultydashboard"); assert.equal(getDashboardHref("hod"), "/e-learning/hod/dashboard");
});
it("marks Dashboard active only at the exact dashboard route in full and rail navigation", () => {
  for (const collapsed of [false, true]) for (const route of ["/e-learning/student/dashboard", "/e-learning/student/dashboard/nested", "/e-learning/student/dashboard-other", "/e-learning/student/study-zone/course"]) {
    pathname = route;
    const html = renderToStaticMarkup(<Sidebar role="student" isLevelAdviser={false} collapsed={collapsed} />);
    const dashboard = html.match(/<a\b[^>]*href="\/e-learning\/student\/dashboard"[^>]*>/)?.[0];
    assert.ok(dashboard); assert.equal(dashboard.includes('aria-current="page"'), route === "/e-learning/student/dashboard");
    assert.ok(html.includes('href="/e-learning/student/study-zone"'));
  }
});
it("retires direct Main Menu and AI Studio pages for every account", async () => {
  for (const page of [import("@/app/studashboard/main-menu/page"), import("@/app/studashboard/ai-studio/page"), import("@/app/facultydashboard/main-menu/page"), import("@/app/facultydashboard/ai-studio/page"), import("@/app/studashboard/admin/ai-studio/page")]) {
    assert.throws((await page).default, /NOT_FOUND/);
  }
});


it("hides student results and CGPA navigation while exposing the portal return link in full and rail modes", () => {
  const tree = JSON.stringify(getStudentNav());
  assert.doesNotMatch(tree, /academic-records|CGPA|Results/);
  for (const collapsed of [true, false]) {
    const html = renderToStaticMarkup(<Sidebar role="student" isLevelAdviser={false} collapsed={collapsed} />);
    assert.match(html, /href="\/studashboard"/);
    assert.match(html, /Back to Home/);
  }
});
