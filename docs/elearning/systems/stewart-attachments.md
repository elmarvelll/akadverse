# Stewart screenshots and supporting files

The Study Zone's existing Stewart client and authenticated APIs now handle both screenshots and supporting documents. No schema changes or additional AI service are required.

## Student workflow

Capture sits beside the existing open/download control. Drag within the document, release to capture, or cancel with Escape/Cancel. Tiny selections and cancelled pointers do not create files. Screenshots appear above the composer with a preview, actual filename, size, Remove and Retake. Add files allows multiple selections and additional batches. Files remain in browser memory until Send; neither picking a file nor taking a screenshot uploads it.

Send processes each new file through the existing multipart attachment endpoint, then submits the question, course/week/document context, conversation history and signed attachment references together. An attachment-only message asks Stewart to explain the materials. Failed sends retain files and the question; successful uploads are reused during retries. Submitted references remain available per document conversation and can be individually removed. Switching documents preserves each conversation's references and pending files.

## Rendering and capture

PDFs use the same authenticated document-access route, rendered with PDF.js rather than the opaque browser PDF iframe. Pages render lazily near the viewport, fit to the available width, and support zoom and scrolling. Captures composite the intersecting regions of ready canvases using their actual CSS-to-pixel scale. Unrendered pages cannot be captured silently. The existing open-in-new-tab control remains available for browser PDF search/printing.

Word and PowerPoint keep the existing Office readers. DOM capture rasterizes only intersecting document content, with the original geometry and computed styling; clipping is relative to the actual visible content after scrolling. The overlay is a sibling of the capture surface. Screenshot controls never enter the capture. Resizing cancels selection, and pointer capture supports dragging on touch devices. PNG captures use at least 2× resolution where practical, bounded to avoid excessive memory use.

PDF.js worker/font/CMap/WASM resources are served from an allowlisted public library-asset route. Deployment tracing includes those dependency assets. Private course files continue to use the existing authenticated access route and expiring URLs.

## Limits, processing and ownership

- Eight attachment references per chat request/conversation; 4 MiB per pending file, matching the existing serverless upload limit.
- PDF, DOC/DOCX, PPT/PPTX, TXT/MD, PNG, JPG/JPEG and WebP.
- Server checks extension and bytes. Images are decoded with a pixel limit and normalized to PNG, not trusted from MIME declarations. Legacy Office files must have a valid compound-file signature; PowerPoint record traversal is bounded. Existing bounded OOXML extraction remains in use.
- PDFs and images use provider file references in document/vision blocks. Office documents are extracted to text. Text truncation is disclosed to Stewart and returned in attachment metadata.
- Existing upload/chat rate limits, student authentication, course-registration access checks, HMAC-signed user-bound handles and provider error handling remain in force. Request streams are bounded even without Content-Length.
- Files expire after six hours. References and conversation history use the existing page-visit state, not database persistence. Leaving the page triggers best-effort deletion; expiry remains the fallback. Object URLs for previews are revoked on removal/unmount.
- Only relevant material should inform the answer; unclear image details should lead to clarification. Attachment contents are untrusted reference data, not instructions.

## Validation

`node --import tsx --experimental-test-module-mocks --test tests/elearning/stewart-document-chat.test.ts tests/elearning/stewart-http.test.ts` checks 31 cases covering bounded HTTP bodies, the PDF asset allowlist, extraction, limits, signed ownership/expiry, mixed image/document requests, prompt caching, follow-up references and provider failures with a recording provider fake.

`BROWSER_MODULE_DIR=<directory containing playwright-core> node --import tsx scripts/verify-stewart-capture.ts` bundles the production components into a temporary fixture server and runs real Chrome. It checks Office cropping after scrolling, Escape, pending files without uploads, retry without re-upload, mixed submission, follow-up references, the repository's real Engineering-CCMAS PDF, retake/cancel, mobile overflow, touch dragging and pointer cancellation. It uses fixture HTTP endpoints, not live student accounts or a live AI provider. `--office-only` skips the PDF portion when diagnosing PDF setup.

## Practical limits

Conversation references last for the page visit and provider expiry, matching existing persistence. Reloading does not restore a chat. Office screenshots reflect the existing Office reader's rendering fidelity; extracted Office text omits embedded diagrams, which students can capture separately. Encrypted, corrupt or image-only Office files may require export as PDF. DOM capture relies on modern browser SVG/foreignObject support. PDF text search/printing remain available through the existing open-in-new-tab action.

## Changed implementation files

| Area | Files |
| --- | --- |
| Viewer and shared workspace | `StudyWorkspace.tsx`, `DocumentViewer.tsx`, `viewers/PdfViewer.tsx`, new `capture-region.ts` under `src/app/e-learning/student/study-zone/_components/` |
| Composer and browser requests | `StewartPanel.tsx`, `stewart.ts` in the same components directory |
| Shared limits and file types | `src/lib/stewart/config.ts` |
| Existing AI pipeline | `services/e-learning/student/stewart/chat.ts`, `upload-attachment.ts`, new `legacy-office.ts` |
| Existing authenticated endpoints | `src/app/api/e-learning/stewart/chat/route.ts`, `attachments/route.ts`, `shared.ts` |
| PDF.js assets and deployment | New `src/app/api/e-learning/pdfjs/[...asset]/route.ts`, `next.config.ts` |
| Dependencies/types | `package.json`, `package-lock.json`, new `src/types/word-extractor.d.ts` |
| Tests | `tests/elearning/stewart-document-chat.test.ts`, new `stewart-http.test.ts`, `tests/helpers/stewart-browser-harness.tsx`, `scripts/verify-stewart-capture.ts` |

The chat JSON API accepts `attachments: string[]`; the original single `attachment` token remains supported. The attachment endpoint keeps its existing one-file multipart contract so each upload stays within the host's request limit. No tables, migrations, course-material storage changes, or new AI credentials are introduced.

## Verification result

All 31 tutor/HTTP tests pass. The Chrome workflow checks pass on desktop and mobile, including real PDF pixels, Office scrolling, invalid selections, touch dragging and pointer cancellation. TypeScript and repository lint pass (seven pre-existing unused-variable warnings). AI responses are simulated in these checks; live provider answer quality is not asserted.

A full production build remains blocked: Turbopack encountered Google Fonts connectivity and a CSS worker port restriction; the webpack fallback compiled successfully and passed TypeScript, then failed collecting the existing document-access route because the existing `src/lib/db/elearning.ts` native `createRequire` loader is incompatible with that webpack build. The database loader was left unchanged. These build failures are separate from the passing component/browser and tutor API tests.
