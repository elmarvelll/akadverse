# Stewart lecture presentation and Study Mode

> **11 November 2026:** Saved conversations, messages, independent sessions, retry safety, history selection and the simple welcome state are now implemented. See [persistent conversation contracts and rollout](stewart-conversations.md). Unsent drafts and unuploaded files still live only in the current browser visit.

This feature changes the frontend only. Existing AI routes, system prompts, uploads, ingestion, storage, and explanation requests are unchanged.

## Current response and integration dependency

The current `/api/e-learning/stewart/chat` response is `{ reply: string, truncated: boolean, sources?: ... }`. It does **not** supply structured lecture data. The browser continues to consume this contract. There is no JSON extraction from ordinary replies, inferred teaching structure, or automatic conversion into a lecture.

`StewartMessage.educational?: unknown` is a **proposed local presentation slot**, not an agreed API field. The AI/backend engineer must agree a versioned structured format and map validated response data to this slot when that integration is implemented. `askStewart` intentionally does not consume a new wire field. Its existing `reply` must remain available as the accessible fallback and conversation-history text. Do not stringify the presentation object into the conversation history.

The proposed TypeScript interface and bounded runtime validator are in `lecture-content.ts` beside the Study Zone components. For example:

```json
{
  "version": 1,
  "type": "lecture_board",
  "title": "Ohm's law",
  "course": "ENG101",
  "topic": "Circuits",
  "description": "Voltage, resistance and current",
  "objectives": ["Identify the relationship between voltage and current"],
  "introduction": "A resistor relates voltage to current.",
  "bigIdea": "V = IR",
  "sections": [{
    "heading": "Current",
    "blocks": [
      { "kind": "definition", "title": "Current", "text": "Rate of charge flow." },
      { "kind": "equation", "text": "I equals V divided by R", "math": {
        "kind": "row", "children": ["I = ", { "kind": "fraction", "children": ["V", "R"] }]
      } },
      { "kind": "table", "columns": ["Voltage", "Current"], "rows": [["10 V", "2 A"]] }
    ]
  }],
  "examples": [{ "problem": "Find current for 10 V and 5 ohms", "given": "V = 10 V, R = 5 Ω", "required": "Current", "principle": "I = V/R", "steps": ["Substitute: I = 10/5"], "answer": "2 A", "explanation": "Current through the resistor." }],
  "takeaways": ["Current increases with voltage at fixed resistance"],
  "questions": [{ "id": "q1", "kind": "true_false", "question": "At fixed resistance, doubling voltage doubles current." }]
}
```

All sections are optional. `sections[].blocks` accepts text, definition, note, example, analogy, equation, table, and HTTPS image blocks with required alt text and optional captions. Supplied diagram images cover flowcharts, circuits, and concept maps; arbitrary HTML, SVG markup, and executable diagram languages are not accepted. Image URLs must be browser-accessible; signed URL renewal requires the eventual integration's policy.

Equations accept readable `text` plus optional native MathML data: string leaves and `row`, `fraction`, `superscript`, `subscript`, `root` nodes. Fraction and scripts take two children; root takes one. This safely renders supplied notation without a dependency or raw HTML. Arbitrary LaTeX is not interpreted; integrations must supply this math tree or readable notation. Examples render supplied text and steps without calculating anything.

Types: `lecture_board`, `worked_example`, `revision_notes`, and `quiz` use the shared modular board, rendering only supplied sections. `quick_answer` uses compact text. `general_response`, legacy messages, unsupported versions, and invalid payloads use the reply fallback. Ordinary replies support a small safe Markdown subset (headings, bold, inline code, fenced code); other Markdown remains readable text. No Markdown or math library existed previously. Raw HTML is escaped.

Questions support multiple choice (`options: string[]`), true/false, and short answers. Selections stay in component state. “Discuss answer with Stewart” uses the existing send action and existing chat limits; the frontend never scores answers or creates assessments.

## Workspace and state

Study Mode sits alongside the viewer's existing capture and open/download actions. A workspace-header entry also works when a week has no document. Leave Study Mode or Escape returns to the normal layout. The root changes layout without moving or replacing the chat or viewer in the React tree. Per-document conversation history, unsent drafts, pending attachments, selected week/document and ongoing requests retain their existing state. State remains scoped to this page visit, as before.

Desktop uses a viewport workspace with independently scrolling viewer and chat. The divider uses pointer capture for mouse/touch, with bounded widths; arrow keys adjust it and Home/End select limits. Below 768px, Notes and Stewart buttons switch visibility while both components remain mounted. Body scrolling is restored on exit, focus returns to the entry control, and surrounding application siblings are inert while the workspace is open.

The left panel reuses the existing course PDF/DOCX/PPTX viewer and document selector. Chat attachments retain their existing previews and upload handling in Stewart. They do not become course documents and are not opened in the left viewer; supporting full previews for arbitrary private chat attachments requires a separate agreed preview/access design. The empty state explains week selection and Add files. Existing PDF text-selection capability is unchanged.

Add files is now a compact row above the full-width textarea/send row. File selection, validation, preview, upload retry, capture, retake, deletion and conversation tokens use the existing implementation.

## Verification

- `node --import tsx --test tests/elearning/lecture-content.test.ts`
- `npx tsc --noEmit`
- Targeted ESLint on changed frontend, tests and browser script.
- `BROWSER_MODULE_DIR=<directory containing playwright-core> node --import tsx scripts/verify-stewart-study.ts`: Chrome fixture integration checks for workspace, draft/history preservation, submission, document switching, mobile switching, resizing, composer and structured rendering. No live AI/database calls.
- Existing `scripts/verify-stewart-capture.ts`: screenshot/upload/retry/source regression checks against fixtures.

Live AI structured output cannot be tested until its contract and mapping are supplied. Full arbitrary LaTeX, interactive diagram engines, AI grading, and new attachment document viewers are outside this implementation.

Verified on 7 November 2026: the three lesson-format tests pass; TypeScript and targeted ESLint pass. Chrome workspace checks pass, including empty-week entry/exit and return to a previously selected document's draft/history. Existing Chrome capture checks pass for Office/PDF crops, screenshots, local/mixed files, upload failure/retry, grounding/sources, retake/cancel, mobile layout, touch drag and pointer cancellation. A desktop Study Mode screenshot was visually reviewed. These are fixture-based frontend checks, not a live AI integration test.
