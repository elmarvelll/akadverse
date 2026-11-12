# Stewart attachments and screenshots

Implemented 10 November 2026 against the current Concept Explainer README supplied by the user (`Downloads/README.md`, Phases 3.5a–3.5c and 4a). The older sibling `Concept Explainer` checkout is a different, outdated implementation. No microservice source or API was changed.

## Student workflow

Add files accepts multiple PDF, DOCX, PPTX, TXT, Markdown, PNG, JPEG and WEBP files. Legacy DOC/PPT files are rejected because the service does not support them. Each file must be nonempty and at most **4 MiB**. Eight active references, including screenshots and references retained for follow-up questions, can be used together. Duplicate local selections are ignored; invalid selections receive an error.

Capture retains the existing pointer selection/cancellation and document-only cropping. PDF crops use rendered PDF.js canvases; Office crops use the existing document DOM capture. Overlays and controls remain outside the capture surface. Screenshots use `canvas.toBlob()` and actual PNG Files. Oversized captures reduce oversampling, never below one pixel per selected CSS pixel; if still too large, the student must select a smaller region. A confirmation preview supports Attach screenshot or Cancel. Confirmed screenshots enter the same pending file queue as ordinary images.

Files stay local until Send or an explicit failed-file Retry. Compact previews show filename, type, size, local/uploading/uploaded/failed status, error and removal controls. Send uploads each new file separately. A failed file does not stop the other uploads; successful references are cached and only failed files need retrying. No explanation is sent until every required file has uploaded. A failed explanation retains the question, local files and confirmed upload references. Student messages retain their submitted filenames/image previews.

## Browser → AkadVerse contract

Existing endpoints are extended; there is no screenshot-specific AI endpoint.

### POST /api/e-learning/stewart/attachments

Multipart fields: `file` (exactly one), `courseId`, `weekNumber`, optional `documentId`. The course/week/document uses the same context as chat. Multiple selected files produce multiple requests, each with an independent success/error result.

```json
{
  "success": true,
  "session_id": "server-scoped-conversation-id",
  "attachment": {
    "attachment_id": "8ce28683-406d-4f61-aa75-957c032be16c",
    "filename": "equation.png",
    "mime_type": "image/png",
    "size_bytes": 128000,
    "created_at": "2026-11-09T10:00:00Z",
    "expires_at": "2026-11-09T16:00:00Z",
    "status": "uploaded"
  }
}
```

The browser holds the returned ID; it does not generate it. Old Claude attachment tokens are rejected with a request to reselect the files.

### POST /api/e-learning/stewart/chat

```json
{
  "courseId": "authorized-course-id",
  "weekNumber": 3,
  "documentId": null,
  "messages": [{"role": "student", "text": "Explain this equation."}],
  "attachment_ids": ["8ce28683-406d-4f61-aa75-957c032be16c"],
  "grounded": false
}
```

Response: `{reply, truncated:false, sources, session_id, retrieval_info?}`. `attachment_ids` may be omitted or empty. No binaries/base64 are included. Only the last validated student question is sent upstream; Concept Explainer maintains its own history. Previous browser history remains shape/size checked.

### DELETE /api/e-learning/stewart/attachments

JSON `{courseId, weekNumber, documentId?, attachment_id}`. Response `{removed:true}`. Ownership/context is checked before upstream deletion. Active explanation leases return 409; the file expires automatically if best-effort browser cleanup cannot finish. Cleanup is idempotent for already deleted records.

Errors use `{error, code?}` with safe messages. 401/403 cover authentication/ownership; 404 covers unavailable course/document; 413 covers body/file size; 422 covers invalid formats/IDs/expiry; 409 covers active processing/use; 503 covers temporary upstream/database failures. Recoverable codes include `ATTACHMENT_EXPIRED` and `ATTACHMENT_REATTACH_REQUIRED`. Upload failure details appear beside individual files.

## AkadVerse → Concept Explainer contract

The existing `services/e-learning/ai-ingest/client.ts` is the only AI transport adapter. All requests use server-side `Authorization: Bearer AI_SERVICE_API_KEY`, no redirects, no-store and bounded timeouts.

- `POST /attachments`: native multipart FormData containing **only `file`**, original validated bytes, safe filename, canonical supported MIME. Fetch supplies the boundary. A 200 response must contain valid metadata; its size/MIME must match the forwarded file.
- `GET /attachments/{id}`: metadata adapter available for reconciliation. It is **not** called before every explanation; local ownership/expiry records suffice.
- `DELETE /attachments/{id}`: 204 and 404 are both successful cleanup.
- `POST /explain`: JSON `{question,course_offering_id,week,session_id,attachment_ids?}`. Offering/week come from approved registration. IDs must belong to this student and this conversation and be unexpired. No provider/model SDK fallback remains in AkadVerse.
- Existing external-search `POST /explain-with-grounding` remains multipart `question` only. It has no documented attachment contract, so attachments require turning that mode off.

Sources preserve attachment `source_type`, `attachment_id`, `filename`, nullable `document_id`, `material_type`, title and preview. Image sources can use the local original for a thumbnail. Lecturer source IDs are filtered against the authorized week's materials; attachment source IDs against the verified request. `ai_generated` provenance stays separate from course material; source previews are no longer repeated as answer content. Sources are grouped in a closed “View learning sources” disclosure. See [learning response presentation](stewart-learning-responses.md). Retrieval counters are returned unchanged when numeric: attachment chunk counters describe text chunks; `attachment_images_count` describes images.

## Ownership, sessions and persistence

`StewartAttachment` in the E-Learning database stores student ID, scoped session ID, upload fingerprint, remote attachment ID, safe filename, MIME, size, status, creation/expiry time and active-use lease. Binaries never enter either application database or course-material storage.

Saved conversations now own independent random service sessions; authenticated ownership is checked before uploads or explanations. Legacy stateless consumers retain the earlier HMAC context session. New UI conversations and transcripts are persisted and can be reopened after reload. No fictional `/sessions` endpoint is called. See [persistent conversations](stewart-conversations.md) for history, ownership, retries and lifecycle. The microservice's separate history retains its documented 105-day lifetime.

Database advisory locks serialize short reservation, use and deletion transactions across replicas. Pending upload reservations count toward eight active slots. Network calls run outside database transactions. The upload fingerprint makes a repeat request reuse a confirmed unexpired remote ID, including retry after a lost browser response. Failed uploads can retry; in-progress duplicates receive 409. A lost **upstream** response can still leave an unreferenced remote file until automatic expiry because the service provides no idempotency key or listing endpoint.

## Expiry and cleanup policy

The returned `expires_at` is authoritative (documented lifetime: six hours). Submitted references may be reused for follow-ups until removed or expired. Before explaining, the backend rejects expired records. A remote 422 with attachments invalidates those records and returns a recoverable reattachment code; this also covers unreadable/vision-rejected attachments without exposing provider detail.

On expiry/rejection, the composer restores available originals to the pending queue, preserves the question, and asks for resubmission. Resubmitting uploads originals for fresh IDs. Missing local originals must be reselected or recaptured. It never silently sends without an expired attachment.

Removing an uploaded pending/reference file requests upstream deletion. Saved-conversation uploads remain reusable after leaving the panel; legacy uploads still attempt cleanup on unmount. An explanation holds a three-minute use lease, so concurrent deletion cannot remove files in that request. A crash leaves a bounded lease. Network failures or page termination can prevent cleanup; the service's six-hour expiry is the fallback. Unreferenced metadata expired more than a day ago is opportunistically purged on a later upload; expired references belonging to saved conversations remain to require explicit reattachment/removal; no background job was introduced.

## Configuration and rollout

Server-only configuration: `CONCEPT_EXPLAINER_API_URL` (or existing `AI_SERVICE_URL`), `AI_SERVICE_API_KEY`, `NEXTAUTH_SECRET`, and the existing E-Learning database URLs. No new provider secret or browser environment variable is needed.

Apply `prisma/elearning/patches/20261110_stewart_attachments.sql` to the E-Learning database **before** deploying these routes, or use the repository's established reviewed schema-push process. Regenerate the E-Learning Prisma client. The SQL patch is additive and contains no production data writes beyond creating its table/indexes; it has only been applied to the local test database during implementation.

The service README requires at least 150 seconds for large attachment explanations. Upstream timeout is 150 seconds, browser explanation timeout 160 seconds, route `maxDuration` 180 seconds. Confirm the deployment plan/proxy permits that duration. Uploads have a 30-second upstream and 45-second browser budget.

## Verification

```sh
npm run db:local:up
npm run test:db:setup
npm test
npx tsc --noEmit

# Set BROWSER_MODULE_DIR to a directory containing playwright-core.
BROWSER_MODULE_DIR=/path/to/node_modules node --import tsx scripts/verify-stewart-capture.ts
BROWSER_MODULE_DIR=/path/to/node_modules node --import tsx --experimental-test-module-mocks scripts/verify-stewart-attachment-e2e.ts
```

Browser scripts use installed Chrome on macOS and temporary local servers. The capture suite exercises actual Office/PDF pixels, selection/cancel/confirmation, mixed PDF/TXT/screenshot submission, file limits, ninth-file rejection, per-file retry, expiry recovery, sources and mobile touch/overflow. The attachment E2E script connects real browser components to the actual authenticated routes and local ownership database, then a recording HTTP microservice fixture and rendered reply. Authentication uses the existing test session seam; upstream generation is simulated.

Backend tests exercise individual document/image validation, unchanged binary multipart forwarding, API-key authentication, partial failures, concurrency limits, stable sessions, foreign ownership rejection, expiry, upstream 422, safe errors, source filtering and deletion during use. Existing regression tests cover text-only chat, lecturer retrieval context, grounding and academic authorization.

Live staging acceptance remains required: run a real PDF question, a captured equation, a mixed request, expired-ID recovery and a cross-student attempt using staging accounts. Confirm actual model vision quality/4 MiB acceptance, upstream migrations/history and hosting timeouts. Automated fixtures do not prove live generation quality or deployed service availability.

### Recorded implementation checks (10 November 2026)

- `npm test`: **180 passed, 0 failed**, with isolated local PostgreSQL and fake external providers.
- `npx tsc --noEmit`: passed. ESLint for changed implementation/test files: passed.
- `verify-stewart-capture.ts`: passed desktop Office/PDF, confirmation, mixed files, partial failure/retry, expiry, limits and mobile pointer checks.
- `verify-stewart-attachment-e2e.ts`: passed browser → actual routes → database → multipart HTTP service fixture → explanation → rendered attachment sources, stable session and upload reuse. The browser never contacted the service endpoint or received its key.
- No production database patch, deployment, live model generation or production build success is claimed by these checks.

### Runtime database patch, 11 November 2026

The application reported P2021 because its configured E-Learning database did not yet contain `public.StewartAttachment`. Applied the additive `20261110_stewart_attachments.sql` table/index definitions to that database. An initial interactive transaction timed out and rolled back; a single atomic PostgreSQL command then succeeded. Verified the table through the generated Prisma client's count query and confirmed the primary, unique and expiry/session indexes. This records schema availability, not a subsequent browser-upload result.
