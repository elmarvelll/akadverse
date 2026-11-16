import "../helpers/env";
import { signInAs } from "../helpers/session";
import { after, before, it, mock } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { elearningDb } from "@/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
let context: CurrentAcademicContext | null = null;
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => context } });
let page: typeof import("@/app/e-learning/student/dashboard/page").default;
before(async () => { page = (await import("@/app/e-learning/student/dashboard/page")).default; });
after(async () => { await elearningDb.$disconnect(); });
it("renders the real student dashboard with an enrolled student's local academic records", async () => {
  const scenario = await courseScenario(); context = scenario.ctx;
  signInAs({ id: scenario.studentId, email: "student@example.test" });
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Your academic overview/); assert.ok(html.includes(scenario.ctx.session!.name)); assert.match(html, /Approved/);
});
