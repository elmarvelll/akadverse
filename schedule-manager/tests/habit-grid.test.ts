import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { feedback, monthRange, outcome, type Habit, type Occurrence } from "../src/features/habits/domain.ts";
import { rangeDays } from "../src/features/analytics/periods.ts";
import { habitScheduleDescription } from "../src/features/habits/presentation.ts";

test("monthly calendar shows real dates and outcomes for the selected habit and opens exact occurrences", () => {
  const require = createRequire(import.meta.url), runtime = require("react/jsx-runtime");
  const controls: ComponentProps<"button">[] = [];
  const jsx = (type: unknown, props: ComponentProps<"button">, key: unknown) => { if (type === "button") controls.push(props); return runtime.jsx(type, props, key); };
  const source = readFileSync(new URL("../src/features/habits/HabitGrid.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((name: string) => name === "react/jsx-runtime" ? { ...runtime, jsx, jsxs: (type: unknown, props: ComponentProps<"button">, key: unknown) => { if (type === "button") controls.push(props); return runtime.jsxs(type, props, key); } } : name === "./domain" ? { outcome } : { formatDate: (date: string) => date }, exports);
  const settings = { name: "Reading", description: "", type: "task" as const, priority: "medium" as const, frequency: "daily" as const, weekdays: [], time: "18:00", effectiveDate: "2030-01-01", at: "2030-01-01T00:00:00Z", archived: false };
  const habit: Habit = { id: "habit", ownerId: "student", createdDate: "2030-01-01", createdAt: settings.at, timezone: "Africa/Lagos", revisions: [settings] };
  const dates = rangeDays(monthRange("2030-01-01"));
  const base: Occurrence = { habitId: habit.id, id: "occurrence-1", date: dates[0], settings };
  const task = { id: "task", ownerId: "student", source: { kind: "ordinary" as const }, title: "Reading", priority: "medium" as const, createdAt: settings.at, updatedAt: settings.at, history: [] };
  const occurrences: Occurrence[] = [{ ...base, task: { ...task, status: "completed", completedAt: settings.at } }, { ...base, id: "occurrence-2", date: dates[1], task: { ...task, status: "missed", missedAt: settings.at } }, { ...base, id: "occurrence-3", date: dates[2] }, { ...base, id: "occurrence-5", date: dates[4] }];
  occurrences.push({ ...base, id: "other-habit", habitId: "other-habit", task: { ...task, status: "missed", missedAt: settings.at } });
  const snapshot = structuredClone(occurrences);
  let selected = "";
  const Grid = exports.HabitGrid as (props: { habit: Habit; dates: string[]; occurrences: Occurrence[]; today: string; onOpen: (item: Occurrence) => void }) => ReturnType<typeof createElement>;
  const html = renderToStaticMarkup(createElement(Grid, { habit, dates, occurrences, today: dates[2], onOpen: (item: Occurrence) => { selected = item.id; } }));
  assert.match(html, /habit-calendar-completed/); assert.match(html, /habit-calendar-missed/); assert.match(html, /habit-calendar-unscheduled/); assert.match(html, /habit-calendar-unrecorded/);
  assert.match(html, /2030-01-04: Not scheduled/); assert.match(html, /2030-01-05: Planned, no outcome/);
  assert.equal(controls.length, 31);
  assert.equal((html.match(/class="habit-weekday"/g) || []).length, 7);
  assert.match(html, /aria-current="date"/);
  assert.match(html, /Reading, 2030-01-01: completed/);
  controls.find(button => button["aria-label"] === "Reading, 2030-01-02: missed")!.onClick!({} as never);
  assert.equal(selected, "occurrence-2");
  controls.find(button => button["aria-disabled"] === true)!.onClick!({} as never);
  assert.equal(selected, "occurrence-2");
  let target = "", focused = false, prevented = false;
  controls.find(button => button["aria-label"] === "Reading, 2030-01-01: completed")!.onKeyDown!({ key: "ArrowDown", preventDefault() { prevented = true; }, currentTarget: { closest: () => ({ querySelector: (selector: string) => { target = selector; return { focus() { focused = true; } }; } }) } } as never);
  assert.equal(target, '[data-day="7"]'); assert.equal(focused, true); assert.equal(prevented, true);
  for (const [index, key, expected] of [[0, "ArrowLeft", 0], [0, "Home", 0], [0, "End", 4], [30, "ArrowDown", 30], [30, "Home", 26]] as const) {
    controls[index].onKeyDown!({ key, preventDefault() {}, currentTarget: { closest: () => ({ querySelector: (selector: string) => { target = selector; return { focus() {} }; } }) } } as never);
    assert.equal(target, `[data-day="${expected}"]`);
  }
  assert.deepEqual(occurrences, snapshot);
  assert.doesNotMatch(html, /href=|<a\b/);
  for (const [month, length, offset] of [["2026-02-01", 28, 0], ["2028-02-01", 29, 2], ["2026-11-01", 30, 0], ["2026-08-01", 31, 6]] as const) {
    controls.length = 0;
    const result = renderToStaticMarkup(createElement(Grid, { habit, dates: rangeDays(monthRange(month)), occurrences: [], today: dates[2], onOpen() {} }));
    assert.equal(controls.length, length);
    assert.equal((result.split('data-day="0"')[0].match(/class="habit-calendar-blank"/g) || []).length, offset);
    assert.equal(((result.match(/class="habit-calendar-blank"/g) || []).length + length) % 7, 0);
  }
});

test("habit cards select the calendar independently of the accessible edit button", () => {
  const require = createRequire(import.meta.url), runtime = require("react/jsx-runtime");
  const controls: ComponentProps<"button">[] = [];
  const capture = (factory: typeof runtime.jsx) => (type: unknown, props: ComponentProps<"button">, key: unknown) => { if (type === "button") controls.push(props); return factory(type, props, key); };
  const source = readFileSync(new URL("../src/features/habits/HabitSummaryCards.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((name: string) => name === "react/jsx-runtime" ? { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) } : name === "./domain" ? { feedback } : name === "./presentation" ? { habitScheduleDescription } : { Icon: () => null }, exports);
  const settings = { name: "Reading", description: "", type: "task" as const, priority: "medium" as const, frequency: "daily" as const, weekdays: [], time: "", effectiveDate: "2030-01-01", at: "2030-01-01T00:00:00Z", archived: false };
  const habits: Habit[] = ["first", "second"].map(id => ({ id, ownerId: "student", createdDate: "2030-01-01", createdAt: settings.at, timezone: "Africa/Lagos", revisions: [{ ...settings, name: id }] }));
  let selected = "", opened = "";
  const props = { habits, occurrences: [], now: { date: "2030-01-03", time: "12:00" }, activeHabitId: "first", onSelect: (id: string) => { selected = id; }, onEdit: (id: string) => { opened = id; } };
  const Cards = exports.HabitSummaryCards as (input: typeof props) => ReturnType<typeof createElement>;
  const html = renderToStaticMarkup(createElement(Cards, props));
  assert.equal(controls.find(button => button["aria-label"] === "Show calendar for first")!["aria-pressed"], true);
  controls.find(button => button["aria-label"] === "Show calendar for second")!.onClick!({} as never);
  assert.equal(selected, "second"); assert.equal(opened, "");
  let stopped = false;
  const edit = controls.find(button => button["aria-label"] === "Edit habit: first")!;
  assert.equal(edit.title, "Edit habit: first");
  edit.onClick!({ stopPropagation() { stopped = true; } } as never);
  assert.equal(stopped, true);
  assert.equal(opened, "first"); assert.equal(selected, "second");
  assert.match(html, /No eligible occurrences/);
  assert.doesNotMatch(html, /streak/);
  for (const button of html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)) assert.doesNotMatch(button[1], /<button\b/);
});

test("recurrence descriptions use actual weekdays and existing local time format", () => {
  const settings = { name: "Read", description: "", type: "task" as const, priority: "medium" as const, frequency: "weekdays" as const, weekdays: [5, 1, 3], time: "20:00" };
  const before = structuredClone(settings);
  assert.equal(habitScheduleDescription(settings), "Mon, Wed, Fri · Due 20:00");
  assert.equal(habitScheduleDescription({ ...settings, type: "event", frequency: "daily", time: "18:00", end: "19:00" }), "Daily · 18:00–19:00");
  assert.equal(habitScheduleDescription({ ...settings, weekdays: [2, 4], time: "" }), "Tue, Thu");
  assert.equal(habitScheduleDescription({ ...settings, frequency: "daily", time: "00:00" }), "Daily · Due 00:00");
  assert.equal(habitScheduleDescription({ ...settings, frequency: "daily", time: "12:30" }), "Daily · Due 12:30");
  assert.deepEqual(settings, before);
});
