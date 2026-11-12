import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StewartResponse from "@/app/e-learning/student/study-zone/_components/LectureBoard";
import { groupLearningSources } from "@/lib/stewart/learning-sources";
import type { ExplanationSource } from "@/services/e-learning/ai-ingest/client";
const live = JSON.parse(readFileSync("tests/fixtures/stewart/conflict-response.json", "utf8"));
const render = (text: string, sources: ExplanationSource[] = []) => renderToStaticMarkup(createElement(StewartResponse, { text, sources }));
const count = (s: string, term: string) => s.split(term).length - 1;

test("the actual EEE311 microservice answer renders once with hidden, grouped provenance", () => {
  const original = JSON.stringify(live);
  const html = render(live.answer, live.sources);
  assert.equal(count(html, "Imagine a student project group tasked with creating a presentation."), 1);
  assert.equal(count(html, "note 1.pdf"), 1, "repeated filename citations become one numbered reference");
  assert.match(html, /<details/); assert.ok(!html.includes('<details open'));
  assert.match(html, /View learning sources/);
  for (const internal of ["AI_GENERATED", "[AI-GENERATED EXAMPLE]", "fixture-conflict-lecture", "Class conflict: Conflict that occurs"]) assert.ok(!html.includes(internal), internal);
  assert.match(html, /provided materials do not offer a step-by-step process/);
  assert.equal(JSON.stringify(live), original, "rendering must preserve the raw answer and every source entry");
});
test("distinct examples survive, while an exactly repeated marked example is displayed once", () => {
  const examples = ["A student project group disagrees about its presentation.", "A workplace team disagrees about its schedule.", "A business team disagrees about its strategy."];
  const answer = examples.concat(examples[0]).map((e) => `[AI-GENERATED EXAMPLE]\n\n${e}`).join("\n\n");
  const html = render(answer);
  for (const example of examples) assert.equal(count(html, example), 1);
  assert.equal(count(html, ">Example</h3>"), 3);
});
test("unmarked duplicates of explicitly marked examples are removed without suppressing different scenarios", () => {
  const html = render("A project group argues about slides.\n\n[AI-GENERATED EXAMPLE]\nA project group argues about slides.\n\n[AI-GENERATED EXAMPLE]\nA project group argues about a deadline.");
  assert.equal(count(html, "A project group argues about slides."), 1);
  assert.equal(count(html, "A project group argues about a deadline."), 1);
});
test("Markdown headings, paragraphs, emphasis, nested lists, tables, quotes, code and links are semantic", () => {
  const html = render('# Main heading\n\n## Subheading\n\n### Detail\n\nA **bold** and *italic* paragraph.\n\n1. First\n2. Second\n   - Nested\n\n> A useful observation\n\n| Symbol | Value |\n| --- | --- |\n| R | 5 |\n\nUse `const x`:\n\n```js\nconst x = 1;\n```\n\n[Reference](https://example.com/notes)');
  for (const tag of ["h1", "h2", "h3", "strong", "em", "ol", "ul", "li", "blockquote", "table", "thead", "th", "td", "pre", "code", "a"]) assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Scrollable table"/);
});
test("inline/display math uses KaTeX and invalid expressions retain readable fallback", () => {
  const html = render('Ohm’s law: $V = IR$.\n\n$$\nI = \\frac{V}{R}\n$$');
  assert.match(html, /class="katex"/); assert.match(html, /class="katex-display"/); assert.match(html, /<math /); assert.match(html, /<mfrac>/);
  assert.doesNotThrow(() => render('$$\\notacommand{x}$$'));
});
test("plain and long answers are not truncated or forced into sections", () => {
  assert.match(render("A short definition."), /<p>A short definition\.<\/p>/);
  assert.ok(!render("A short definition.").includes("<h"));
  const text = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}: A complete explanation.`).join("\n\n") + "\n\nEND-OF-ANSWER";
  assert.match(render(text), /END-OF-ANSWER/);
});
test("raw HTML, executable links, remote image loads and trusted KaTeX commands cannot execute", () => {
  const html = render('<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![tracking](https://example.com/pixel)\n\n$\\href{javascript:alert(1)}{click}$');
  assert.ok(!html.includes("<script")); assert.ok(!html.includes("<img")); assert.ok(!html.includes('href="javascript:'));
  const code = render('```text\n[AI-GENERATED EXAMPLE]\n```');
  assert.match(code, /\[AI-GENERATED EXAMPLE\]/, "literal code is not treated as example metadata");
});
test("grouping retains all chunk metadata and distinguishes attachments, materials and generated provenance", () => {
  const sources: ExplanationSource[] = [
    { title: "Notes", document_id: "doc", chunk_preview: "one" }, { title: "Notes", document_id: "doc", chunk_preview: "two" },
    { title: "Screenshot.png", filename: "Screenshot.png", source_type: "attachment", attachment_id: "image", document_id: null },
    { title: "Example", source_type: "ai_generated", material_type: "AI_GENERATED", chunk_preview: "a duplicate body" },
  ];
  const grouped = groupLearningSources(sources);
  assert.equal(grouped.references.length, 2); assert.equal(grouped.references[0].entries.length, 2); assert.equal(grouped.references[1].kind, "attachment"); assert.equal(grouped.generatedExamples, true);
  const html = render("An answer.", sources);
  assert.equal(count(html, "Screenshot.png"), 1); assert.ok(!html.includes("a duplicate body"));
});
test("a trailing generated-example marker does not create an empty section", () => {
  const html = render("An explanation.\n\n[AI-GENERATED EXAMPLE]\n");
  assert.match(html, /An explanation\./); assert.ok(!html.includes("<h3"));
});
test("citations never rewrite code or ambiguous same-name documents", () => {
  const sources = [{ title: "notes.pdf", document_id: "first" }, { title: "notes.pdf", document_id: "second" }];
  const html = render("Explain (notes.pdf).\n\n`(notes.pdf)`", sources);
  assert.ok(html.includes("Explain (notes.pdf).")); assert.ok(html.includes("<code"));
});
test("formatted generated-example labels become human headings without exposing technical metadata", () => {
  const html = render("**[AI-GENERATED EXAMPLE]**\n\nA workplace team disagrees about its schedule.");
  assert.ok(!html.includes("AI-GENERATED")); assert.match(html, />Example<\/h3>/); assert.match(html, /workplace team/);
});
test("exact multi-paragraph and code example duplicates appear once, while distinct scenarios remain", () => {
  const example = "A student group disagrees about its slides.\n\nThey resolve it by trying both approaches.\n\n```text\nDiscuss, compare, decide.\n```";
  const html = render(`[AI-GENERATED EXAMPLE]\n\n${example}\n\n[AI-GENERATED EXAMPLE]\n\n${example}\n\n[AI-GENERATED EXAMPLE]\n\nA workplace group disagrees about its schedule.`);
  assert.equal(count(html, "A student group disagrees about its slides."), 1);
  assert.equal(count(html, "They resolve it by trying both approaches."), 1);
  assert.equal(count(html, "Discuss, compare, decide."), 1);
  assert.equal(count(html, "A workplace group disagrees about its schedule."), 1);
});
test("code indentation and distinct scenarios are never normalized into the same example", () => {
  const html = render('[AI-GENERATED EXAMPLE]\n\n```python\nif ready:\n    run()\n```\n\n[AI-GENERATED EXAMPLE]\n\n```python\nif ready:\nrun()\n```');
  assert.equal(count(html, "<pre"), 2);
});
test("real attachment/screenshot math and session follow-up responses render with preserved content", () => {
  for (const name of ["attachment-math", "attachment-followup"]) {
    const response = JSON.parse(readFileSync(`tests/fixtures/stewart/${name}-response.json`, "utf8"));
    const html = render(response.answer, response.sources);
    assert.match(html, /class="katex"/);
    assert.ok(!html.includes("chunk_preview"));
    assert.match(html, /View learning sources/);
    if (name === "attachment-math") { assert.match(html, /class="katex-display"/); assert.match(html, /<table/); assert.match(html, /Understanding Ohm/); }
  }
});
test("italicized and combined filename citations become numbered references without changing surrounding emphasis", () => {
  const sources: ExplanationSource[] = [{ title: "Notes.txt", document_id: "notes" }, { title: "Screenshot.png", source_type: "attachment", attachment_id: "image" }];
  const html = render("An *important* point (*Notes.txt*; *Screenshot.png*).\n\nAnother point (*Notes.txt*).", sources);
  assert.match(html, /<em>important<\/em>/);
  assert.equal(count(html, "Notes.txt"), 1); assert.equal(count(html, "Screenshot.png"), 1);
  assert.equal(count(html, ">[1]</a>"), 1); assert.equal(count(html, ">[2]</a>"), 1);
  assert.match(html, /Another point\./);
});
test("standalone same-line double-dollar equations from the live service render in display mode", () => {
  assert.match(render("$$V = IR$$"), /class="katex-display"/);
  assert.ok(!render("$V = IR$").includes('class="katex-display"'));
  assert.ok(!render("`$$V = IR$$`").includes('class="katex-display"'));
});
