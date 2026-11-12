# Stewart / Concept Explainer integration engineering report

> **10 November 2026 implementation update:** Documents and screenshots now share the Concept Explainer attachment/explain workflow, with persisted ownership and server-scoped sessions. See [the current attachment contract and rollout guide](stewart-attachments.md). Earlier direct-provider and unsupported-attachment descriptions below are historical.

Date: 2026-11-06. This report describes repository changes, not a production certification. The external Concept Explainer repository and its original README were not provided; contracts below follow the supplied integration request. Confirm these contracts with its maintainer before deployment.

## Audit and implementation locations

| Capability | Before | Change / implementation |
| --- | --- | --- |
| POST /ingest | Durable queue, fresh signed URLs, academic metadata, authenticated 202 validation already implemented | Preserved in `services/e-learning/ai-ingest/{client,worker,ingest-material}.ts`; base URL validation added |
| DELETE /documents/{id} | Authenticated 204/404 handling and durable retry existed | Preserved; Storage removal now precedes AI cleanup eligibility in `services/e-learning/faculty/materials/delete-material.ts` |
| GET /documents/{id}/status | Missing | Added validated client and lease-based reconciliation to existing worker |
| GET /health | Missing AkadVerse integration | Added unauthenticated upstream health request; DAPU ingestion page shows selected diagnostics |
| POST /api/webhooks/ai-ingest | Existing constant-time separate-secret validation and exact `{ok:true}` response | Preserved; unknown/deleted IDs acknowledged; duplicate callbacks leave terminal result intact |
| POST /explain | Stewart called Claude instead | Text-only chat now calls Concept Explainer through existing authorized chat route |
| POST /explain-with-grounding | Missing | Multipart client added; existing chat route selects one endpoint |
| Grounding selector | Missing | Per-thread in-memory accessible toggle in `StewartPanel.tsx`, disabled during requests |
| Ingestion cron | Authenticated route existed, absent from vercel.json | Daily fallback registered; external scheduler still required for prompt processing |
| Student attachments | Existing signed, owner-bound, expiring Claude Files/vision pipeline | Preserved separately; not combined with Concept Explainer RAG |
| Conversations | Per-thread React state and browser-supplied bounded history | Preserved; no persistent conversation database exists here |

Existing user edits to `docs/elearning/README.md` and `systems/stewart.md` were preserved. No AI-service schema changes or new AkadVerse schema migrations were introduced.

## Endpoints and authentication

All endpoints in this section belong to **Concept Explainer**, except the explicitly identified AkadVerse callback and cron routes. The browser only calls AkadVerse routes. API credentials remain on the server.

### POST /ingest

The scheduled AkadVerse worker calls this after a lecturer's original upload is confirmed in Supabase and a durable task is created. Header: `Authorization: Bearer AI_SERVICE_API_KEY`; content type JSON. Body includes `document_id`, a fresh one-hour signed `file_url`, original `file_name`, canonical `mime_type`, HTTPS `callback_url`, and metadata from the actual material/offering/curriculum/session/semester records. Metadata contains course code/title, actual offering ID, session, semester, start/end weeks, inclusive weeks array, type, title and document ID.

Only NOTES in PDF/DOCX/PPTX are eligible for AI ingestion. Existing academic uploads can still store ZIP; it is explicitly marked unsupported for AI. Assignments and quizzes remain outside ingestion. This preserves the existing material workflow.

Only `202 {status:"queued",document_id:<same ID>}` confirms admission. The material remains PENDING (displayed as queued), not INGESTED. The separate task becomes ACCEPTED. Pre-admission transient errors use bounded retries. Ambiguous POST outcomes are never blindly resubmitted because the service reuses the old payload for an existing ID. Expired local claims require reconciliation.

The remote worker extracts text, chunks it and embeds it. OCR is not implemented upstream; scanned/empty extraction failure is represented as failure, not successful ingestion.

### DELETE /documents/{document_id}

AkadVerse's cleanup worker calls this with API-key Bearer authentication and no body. The lecturer must first pass existing offering ownership checks. AkadVerse removes exactly the stored bucket/object path, then persists the durable DELETE task before deleting its material row. The nullable task relation preserves the document ID after row removal.

204 and 404 both mean successful remote cleanup. Temporary failures retry with bounded backoff; credential/configuration failures require DAPU review. In-flight ingestion that could recreate chunks is flagged as uncertain cleanup rather than silently treated as settled. Original-file deletion failure leaves the material record and does not schedule a new remote deletion. A pending-cleanup result is returned to the lecturer action.

This uses asynchronous cleanup: the original and local material disappear before remote deletion completes. Until cleanup runs, stale remote chunks may remain searchable. Source references are filtered to current authorized workspace documents, but filtering source labels cannot remove stale text already used in an upstream answer. A stronger guarantee needs upstream exclusions/cancellation or an application-level retrieval block while cleanup is pending. There is also a failure window after Storage deletion and before the database cleanup task commits; the retained material record permits retry, but the operation is not a distributed transaction. Repeating a remote DELETE is safe; repeating a local deletion of an already-removed material returns the existing not-found response.

Replacement must use a newly uploaded material ID. Do not resubmit an existing document ID with a fresh signed URL to replace content. Confirm remote cleanup for the old version, especially if its worker was still running.

### GET /documents/{document_id}/status

The existing authenticated AkadVerse cron worker calls this with API-key Bearer authentication, no body, and a 15-second timeout. It does not call the webhook. Response identity and status must match the requested document. Allowed states are queued, processing, done and failed. Done requires a positive safe integer chunk count.

Queued and processing both map to the existing material PENDING enum; done maps to INGESTED and failed to FAILED. This deliberately avoids a database enum migration; the application does not currently expose a separate PROCESSING material badge. Terminal task state stops polling. Sanitized failure classifications are stored rather than arbitrary upstream content.

An early 404 schedules another check after five seconds. Later 404s remain reconciliation anomalies in ATTENTION and are periodically rechecked, not falsely marked as remote processing failure. Network/configuration/malformed-response errors retain the task and schedule a later check. Deleted/DELETE tasks, terminal tasks and callback-completed tasks are excluded.

### GET /health

The authorized DAPU ingestion page calls the upstream health endpoint without an Authorization header, with timeout/no-store/redirect rejection. It displays reachability, ingest_status, worker_status and worker_count. The raw health body stays on the server except these selected fields. This reports configuration and reported state; it does not prove Gemini generation, ADC, billing, quotas or individual worker liveness. Health is not a precondition on every chat request.

### POST /explain

The browser posts its question/history and study context to **AkadVerse `POST /api/e-learning/stewart/chat`**. Existing session/student-profile and approved registration checks resolve the course workspace. The selected week must exist; there is no Week 1 fallback. The actual offering ID is obtained from the approved registration, not constructed from a code or trusted from the browser.

For text-only, non-grounded questions the backend calls the upstream endpoint with API-key Bearer authentication and JSON `{question,course_offering_id,week}`. Question length is 1–4000. No undocumented document filter or conversation history is sent upstream. The microservice retrieves lecturer chunks filtered by offering and week and generates the answer. AkadVerse validates `{answer,sources}` and renders answer, lecturer title/type and chunk preview. It filters returned lecturer document IDs against the authorized selected week's materials and invents no source URLs.

401/503, malformed responses, timeout and network failures become a student-facing temporary-unavailability error. No alternative provider is silently invoked. Empty source arrays are valid; no lecturer source references are fabricated. Explanation requests use a 50-second timeout within the route’s 60-second budget; ingestion, status, deletion and health use 15 seconds. Validate staging latency before rollout.

### POST /explain-with-grounding

The same authorized AkadVerse chat route calls this when the student's grounding toggle is active. Header uses the API key. Body is native FormData with `question`; fetch generates the multipart boundary. It is not JSON and carries no undocumented offering/week fields.

The expected JSON has nonempty concept, simple_explanation, analogy, example, worked_problem and a sources array. Sections are formatted as readable text. Source titles and actual HTTP(S) URLs are retained with each response; unsafe protocols and credential-bearing URLs are discarded. Links open with noopener/noreferrer. Missing sections or upstream errors fail visibly without switching to regular explanation or resetting the selected mode.

Grounding uses external search knowledge, whereas regular explanation uses the course/week lecturer corpus. An active selection persists across messages in that thread for the page visit; other threads start inactive and refresh resets selection. The toggle has aria-pressed and a highlighted active state. Existing synchronous submission guards prevent duplicate sends, and the selected value is captured by the send handler before attachment upload awaits.

### AkadVerse POST /api/webhooks/ai-ingest

The AI worker calls this after remote completion with `Authorization: Bearer AI_SERVICE_CALLBACK_SECRET` (not the API key). JSON body is `{document_id,status:"ingested",chunk_count}` or `{document_id,status:"failed",error}`. AkadVerse hashes and constant-time compares the secret, validates the payload, resolves the unique document task, rejects never-submitted identities, and updates only matching INGEST tasks. A deleted version or a task converted to DELETE cannot be revived by a callback.

The first callback terminal result wins. Success returns literal `{ok:true}`; unknown IDs return `{ok:true,ignored:"unknown document_id"}`. Missing configuration returns 503, wrong credentials 401, invalid payload 400 and database failure 500. Processing errors are classified/sanitized. Callback delivery is best effort (three attempts, 1s/4s backoff and 5s request timeout upstream), so the status reconciler independently repairs missed delivery. A remotely completed job is not proof of callback delivery.

## Scheduler operation and deployment

`GET /api/cron/ai-ingest` uses existing CRON_SECRET Bearer authentication, AI_INGEST_ENABLED, no-store responses and maxDuration 300. It runs reconciliation followed by ingestion/deletion work. Each phase has a bounded batch (default 10, maximum 20), sequential network calls and conditional database claims with a random token and 90-second lease. Competing executions cannot both claim the same task version. Callbacks clear claims, and conditional completion updates cannot overwrite a winning callback or a DELETE operation.

The existing lastAttemptAt and nextAttemptAt fields store poll timing; no separate last-successful-poll field was added. Nonterminal checks are due after 10 seconds during the first five minutes, then after five minutes. Temporary errors use a five-minute interval; early 404 uses five seconds. This is a due-time policy, not a promise of actual scheduler frequency. Expired ambiguous local POST claims transition to ATTENTION and become eligible on a subsequent invocation.

`vercel.json` retains the existing daily marketplace inventory and delivery cron jobs and adds AI ingestion at `0 0 * * *` (UTC). The repository documents a daily-only hosting plan. This fallback does **not** meet a 10-second polling recommendation. Configure an external authenticated scheduler every 10 seconds if supported; otherwise choose one minute and accept that latency. No external scheduler has been provisioned or verified by this change. Bounded batch capacity must be sized for upload volume and platform function duration. Confirm that a 300-second function is supported by the deployment plan.

Verify production using scheduler delivery logs and response counts (`processed`, `reconciled`), task lastAttemptAt/nextAttemptAt/state transitions on the DAPU page, an actual upload followed by authenticated callback, and a missed-callback test that reaches terminal state through status polling. Never log scheduler Bearer secrets, signed download URLs or attachment content. Verify 401 for a wrong cron secret and failure when CRON_SECRET is absent.

## Stewart student experience and attachments

Stewart is the Study Zone assistant beside a registered course's weekly material viewer. For example, a student in Week 3 can ask “Explain the Fourier transform with an example”; text-only mode searches that offering's Week 3 chunks and shows the returned lecturer references. Selecting a lecture in the viewer does not restrict the upstream search to that document. “Explain with Grounding” instead asks for externally grounded explanation sections and links.

Existing attachments support PDF, Word/PowerPoint text extraction and decoded images (including screenshots) through the Claude Files/vision pipeline. Files use signed owner-bound expiring tokens, size/type/content validation, rate limits, removal controls and temporary provider storage. They are not inserted into lecturer RAG. A circuit screenshot can be explained by that existing vision assistant, but it is **not** combined with Concept Explainer lecturer retrieval. Grounding with attachments is explicitly rejected. The UI explains these boundaries. No screenshot-to-RAG endpoint was invented.

To combine attachments and lecturer RAG, the external service needs an agreed temporary-context API, vision processing for images, extraction for documents, ownership/lifetime limits and cleanup semantics. That repository is not present here. Do not claim this combined workflow works.

Conversation messages, source arrays, selected mode and attachment references remain in the existing per-thread React state during the page visit. They are lost on refresh. Attachment-mode Claude requests retain bounded conversational history; Concept Explainer receives the current question only because its supplied contract has no history support. Follow-ups that rely on implicit earlier context can therefore be less useful in Concept Explainer mode. No server conversation persistence was added.

## Environment and verification

Server-only configuration: CONCEPT_EXPLAINER_API_URL (legacy AI_SERVICE_URL fallback), AI_SERVICE_API_KEY, AI_SERVICE_CALLBACK_SECRET, APP_BASE_URL or NEXTAUTH_URL, AI_INGEST_ENABLED=true, CRON_SECRET, existing E-Learning database and Supabase service configuration. Existing attachment mode additionally needs ANTHROPIC_API_KEY and NEXTAUTH_SECRET. Never use NEXT_PUBLIC variables for these secrets. Use distinct staging/production endpoints and credentials; no Railway URL is hardcoded. The base URL must parse as HTTP(S), without credentials/query/fragment. Production should use HTTPS.

Commands:

- `npx tsc --noEmit`
- `node --import tsx --experimental-test-module-mocks --test tests/elearning/ai-ingest-policy.test.ts`
- `node --import tsx --experimental-test-module-mocks --test tests/elearning/ai-ingest.test.ts tests/elearning/stewart-document-chat.test.ts tests/elearning/stewart-http.test.ts`

Follow-up verification: the isolated local PostgreSQL container was started and both repository schemas were applied. The complete regression suite passed **177/177 tests**, with zero failures or skips. This includes actual-database ingestion, callbacks, deletion, course authorization, missed-callback reconciliation, competing reconciliation claims and preservation after Storage failure. The new chat-route tests verify trusted offering/week context, authentication, registration isolation, multipart grounding, unsafe-source rejection and no silent fallback. External AI/Storage/email providers remain fakes.

The first full run had two email-link expectation failures because the shared test environment inherited APP_BASE_URL from the deployment environment. Explicitly setting the test origin in tests/helpers/env.ts resolved both; the complete suite then passed. An initial new-test runner format error was corrected before that final run.

Chrome checks passed for Office/PDF screenshot capture, attachment retry and follow-up references, grounding toggle/aria-pressed, retaining mode after a failed send, external source links, normal-mode switching and mobile touch/layout. These browser tests mount real UI components with fixture endpoints, rather than a live AI service. TypeScript, targeted ESLint and git diff --check passed.

Production build verification did not pass in this environment. Default `npm run build` first failed to download Google Fonts under sandbox network restrictions. Its outside-sandbox retry reached Turbopack processing but failed while binding a worker port (Operation not permitted). `npx next build --webpack` compiled successfully and passed its TypeScript phase, then failed during page-data collection for `/api/e-learning/documents/[id]/access`: the existing native `createRequire` Prisma loader in src/lib/db/elearning.ts is not handled by this fallback builder. No production loader changes were made as part of this testing task. The production build remains a release blocker requiring verification in a suitable Turbopack build environment or a separately reviewed loader compatibility fix.

No staging, production, actual Gemini, actual Supabase or deployed cron success is claimed. Existing attachment tests use a fake provider and do not establish live vision quality.

## Outstanding verification and limitations

- Original external README/API implementation must be checked; supplied request is the only external contract available.
- Database-backed ingestion/deletion/reconciliation and authorized chat-route tests now pass. Additional staging fault-injection is still needed to verify remote service behavior.
- Browser toggle/source/mobile checks now pass with fixture endpoints. Deploy and exercise both real explanation endpoints.
- Provision and verify a frequent external scheduler; daily fallback is insufficient for prompt operation.
- Validate health field shapes and generation latency against staging.
- Strong stale-RAG exclusion during asynchronous deletion and remote worker cancellation remain external contract/design dependencies.
- Local repeated deletion returns not-found after removal; full distributed deletion is not atomic.
- Processing has no separate local material enum; poll success timestamps reuse existing scheduling fields.
- Combined temporary attachment + lecturer RAG is unsupported. Conversation refresh persistence remains absent.
- Production deployment, credentials and end-to-end acceptance testing remain required.


## Intermittent Supabase connectivity

Local reports of Prisma P1001 against both Core and E-Learning poolers, together with UND_ERR_CONNECT_TIMEOUT when signing Storage URLs, occur before an AI explanation is requested. A follow-up TCP probe reached both database ports, while Storage HTTPS exceeded a 10-second timeout; this indicates intermittent reachability rather than proof of a credential or schema problem.

Stewart now skips lecturer display-name lookups in Core when resolving its authorized academic context. The Study Zone also avoids resolving those names twice. Student profile and approved-registration checks remain required. Connectivity/pool errors return a safe 503 in chat and document access; authorization and schema errors retain their distinct handling. Download URL signing has a 10-second per-attempt timeout and one retry for transport errors; missing objects and HTTP credential failures are not retried. These changes do not fix an unavailable database/network.

Verification after these changes: 94/94 E-Learning tests passed against isolated local PostgreSQL and fake external providers. TypeScript and targeted ESLint passed. Tests cover no Core identity query on chat, 503 on academic database outages, signing recovery and bounded failed attempts. No production code deployment or environment changes were made for this connectivity fix.
