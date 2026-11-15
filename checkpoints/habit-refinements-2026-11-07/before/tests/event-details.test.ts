import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as taskDomain from "../src/features/tasks/domain.ts";
import type { PersonalEvent } from "../src/features/schedule/domain.ts";

function loadComponent<Props>(relativePath: string, name: string): ComponentType<Props> {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((dependency: string) => dependency === "./domain" ? taskDomain : require(dependency), exports);
  return exports[name] as ComponentType<Props>;
}

test("personal event backup always shows the selected date/time or the exact empty text without timezone labels", () => {
  const Backup = loadComponent<{ event: Pick<PersonalEvent, "backup"> }>("../src/features/schedule/EventBackup.tsx", "EventBackup");
  const empty = renderToStaticMarkup(createElement(Backup, { event: {} }));
  assert.match(empty, /<dt>Backup<\/dt><dd>No backup time set<\/dd>/);
  const backup = { date: "2030-11-04", start: "15:00", end: "16:00", timezone: "Africa/Lagos" };
  const before = structuredClone(backup);
  const html = renderToStaticMarkup(createElement(Backup, { event: { backup } }));
  assert.match(html, /2030-11-04/); assert.match(html, /15:00/); assert.match(html, /16:00/);
  assert.doesNotMatch(html, /Africa\/Lagos|UTC|GMT/);
  assert.deepEqual(backup, before);
});

test("Active tasks offer early Complete and Pending tasks also offer Mark missed", () => {
  type Props = { task: taskDomain.Task; timezone: string; instant: Date; busy: boolean; onComplete: () => void; onMiss: () => void };
  const Actions = loadComponent<Props>("../src/features/tasks/TaskOutcomeActions.tsx", "TaskOutcomeActions");
  const task: taskDomain.Task = { id: "one", ownerId: "development-student", title: "One", priority: "medium", source: { kind: "ordinary" }, status: "pending", dueDate: "2030-11-04", dueTime: "15:00", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", history: [] };
  const props = { task, timezone: "Africa/Lagos", busy: false, onComplete() {}, onMiss() {} };
  const active = renderToStaticMarkup(createElement(Actions, { ...props, instant: new Date("2030-11-04T13:59:00Z") }));
  assert.match(active, />Complete</); assert.doesNotMatch(active, /Mark missed/);
  const pending = renderToStaticMarkup(createElement(Actions, { ...props, instant: new Date("2030-11-04T14:00:00Z") }));
  assert.match(pending, />Complete</); assert.match(pending, />Mark missed</);
  const completed = renderToStaticMarkup(createElement(Actions, { ...props, task: { ...task, status: "completed" }, instant: new Date("2030-11-04T14:00:00Z") }));
  assert.equal(completed, "");
});
