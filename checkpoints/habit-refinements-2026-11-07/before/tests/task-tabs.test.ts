import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentProps, type KeyboardEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { TaskViewStatus } from "../src/features/tasks/domain.ts";

test("status tabs have accessible selected state, keyboard wraparound, focus movement and no URL updates", () => {
  const require = createRequire(import.meta.url), runtime = require("react/jsx-runtime");
  const buttons = new Map<string, ComponentProps<"button">>();
  let focused = "";
  const jsx = (type: unknown, props: ComponentProps<"button">, key: unknown) => {
    if (type === "button") {
      buttons.set(props.id!, props);
      if (typeof props.ref === "function") props.ref({ focus() { focused = props.id!; } } as HTMLButtonElement);
    }
    return runtime.jsx(type, props, key);
  };
  const source = readFileSync(new URL("../src/features/tasks/TaskStatusTabs.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((name: string) => name === "react/jsx-runtime" ? { ...runtime, jsx, jsxs: jsx } : require(name), exports);
  let status: TaskViewStatus = "active";
  const Tabs = exports.TaskStatusTabs as (props: { status: TaskViewStatus; counts: Record<TaskViewStatus, number>; onSelect: (value: TaskViewStatus) => void }) => ReturnType<typeof createElement>;
  const render = () => renderToStaticMarkup(createElement(Tabs, { status, counts: { active: 4, pending: 2, completed: 1, missed: 3 }, onSelect: value => { status = value; } }));
  const html = render();
  assert.match(html, /role="tablist"/);
  assert.match(html, /Active \(4\)/);
  assert.match(html, /Pending \(2\)/);
  assert.match(html, /Completed \(1\)/);
  assert.match(html, /Missed \(3\)/);
  assert.doesNotMatch(html, /href=/);
  assert.equal(buttons.get("task-tab-active")!["aria-selected"], true);
  assert.equal(buttons.get("task-tab-active")!.tabIndex, 0);
  assert.equal(buttons.get("task-tab-completed")!.tabIndex, -1);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const location = new URL("https://example.test/productivity?student=7#keep");
  const before = location.href;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  try {
    for (const [from, key, expected] of [["active", "ArrowLeft", "missed"], ["missed", "ArrowRight", "active"], ["active", "End", "missed"], ["missed", "Home", "active"], ["active", "ArrowRight", "pending"]] as const) {
      let prevented = false;
      buttons.get(`task-tab-${from}`)!.onKeyDown!({ key, preventDefault() { prevented = true; } } as KeyboardEvent<HTMLButtonElement>);
      assert.equal(prevented, true); assert.equal(status, expected); assert.equal(focused, `task-tab-${expected}`);
      render();
      assert.equal(buttons.get(`task-tab-${expected}`)!["aria-selected"], true);
    }
    assert.equal(location.href, before);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
