import { it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PipMarkdown } from "@/features/productivity/assistant/PipMarkdown";
import { PipWorking } from "@/features/productivity/assistant/PipWorking";
import { PipAvatar } from "@/features/productivity/assistant/PipAvatar";
it("renders persisted PIP Markdown with semantic headings, lists, tables, code and protected links", () => {
  const text = "## Tomorrow\n\n**Study** and *revise*.\n\n1. First\n2. Second\n\n- Parent\n  - Nested\n\n> Take a break\n\n| Time | Activity |\n| --- | --- |\n| 09:00 | Study |\n\n```js\nconst done = true;\n```\n\n[Reference](https://example.com)";
  const html = renderToStaticMarkup(<PipMarkdown text={text}/>);
  for (const tag of ["h2", "strong", "em", "ol", "ul", "blockquote", "table", "pre", "code"]) assert.match(html, new RegExp(`<${tag}(?:>| )`));
  assert.match(html, /rel="noopener noreferrer"/); assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /\*\*Study\*\*/);
});
it("does not execute model HTML, unsafe URL schemes or remote image requests", () => {
  const html = renderToStaticMarkup(<PipMarkdown text={'<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![tracking](https://example.com/pixel.png)\n\n<img src=x onerror=alert(1) />'}/>);
  assert.doesNotMatch(html, /<script|javascript:|<img|onerror=/);
  assert.match(renderToStaticMarkup(<PipAvatar/>), /aria-label="PIP robot"/);
});

it("announces one working status while decorative animation stays hidden from assistive technology", () => {
  const html = renderToStaticMarkup(<PipWorking/>);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /PIP is working on your request/);
  assert.match(html, /class="pip-working-dots" aria-hidden="true"/);
});
