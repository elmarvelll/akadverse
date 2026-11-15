import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentProps, type Context, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { WorkspaceSelection } from "../src/features/workspace/navigation.ts";

// Node's TypeScript transform does not handle TSX. Compile the actual small
// navigation component with the already-installed compiler, then render it with
// React. Capture the native button handler to verify activation independently
// of unavailable browser automation, without adding a test framework.
function navigationHarness() {
  const require = createRequire(import.meta.url);
  const jsxRuntime = require("react/jsx-runtime");
  let button: ComponentProps<"button"> | undefined;
  const jsx = (type: unknown, props: ComponentProps<"button">, key: unknown) => {
    if (type === "button") button = props;
    return jsxRuntime.jsx(type, props, key);
  };
  const source = readFileSync(new URL("../src/features/workspace/WorkspaceNavigation.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((name: string) => name === "react/jsx-runtime" ? { ...jsxRuntime, jsx, jsxs: jsx } : require(name), exports);
  const Context = exports.WorkspaceNavigation as Context<(selection: WorkspaceSelection) => void>;
  const Button = exports.WorkspaceButton as (props: ComponentProps<"button"> & WorkspaceSelection & { selected?: boolean }) => ReturnType<typeof createElement>;
  let selection: WorkspaceSelection = { section: "schedule" };
  return {
    render(props: Parameters<typeof Button>[0]) {
      return renderToStaticMarkup(createElement(Context.Provider, { value: next => { selection = next; } }, createElement(Button, props)));
    },
    get selection() { return selection; },
    activate(event: Pick<MouseEvent<HTMLButtonElement>, "defaultPrevented"> = { defaultPrevented: false }) { button!.onClick!(event as MouseEvent<HTMLButtonElement>); },
  };
}

test("sidebar uses real selected-state buttons and selection preserves every URL component", () => {
  const harness = navigationHarness();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const location = new URL("https://example.test/productivity?student=7#keep-this-hash");
  const before = { pathname: location.pathname, search: location.search, hash: location.hash };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location, history: { pushState() { assert.fail("Selection must not push browser history"); }, replaceState() { assert.fail("Selection must not replace browser history"); } } } });
  try {
    const html = harness.render({ section: "tasks", selected: false, className: "nav-item", children: "To-do List" });
    assert.match(html, /<button/);
    assert.match(html, /type="button"/);
    assert.match(html, /aria-pressed="false"/);
    assert.doesNotMatch(html, /<a\b|href=/);
    harness.activate();
    assert.equal(harness.selection.section, "tasks");
    const active = harness.render({ section: "tasks", selected: true, className: "nav-item selected", children: "To-do List" });
    assert.match(active, /class="nav-item selected"/);
    assert.match(active, /aria-pressed="true"/);
    harness.render({ section: "schedule", selected: false, children: "Schedule Manager" });
    harness.activate();
    assert.equal(harness.selection.section, "schedule");
    const tracker = harness.render({ section: "habits", habitId: "habit-7", occurrenceDate: "2030-01-30", selected: true, children: "Habit Tracker" });
    assert.match(tracker, /aria-pressed="true"/);
    assert.doesNotMatch(tracker, /href=/);
    harness.activate();
    assert.deepEqual(harness.selection, { section: "habits", taskId: undefined, habitId: "habit-7", occurrenceDate: "2030-01-30" });
    assert.deepEqual({ pathname: location.pathname, search: location.search, hash: location.hash }, before);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("View task selects the exact existing task without a link; cancelled actions do not select", () => {
  const harness = navigationHarness();
  const html = harness.render({ section: "tasks", taskId: "exact-task-id", children: "View task" });
  assert.doesNotMatch(html, /href=/);
  harness.activate();
  assert.deepEqual(harness.selection, { section: "tasks", taskId: "exact-task-id" });
  harness.render({ section: "schedule", children: "Schedule Manager" });
  harness.activate({ defaultPrevented: true });
  assert.equal(harness.selection.taskId, "exact-task-id");
});
