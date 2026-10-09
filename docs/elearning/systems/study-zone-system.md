# System: Study Zone

## Purpose

A focused reading workspace for students: pick a registered course, move through its weeks as document tabs, read that week's material, and have **Stewart** (the AI study assistant) beside it. Added 2026-10-02 as a **frontend** feature. Courses, weeks and documents are real data; Stewart is a **mock** and is not connected to any AI service.

## Actors

Student only (`requireElearningRole(["student"])` + `requireStudentProfile` on both pages).

## Routes

| Route | What it shows |
|---|---|
| `/e-learning/student/study-zone` | "Welcome to Study Zone / What would you like to study?" and the student's registered courses as cards. Empty states: no academic context; no approved registration (links to Course Registration). |
| `/e-learning/student/study-zone/[courseId]` | The study workspace: week tabs → one document viewer, with Stewart beside it. 404 unless the course is in the student's **APPROVED** registration for the current session/semester. A course with no offering yet (no lecturer assigned) shows "This course has no study materials yet". |

The sidebar's **Study Zone** entry (`nav-config.ts`) is a direct link with `activeOnSubpaths`, so it stays highlighted inside a course's workspace.

## Data (the UI/data boundary)

`services/e-learning/student/study-zone.ts` is the only data source. It reuses the same queries as My Learning — `getRegisteredCourses` and `shared/offering-detail.ts#getOfferingDetail` — and maps them to plain types the UI depends on:

- `StudyCourse` — code, title, level, units, type, lecturer, session/semester.
- `StudyWeek` — `weekNumber`, `topic` (the week's main document title; weeks have no titles of their own), `documents`.
- `StudyDocument` — id, title, category (Notes/Assignment/Quiz), `kind` (`pdf | pptx | docx | other`, from the stored MIME type), file name/size, week range label.

Week count comes from the semester's dates (as on My Learning). A multi-week document appears in every week it covers. To move this behind an API later (`GET courses`, `GET course/:id/weeks`, …) replace this file's two functions; the components only see the types.

## Components (`src/app/e-learning/student/study-zone/_components/`)

| File | Role |
|---|---|
| `BackToStudyZone.tsx` | The button-style back control (workspace and the no-materials page). |
| `StudyWorkspace.tsx` | Owns the selected week (default: first week with material) and, when a week has several documents, the selected document. Drives the tabs, the single viewer and Stewart's context. |
| `WeekTabs.tsx` | Document-style tabs; ARIA `tablist` with arrow keys / Home / End and a roving tab index. Empty weeks are shown, labelled "No material". |
| `DocumentViewer.tsx` | One document at a time — keyed by document id, so switching unmounts the previous viewer. The toolbar (title, type, open/download, full screen) plus `VIEWERS`, which picks the format's viewer below. ZIP is download-only. |
| `viewers/PdfViewer.tsx` | **PDF** — the actual file in the browser's built-in PDF viewer (page navigation, zoom, search, internal scrolling), from a signed URL, opened `#navpanes=0&view=FitH`. No PDF library. Phone browsers that can't show a PDF in a page (notably Android Chrome) use the toolbar's open-in-new-tab. |
| `viewers/PowerPointViewer.tsx` + `office/pptx.ts` | **PPTX** — the actual slides, drawn from the file: positioned text with its real sizes, colours, fonts, alignment, bullets/numbering and autofit; lines, shape fills/borders, pictures, tables, backgrounds and speaker notes. Formatting follows slide → layout → master → theme. Sizes are container-query units of the slide's width, so slides scale with the panel. Slides scroll with a "Slide n of N" bar. Because the deck's fonts are usually not installed, a text box whose *visible* text would leave the slide is shrunk just enough to stay on it (as PowerPoint's shrink-on-overflow). Not drawn: animations, charts, SmartArt, gradients beyond their first colour, non-rectangular outlines. |
| `viewers/WordViewer.tsx` + `office/docx.ts` | **DOCX** — the actual document as a page: title/headings (style names and outline levels), paragraph alignment, bold/italic/underline/strike/colour/size, numbered (incl. nested a), i.)) and bulleted lists, tables and inline pictures, following Word's style chain. Not drawn: headers/footers, footnotes, text boxes, columns. |
| `office/zip.ts`, `office/ooxml.ts`, `office/document-access.ts`, `office/useOfficeDocument.ts` | Zero-dependency Office reading: a ZIP reader on the browser's `DecompressionStream`, shared XML/relationship/colour helpers, the access-route fetch, and the fetch-parse hook (cancellation, retry, blob-URL cleanup). |
| `viewers/ViewerStates.tsx` | Shared loading skeleton, empty and error-with-retry states. |
| `StewartPanel.tsx` | Chat UI: header with "Studying: Week N · <document>", conversation log, suggestions, typing state, input (Enter sends, Shift+Enter new line). One conversation per week+document, kept while switching. |
| `stewart.ts` | **Mock client.** `startThread` (greeting + short example exchange) and `askStewart` (canned reply after a delay). No network request. Replacing these two functions connects the real assistant. |

## Document access

Viewing uses the existing `GET /api/e-learning/documents/[id]/access` route (same authorization, same 60-second signed URL). It gained one optional parameter: **`?inline=1`** returns a URL without Supabase's `download=` parameter, so the browser displays a PDF instead of saving it. Without the parameter the behavior is unchanged (`DocumentLink` on My Learning / My Subjects still downloads).

## Layout

The document is the primary surface; everything is sized from the space actually available.

- **Width follows the sidebar.** The workspace root is a CSS container (`@container`), so the split depends on the *content area's* width, not the viewport's — collapsing the sidebar (see [`layout-and-navigation.md`](layout-and-navigation.md)) can switch a stacked layout to side by side. From a 56rem container: document | Stewart, Stewart 18rem (22rem from 72rem), the document ~70–75%. Narrower: stacked, document first.
- **Height follows the viewport.** The document column is `100dvh` minus the app header (4rem), `<main>`'s vertical padding, the one-row course header (`h-9`) and the gap — so side by side the page itself never scrolls; the PDF scrolls inside its viewer and the conversation inside Stewart.
- Compact chrome: one-row course header (button-style **Back to Study Zone**, icon-only on phones; `code — title` at `text-base`), two-line week tabs, one-row document toolbar.
- Measured in Chrome (1440×900, sidebar expanded): PDF 834×634px, page scroll 0; collapsing the sidebar widens it to 962px. 1024×768 stacks with the sidebar expanded and goes side by side when collapsed. 375/768px: stacked, no horizontal scroll.
- The workspace root is `isolate`: the active tab's small `z-index` can't compete with the shell's header, sidebar or drawer.

## Not implemented (deliberately)

- Any AI: no LLM call, RAG, embeddings, vector store, or document ingestion. Stewart's replies are canned and say so ("Preview" badge + footnote).
- Pixel-perfect PowerPoint/Word fidelity: the readers above cover the common content; uninstalled fonts fall back to similar system fonts, and the features listed as not drawn are skipped.
- Persisting Stewart conversations (they live in component state for the page visit).
