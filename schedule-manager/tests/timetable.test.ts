import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactElement } from "react";
import ts from "typescript";
import * as timetable from "../src/features/schedule/timetable.ts";
import { emptyDataset, localNow, type PersonalEvent } from "../src/features/schedule/domain.ts";

const entry = (id: string, start: string, end: string, date = "2030-01-06", kind: timetable.TimetableEntry["kind"] = "personal"): timetable.TimetableEntry => ({ id, title: id, slot: { date, start, end, timezone: "Africa/Lagos" }, kind, category: "Personal" });

test("midnight, early habit, noon and late-night events use the full day without overflowing midnight", () => {
  const rows = timetable.placeTimetable([entry("midnight", "00:00", "01:00"), entry("early", "04:00", "05:00", undefined, "habit"), entry("noon", "12:00", "13:00"), entry("late", "23:00", "00:00"), entry("last-minute", "23:59", "00:00", undefined, "habit")]);
  assert.deepEqual(rows.map(row => [row.startMinute, row.endMinute]), [[0, 60], [240, 300], [720, 780], [1380, 1440], [1439, 1440]]);
  assert.equal(timetable.DAY_HEIGHT, 1728);
  for (const row of rows) {
    const geometry = timetable.timetableEventGeometry(row.startMinute, row.endMinute);
    assert.ok(geometry.top >= row.startMinute / 60 * 72);
    assert.ok(geometry.height > 0);
    assert.ok(geometry.top + geometry.height <= 1728);
  }
  assert.deepEqual(timetable.timetableEventGeometry(720, 780), { top: 866, height: 68 });
});

test("overnight portions cross week/year boundaries, preserve source identity and overlap independently", () => {
  for (const kind of ["personal", "habit", "academic"] as const) {
    const source = entry("overnight", "23:30", "01:00", "2029-12-31", kind);
    const entries = [source, entry("after", "00:30", "02:00", "2030-01-01"), entry("adjacent", "02:00", "03:00", "2030-01-01")];
    const snapshot = structuredClone(entries);
    const rows = timetable.placeTimetable([...entries, source]);
    const portions = rows.filter(row => row.id === source.id);
    assert.deepEqual(portions.map(row => [row.displayDate, row.startMinute, row.endMinute, row.columns]), [["2029-12-31", 1410, 1440, 1], ["2030-01-01", 0, 60, 2]]);
    assert.ok(portions.every(row => row.slot === source.slot && row.kind === kind));
    assert.equal(rows.find(row => row.id === "after")!.column, 1);
    assert.equal(rows.find(row => row.id === "adjacent")!.columns, 1);
    assert.deepEqual(entries, snapshot);
  }
  assert.equal(timetable.placeTimetable([entry("end-midnight", "23:00", "00:00")]).length, 1);
  assert.equal(timetable.placeTimetable([entry("zero", "00:00", "00:00")]).length, 0);
});

test("a day or week includes previous-date continuations while retaining ownership, category, archive and focus filters", () => {
  const data = emptyDataset();
  const base: PersonalEvent = { ...entry("overnight", "23:30", "01:00"), ownerId: "student", description: "", priority: "medium", subScheduleId: "category", originalSlot: entry("", "23:30", "01:00").slot, mustComplete: true, focusDate: "2030-01-06", status: "pending", source: { kind: "habit", habitId: "habit", occurrenceId: "occurrence" }, createdAt: "2030-01-01T00:00:00Z", updatedAt: "2030-01-01T00:00:00Z", history: [] };
  data.events = [base, { ...base, id: "other-owner", ownerId: "other" }, { ...base, id: "other-category", subScheduleId: "other" }, { ...base, id: "archived", archivedAt: base.createdAt }, { ...base, id: "ended", slot: { ...base.slot, end: "00:00" } }];
  const snapshot = JSON.stringify(data);
  for (const view of ["day", "week"] as const) {
    const dates = timetable.scheduleDates("2030-01-07", view);
    const selected = timetable.selectTimetableEvents(data, "student", dates, { scheduleId: "category", focus: true });
    assert.deepEqual(selected.map(row => row.id), ["overnight"]);
    assert.equal(selected[0], base);
    assert.equal(timetable.timetableSourceDates(dates)[0], "2030-01-06");
  }
  assert.equal(JSON.stringify(data), snapshot);
});

test("initial scroll uses student-local current time or 6 a.m. for other dates", () => {
  const now = localNow("Africa/Lagos", new Date("2030-01-06T23:30:00Z"));
  assert.equal(now.date, "2030-01-07");
  assert.equal(timetable.initialTimetableScroll([now.date], now.date, now.time), 0);
  assert.equal(timetable.initialTimetableScroll([now.date], now.date, "12:30"), 828);
  assert.equal(timetable.initialTimetableScroll(["2030-01-06"], now.date, "12:30"), 432);
});

test("actual day/week grid renders all hours, opens original overnight slots and does not reset scrolling on refresh", () => {
  const require = createRequire(import.meta.url), runtime = require("react/jsx-runtime");
  const buttons: ComponentProps<"button">[] = [];
  const container = { scrollTop: 0 };
  const refs: { current: unknown }[] = [];
  let hook = 0;
  const effects: (() => void)[] = [];
  const capture = (factory: typeof runtime.jsx) => (type: unknown, props: ComponentProps<"button">, key: unknown) => { if (type === "button") buttons.push(props); return factory(type, props, key); };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/features/schedule/ScheduleTimetable.tsx", import.meta.url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((name: string) => {
    if (name === "react/jsx-runtime") return { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) };
    if (name === "react") return { useRef: (value: unknown) => refs[hook++] ||= { current: value === null ? container : value }, useEffect: (effect: () => void) => effects.push(effect) };
    if (name === "./timetable") return timetable;
    return { Icon: () => null, HabitBadge: () => null };
  }, exports);
  type Props = { entries: timetable.TimetableEntry[]; dates: string[]; today: string; currentTime: string; selectedDate: string; conflicts: Map<string, unknown[]>; onDate: (date: string) => void; onOpen: (entry: timetable.TimetableEntry) => void };
  const Grid = exports.Timetable as (props: Props) => ReactElement;
  let opened: timetable.TimetableEntry | undefined, selected = "";
  const props: Props = { entries: [], dates: ["2030-01-07"], today: "2030-01-07", currentTime: "12:30", selectedDate: "2030-01-07", conflicts: new Map(), onDate: date => { selected = date; }, onOpen: item => { opened = item; } };
  const render = () => { hook = 0; buttons.length = 0; const html = renderToStaticMarkup(Grid(props)); effects.splice(0).forEach(effect => effect()); return html; };
  const html = render();
  assert.equal(container.scrollTop, 828); // Empty views initialize too.
  for (const hour of timetable.timetableHours) assert.ok(html.includes(`${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`));
  assert.match(html, /height:1728px/);
  assert.doesNotMatch(html, /summary-card|Complete|Mark missed/);
  container.scrollTop = 157;
  const overnight = entry("overnight", "23:30", "01:00", "2030-01-06", "habit");
  props.entries = [overnight]; props.currentTime = "12:31";
  render();
  assert.equal(container.scrollTop, 157);
  buttons.find(button => String(button["aria-label"]).startsWith("overnight, 2030-01-07, 00:00 to 01:00"))!.onClick!({} as never);
  assert.equal(opened!.id, overnight.id); assert.equal(opened!.slot, overnight.slot);
  buttons.find(button => button.className?.includes("timetable-day-head"))!.onClick!({} as never);
  assert.equal(selected, "2030-01-07");
  props.dates = timetable.scheduleDates("2030-01-07", "week");
  render(); assert.ok(Math.abs(container.scrollTop - 829.2) < 0.001);
  container.scrollTop = 600; props.selectedDate = "2030-01-08";
  render(); assert.equal(container.scrollTop, 600);
  props.dates = ["2030-01-08"];
  render(); assert.equal(container.scrollTop, 432);
});
