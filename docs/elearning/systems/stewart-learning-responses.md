# Stewart learning response presentation

The Study Zone renders Stewart answers as academic content with a readable width and vertical typography, rather than assistant message bubbles. Student questions retain their compact composer history styling. Follow-ups, request/session handling, Study Mode, uploads, screenshot capture, retries and loading/error behavior use the existing implementation.

## Microservice contract and AI engineer handoff

The existing normal response contract remains `{answer: string, sources: [...], retrieval_info?: {...}}`. The backend returns it through the existing `{reply, sources, retrieval_info?, session_id, truncated}` wrapper. No new microservice field is required. Normal `answer` text remains unchanged in backend mapping; raw sources are not replaced with grouped presentation data.

The AI engineer can return ordinary CommonMark/GFM in `answer`: headings, paragraphs, emphasis, ordered/nested lists, tables, blockquotes, fenced code, inline code and HTTP(S) links. Use `$...$` for inline math and `$$...$$` on separate lines for display math. Return source metadata separately, including `source_type="ai_generated"` where applicable. Do not append source previews to `answer` or duplicate an example as a separate source-derived answer section. JSX, HTML, CSS and a new structured JSON envelope are unnecessary.

The actual current README and live EEE311 responses support this existing contract. No message has been sent to an AI engineer and no future schema change is assumed. If a new contract is proposed, coordinate it explicitly before adopting it. The legacy optional `educational` lecture-board payload remains supported for existing consumers; the microservice is not assumed to emit it.

Grounding retains its existing five actual explanation fields. The shared backend adapter now assembles these as Markdown section headings instead of flat labels and includes an exactly repeated `example`/`worked_problem` field once. Distinct examples remain. No generation prompt, retrieval rule, provider or microservice source code was changed.

## Rendering

`LearningMarkdown.tsx` uses `react-markdown`, `remark-gfm`, `remark-math` and `rehype-katex`. The course Study Zone page imports KaTeX's stylesheet. Semantic headings, lists, tables, quotes and code blocks use scoped typography. Wide tables, code and display math scroll inside the answer; long words wrap. Short plain text still renders as a normal paragraph without manufactured sections. Answers are not truncated by the renderer.

Raw HTML is skipped, links are limited to credential-free HTTP(S) or local citation anchors, external links use noopener/noreferrer, and KaTeX trust is disabled with expansion/size bounds. Markdown images render alt text instead of initiating arbitrary image requests; existing uploaded image/screenshot previews remain in the authorized attachment workflow. KaTeX errors retain a readable fallback.

## Generated examples

The old duplication was caused by displaying both the example inside `answer` and its `ai_generated` source preview. `LearningSources.tsx` never displays chunk previews or appends source text to the explanation. Generated source entries become a quiet provenance notice inside the closed reference section.

A Markdown AST presentation pass converts a standalone `[AI-GENERATED EXAMPLE]` marker into the human heading “Example,” dropping an orphan trailing marker. It removes only exactly repeated blocks within an explicitly marked example section, comparing their structure/text with normalized prose whitespace. Code indentation and math values remain exact. A section ends at the next ordinary heading; unique text is always retained. Different scenarios remain, even when they explain the same concept. Ordinary repeated paragraphs are not globally deduplicated. Code/math are not rewritten as example labels. Multi-paragraph and code examples are handled without similarity heuristics.

All these changes are presentation-only; the HTTP answer and source metadata remain available unchanged for debugging/history.

## Learning sources

Each explanation has a closed native details section, “View learning sources.” Source chunks group by actual document ID, attachment ID, or external URL; the backend still returns every authorized chunk entry. Display uses a single document/file title and a human provenance label, without document IDs, raw chunk previews, storage locations or internal enums. Generated examples stay internally distinct from uploaded files and lecturer material.

Only standalone parenthetical citations exactly matching known source filenames/titles become a numeric link to the grouped references. Repeated citations to the same source appear once. Ordinary prose mentions, unknown citations, code and ambiguous filenames shared by different documents are left intact. Activating a numeric citation opens its reference disclosure.

## Verification

- `tests/elearning/stewart-learning-response.test.ts` covers the recorded real EEE311 response, exact duplicates, distinct examples, semantic Markdown, KaTeX, plain/long answers, source grouping, source preservation and unsafe input.
- Existing route tests verify raw Markdown pass-through, unchanged sessions/retrieval metadata and Markdown assembly for grounding.
- `scripts/verify-stewart-learning.ts` runs production composer/renderer components in Chrome. It uses recorded live responses when `/tmp/stewart-live-{definition,structured,followup}.json` exists and explicit formatting fixtures otherwise. It tests desktop/tablet/mobile typography, long responses, references, Markdown/math and a screenshot plus document question, saving `/tmp/stewart-learning-{desktop,mobile}.png` and the actual captured `/tmp/stewart-learning-capture.png`.
- Existing capture, Study Mode and browser-to-real-backend attachment scripts remain regression checks. Their reference assertions now deliberately open disclosures; raw previews are no longer expected.

Run the normal `npm test` and TypeScript/ESLint checks. For browser verification, set `BROWSER_MODULE_DIR` to a directory containing `playwright-core`, then run `node --import tsx scripts/verify-stewart-learning.ts`. Browser scripts use installed Chrome on macOS and temporary local fixture servers. Live service output tests do not establish production deployment or universal model formatting compliance.

### Recorded results, 10 November 2026

- Full repository suite: **198 passed, 0 failed**. TypeScript, targeted ESLint and diff checks passed.
- Learning-response Chrome suite passed with recorded real definition, detailed explanation, multiple examples, session follow-up, screenshot/math and attachment follow-up responses. It also checked explicit duplicate/error fixtures and desktop/tablet/mobile overflow.
- Existing Study Mode, screenshot/capture/mobile and browser → actual backend → local database → HTTP service fixture suites passed. Source disclosures were opened explicitly for reference assertions.
- Live service verification returned 200 for the EEE311 definition, structured conflict answer and same-session follow-up. A captured equation PNG and notes TXT both uploaded with 200; the math/table explanation and follow-up returned 200 with both attachment sources. Cleanup returned 204 for both files.
- Live verification encountered transient connection timeouts/resets before succeeding over IPv4. No production transport settings were changed by this presentation task.

The live service emitted some standalone same-line `$$equation$$` blocks. The Markdown AST pass marks these for display rendering without changing their math values or the backend answer. Standard single-dollar inline math and code literals retain their original meaning. Citations also support emphasized filenames and semicolon-separated references without exposing repeated filenames or source previews.

No production deployment or production build success is claimed. AI generation instructions and future schema changes remain owned by the AI engineer; the current `{answer,sources,retrieval_info}` contract already supports this renderer.
