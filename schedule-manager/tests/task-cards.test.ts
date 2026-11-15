import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { taskViewStatus, type Task } from "../src/features/tasks/domain.ts";

function harness() {
  const require = createRequire(import.meta.url), runtime = require("react/jsx-runtime");
  const buttons = new Map<string, ComponentProps<"button">>();
  const jsx = (type: unknown, props: ComponentProps<"button">, key: unknown) => {
    if (type === "button") buttons.set(props.className || String(props.children), props);
    return runtime.jsx(type, props, key);
  };
  const cache = new Map<string, Record<string, unknown>>();
  function load(name: string) {
    if (cache.has(name)) return cache.get(name)!;
    const source = readFileSync(new URL(`../src/features/tasks/${name}.tsx`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const exports: Record<string, unknown> = {};
    new Function("require", "exports", compiled)((dependency: string) => dependency === "react/jsx-runtime" ? { ...runtime, jsx, jsxs: jsx } : dependency === "./domain" ? { taskViewStatus } : dependency.startsWith("./") ? load(dependency.slice(2)) : require(dependency), exports);
    cache.set(name, exports); return exports;
  }
  return { buttons, load };
}
function task(id: string, overrides: Partial<Task> = {}): Task {
  return { id, ownerId: "development-student", title: id, priority: "medium", source: { kind: "ordinary" }, status: "pending", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", history: [], ...overrides };
}

test("every status card has a whole-card native details button opening its exact task, with no View task control or nested buttons", () => {
  const h = harness();
  type Props = { task: Task; timezone: string; instant: Date; busy: boolean; onOpen: (id: string) => void; onComplete: () => void; onMiss: () => void; children?: ReactNode };
  const Card = h.load("TaskCard").TaskCard as ComponentType<Props>;
  for (const record of [task("active", { dueDate: "2030-11-04" }), task("pending", { dueDate: "2020-11-04" }), task("completed", { status: "completed" }), task("missed", { status: "missed" })]) {
    h.buttons.clear();
    let opened = "";
    const html = renderToStaticMarkup(createElement(Card, { task: record, timezone: "Africa/Lagos", instant: new Date("2030-11-04T14:00:00Z"), busy: false, onOpen(id) { opened = id; }, onComplete() { assert.fail("Opening details must not complete"); }, onMiss() { assert.fail("Opening details must not mark missed"); } }, createElement("h2", null, record.title)));
    assert.match(html, /class="task-card-open"/);
    assert.match(html, /type="button"/);
    assert.match(html, new RegExp(`aria-label="Open details for ${record.title}"`));
    assert.doesNotMatch(html, /View task|href=/);
    if (record.status !== "pending") {
      assert.equal(h.buttons.has("outcome-complete"), false);
      assert.equal(h.buttons.has("outcome-missed"), false);
    }
    let depth = 0;
    for (const tag of html.match(/<\/?button\b[^>]*>/g) || []) {
      depth += tag.startsWith("</") ? -1 : 1;
      assert.ok(depth >= 0 && depth <= 1, "Buttons must be siblings, never nested");
    }
    assert.equal(depth, 0);
    h.buttons.get("task-card-open")!.onClick!({} as never);
    assert.equal(opened, record.id);
  }
});

test("completed and missed habit cards have no outcome controls", () => {
  const h = harness();
  const Actions = h.load("TaskOutcomeActions").TaskOutcomeActions as ComponentType<{ task: Task; timezone: string; instant: Date; busy: boolean; onComplete: () => void; onMiss: () => void }>;
  for (const status of ["completed", "missed"] as const) {
    const record = task(status, { status, source: { kind: "habit", habitId: "reading", occurrenceId: "one", habitName: "Read", scheduledDate: "2030-11-04" } });
    const html = renderToStaticMarkup(createElement(Actions, { task: record, timezone: "Africa/Lagos", instant: new Date("2030-11-04T14:00:00Z"), busy: false, onComplete() { assert.fail(); }, onMiss() { assert.fail(); } }));
    assert.equal(html, "");
  }
});

test("Active and Pending card outcomes stop propagation and do not open details", () => {
  const h = harness();
  const Card = h.load("TaskCard").TaskCard as ComponentType<{ task: Task; timezone: string; instant: Date; busy: boolean; onOpen: () => void; onComplete: () => void; onMiss: () => void; children?: ReactNode }>;
  for (const dueDate of ["2030-11-04", "2020-11-04"]) {
    h.buttons.clear();
    const pending = dueDate.startsWith("2020");
    let opened = 0, completed = 0, missed = 0, stopped = 0;
    renderToStaticMarkup(createElement(Card, { task: task(dueDate, { dueDate }), timezone: "Africa/Lagos", instant: new Date("2030-11-04T14:00:00Z"), busy: false, onOpen() { opened++; }, onComplete() { completed++; }, onMiss() { missed++; } }, "Task information"));
    for (const className of pending ? ["outcome-complete", "outcome-missed"] : ["outcome-complete"]) h.buttons.get(className)!.onClick!({ stopPropagation() { stopped++; } } as never);
    assert.equal(completed, 1); assert.equal(missed, pending ? 1 : 0); assert.equal(stopped, pending ? 2 : 1); assert.equal(opened, 0);
    renderToStaticMarkup(createElement(Card, { task: task(dueDate, { dueDate }), timezone: "Africa/Lagos", instant: new Date("2030-11-04T14:00:00Z"), busy: true, onOpen() {}, onComplete() {}, onMiss() {} }, "Saving"));
    assert.equal(h.buttons.get("outcome-complete")!.disabled, true);
    if (pending) assert.equal(h.buttons.get("outcome-missed")!.disabled, true);
    else assert.equal(h.buttons.has("outcome-missed"), false);
  }
});

test("dialog actions contain only permitted Edit/Delete controls, respecting outcomes, habit sources and deletion", () => {
  const h = harness();
  const Actions = h.load("TaskDetailActions").TaskDetailActions as ComponentType<{ task: Task; timezone: string; instant: Date; busy: boolean; onEdit: () => void; onDelete: () => void }>;
  const render = (record: Task) => renderToStaticMarkup(createElement(Actions, { task: record, timezone: "Africa/Lagos", instant: new Date("2030-11-04T14:00:00Z"), busy: false, onEdit() {}, onDelete() {} }));
  for (const date of ["2030-11-04", "2020-11-04"]) {
    const html = render(task("unfinished", { dueDate: date }));
    assert.match(html, /Edit task/); assert.match(html, /Delete task/);
    assert.doesNotMatch(html, />Complete<|Mark missed|Complete habit/);
  }
  for (const status of ["completed", "missed"] as const) {
    const html = render(task(status, { status }));
    assert.match(html, /Delete task/); assert.doesNotMatch(html, /Edit task|>Complete<|Mark missed/);
  }
  assert.equal(render(task("habit", { source: { kind: "habit", habitId: "habit", occurrenceId: "one", habitName: "Habit", scheduledDate: "2030-11-04" } })), "");
  assert.equal(render(task("deleted", { deletedAt: "2026-11-02T00:00:00Z" })), "");
});
