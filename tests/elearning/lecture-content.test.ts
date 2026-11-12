import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readEducationalContent } from "../../src/app/e-learning/student/study-zone/_components/lecture-content";
import StewartResponse from "../../src/app/e-learning/student/study-zone/_components/LectureBoard";
const render = (educational?: unknown, text = "Legacy **answer**") => renderToStaticMarkup(createElement(StewartResponse, { educational, text }));
test("legacy, unsupported and malformed replies retain safe text fallback", () => {
  for (const payload of [null, {}, { version: 1, type: "lecture_board" }, { version: 1, type: "unknown" }, { version: 1, type: "lecture_board", sections: [{ blocks: [{ kind: "table", columns: null, rows: [] }] }] }, { version: 1, type: "quiz", questions: [{ id: "q", kind: "multiple_choice", question: "?" }] }]) {
    assert.equal(readEducationalContent(payload), null); assert.match(render(payload), /<strong>answer<\/strong>/);
  }
  assert.ok(!render(undefined, '<script>alert(1)</script>').includes('<script>'));
});
test("supported response types and optional sections render without manufactured content", () => {
  for (const type of ["lecture_board", "quick_answer", "worked_example", "revision_notes", "quiz", "general_response"]) {
    const payload = { version: 1, type, text: "Short answer", examples: [{ problem: "Find x", steps: ["Given x = 2"], answer: "2" }] };
    assert.ok(readEducationalContent(payload)); assert.ok(render(payload));
  }
  assert.match(render({ version: 1, type: "worked_example", examples: [{ problem: "Find x", steps: ["Given x = 2"], answer: "2" }] }), /Given x = 2/);
});
test("unsafe illustrations and oversized or recursive math safely fall back", () => {
  assert.equal(readEducationalContent({ version: 1, type: "lecture_board", sections: [{ blocks: [{ kind: "image", url: "javascript:alert(1)", alt: "bad" }] }] }), null);
  const cycle = { kind: "root", children: [] as unknown[] }; cycle.children.push(cycle);
  assert.equal(readEducationalContent({ version: 1, type: "lecture_board", sections: [{ blocks: [{ kind: "equation", text: "x", math: cycle }] }] }), null);
});
