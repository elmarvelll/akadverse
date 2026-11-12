# Stewart persistent conversations

Implemented 11 November 2026. AkadVerse stores owned conversations and complete message records in the existing E-Learning database. Concept Explainer remains the only AI pipeline. The current microservice OpenAPI was inspected: `/explain` accepts `question`, `course_offering_id`, `week`, optional `attachment_ids` and `session_id`. It does not expose a history, conversation-management or session-deletion endpoint. Responses remain synchronous JSON; there was no streaming implementation to replace.

## Database and migration

`ChatConversation` stores owner `userId`, a random per-conversation `sessionId`, title/title-generation flag, client creation key, academic/document context snapshot, creation/activity times and a bounded generation lease. `ChatMessage` stores its conversation FK, USER/ASSISTANT role, content, request ID, creation time, PENDING/COMPLETE/FAILED status and JSON metadata for sources, retrieval information, grounding mode and attachment names/IDs. Attachment binaries are never stored with messages.

The message FK cascades on conversation deletion. Unique `(conversationId,requestId,role)` prevents duplicate turns, unique `(userId,clientKey)` makes first-conversation creation recoverable, and session IDs are unique. Owner/activity and conversation/message chronological indexes support keyset pagination. The SQL patch also constrains role/status enums, positive week, nonempty content and title length.

User IDs are application-level references to Core identities, following the repository's two-database architecture; PostgreSQL cannot create a foreign key to the separate Core database. Course/offering/document identifiers are context snapshots rather than cascade relationships, so deleting academic material does not erase a student's saved transcript. Current approved registration and offering are rechecked before generation.

Migration: `prisma/elearning/patches/20261111_stewart_conversations.sql`. It creates only the new enums/tables/indexes, without resetting existing records. It was tested in an isolated local schema, including the cascade, then rolled back. It was also applied to the database configured by the local application; Prisma count queries and expected indexes were verified afterward. The existing Prisma build/postinstall generators include these models.

## APIs

All routes use existing server-side NextAuth authentication, student-role/profile checks and no-store responses. A browser `userId`, offering ID or service session ID does not establish ownership.

| Method and route under `/api/e-learning/stewart` | Contract |
| --- | --- |
| `GET /conversations?courseId=&before=&limit=` | Own summaries sorted by `(updatedAt,id)` descending; no messages loaded. Default 20, maximum 50. Returns `conversations,nextCursor`. Course filter is optional. |
| `POST /conversations` | `courseId,weekNumber,documentId?,clientKey`, optional `message,requestId`. Creates an owned conversation. The UI supplies its first message, persisted as awaiting submission before file upload/generation. Returns `conversation`. A repeated client key returns the same conversation; mismatched content/context is rejected. |
| `GET /conversations/[id]?before=` | Owner-only conversation snapshot and latest 50 messages in chronological order, with `nextCursor` for older messages and attachment references. |
| `DELETE /conversations/[id]` | Owner-only deletion. Active generation/upload returns 409. Cascades application messages and attempts cleanup of its service attachments. Returns `deleted:true`. |
| `POST /conversations/[id]/messages` | `content,requestId,grounded?,attachment_ids?`. Persists the user turn before generation, loads saved history and context, calls the shared AI service, then persists the completed assistant response. Returns existing `reply,sources,truncated,session_id,retrieval_info?` plus `userMessage,assistantMessage,conversation`. |

Creation keys and message request IDs must be UUIDs, generated once per UI operation and reused after failures. Ownership failures return 404 without exposing whether another student's ID exists. Authentication/role failures retain 401/403. Invalid input is 400, active or conflicting idempotency requests are 409, attachment recovery errors retain structured 422 codes, and temporary service/database failures retain safe 503 responses.

The existing `/chat` endpoint remains for stateless consumers and uses the same explanation service; saved-chat requests must use the message endpoint. The attachment endpoint accepts `conversationId` in addition to the existing context fields, resolves its authorized session server-side, and refuses a deleted or foreign conversation. Legacy uploads without a conversation retain their previous context-bound behavior.

## Context and AI integration

Each saved conversation has a separate random session, even when two conversations share the same student/course/week/document. Continuing uses the stored session instead of deriving a single session for every conversation in that context.

Before generation, the backend loads up to ten recent completed messages from this conversation. It does not trust browser-supplied history. The shared adapter includes up to 1,600 characters of those saved turns as labeled reference context in the documented `question` field, followed by the complete current question. The entire question remains within the service's 4,000-character limit. A near-limit current question is kept intact; there may be no room for additional reference text, while the stable service session still supplies its documented history. No unsupported `messages`/`history` field or fictional session endpoint is sent upstream. Failed/incomplete turns do not become prior assistant context.

This same bounded context also supports grounding, whose existing endpoint accepts only its question form field. Model/provider choices, system instructions, retrieval authorization, response structure, Markdown/KaTeX and source provenance are unchanged. Completed assistant content and returned metadata are persisted without presentation edits.

## Reliability and concurrency

The UI creates no empty database rows when New chat is clicked. Creation happens on first Send, using a stable client key and a first user record, so an upload/AI failure cannot erase that question. Its initial awaiting-submission status supports recovery if the tab closes during uploads.

Short database transactions lock the owned conversation row to reserve a generation, enforce a 210-second lease and unique token, and persist its eventual pair. HTTP generation runs outside the transaction. The user record survives failure with FAILED status; Retry response reuses its request ID. A completed replay returns the saved assistant message without another AI call. A request ID cannot change its question. A stale completion/release cannot overwrite or unlock a newer generation. Only complete assistant responses are stored.

Independent conversations can run independently. The frontend keys messages, drafts, pending status and file queues by conversation/draft, rejects stale selection loads, and routes a background reply to its original transcript. A refreshed tab polls pending saved turns until completion/lease expiry. Older-message pagination preserves scroll position.

The microservice has no documented generation idempotency key. If its response is lost after remote generation but before local commit, retry can produce another remote generation/history entry; application uniqueness still prevents duplicate local user/assistant records. A process crash recovers after its bounded lease. This is not a distributed transaction with the external service.

## Titles and greeting

The first message supplies a temporary title of at most eight words. After the first successful exchange, the title is derived from a meaningful Markdown heading, or the question's subject with introductory request wording removed. It is generated once, saved and reflected in the list. This requires no extra AI request or response latency. A title failure keeps the temporary title. Title storage is suitable for a future rename action, which is not implemented here.

New chats display only “Hi, I am Stewart. How can I help you today?” as a local welcome state. It is never sent to the AI as history or saved as an assistant message. Long introductory text and initial suggestion chips were removed.

## Frontend and attachments

The existing Stewart panel now has New chat, collapsible Chat history, active selection, refresh/retry, paginated history, loading/empty/error states, and a delete confirmation. History is filtered to the current course in the UI and can span its available weeks/documents; the API can list all owned conversations. Selecting restores transcript, grounding mode, study context and unexpired attachment IDs. The surrounding document viewer, Study Mode and capture controls are retained.

Persistent uploads are not deleted merely because the tab closes. They remain reusable for six hours, until explicit removal or conversation deletion. Pending unuploaded files remain local and may need reselection after refresh. Old image binaries cannot be reconstructed from metadata, so refreshed messages retain filenames/source provenance and use thumbnails only where a local original remains available.

Expired/rejected file references remain visible for saved conversations, including after opportunistic metadata cleanup; they cannot silently disappear from the next request. The UI requires reattachment or explicit removal. Reselecting an unambiguously matching expired file replaces its stale reference. Actual expiry metadata remains authoritative. Deleting a conversation tries remote attachment cleanup; network failures fall back to automatic service expiry.

Deleting the application conversation removes its local messages and access path. Concept Explainer's separate documented 105-day history retention remains in force because its API has no session/history deletion operation. Pre-feature browser-only transcripts cannot be retroactively reconstructed from an undocumented remote history endpoint.

## Verification and rollout

No new environment variable or dependency is required. Keep the existing E-Learning database URLs, NextAuth settings, `CONCEPT_EXPLAINER_API_URL`/`AI_SERVICE_URL` and server-only `AI_SERVICE_API_KEY`.

For another environment, apply the SQL patch to its E-Learning database before deploying, then regenerate the client (`npm run db:elearning:generate`) and restart the running development server. Production builds already generate it. New message requests allow 240 seconds for database work and the existing 150-second upstream explanation budget; check hosting limits.

Tests: `tests/elearning/stewart-conversations.test.ts` covers ownership, first-message persistence, sessions/history, title generation, failed/replayed requests, concurrent claims, stale tokens, pagination, cascades, attachment ownership and expiry restoration. `scripts/verify-stewart-attachment-e2e.ts` now also exercises refresh, history selection, independent conversations, continued sessions, delete confirmation, delayed replies, failed retries and mobile layout through real application routes and the local database. AI responses and authentication sessions use test fixtures in automated checks. Existing Markdown/math, Study Mode, capture, retry and mobile scripts remain regression checks.

### Recorded verification, 11 November 2026

- Full repository suite: **214 passed, 0 failed**. Final focused conversation suite after title/mode validation: **16 passed**.
- TypeScript, targeted ESLint and diff checks passed.
- Chrome passed production-component → actual route → local database → recording HTTP service integration for refresh/history, multiple sessions, restored attachments/context, lazy New chat, unpersisted greeting, deletion/cascade, background-response isolation, failed-message retry and mobile layout.
- Existing Markdown/KaTeX, source disclosure, Study Mode/resizing, PDF/Office capture, partial upload retry, expiry and mobile pointer suites passed through the conversation-aware client.
- The exact SQL patch passed an isolated-schema rollback test including the message cascade. It was then applied to the configured E-Learning database; both new tables and all expected indexes were verified with Prisma. Existing application records were not reset.
- The live service OpenAPI returned 200 and confirmed the supported request fields and absence of history/session CRUD endpoints. Automated generation tests use recording fixtures; no production user conversation was fabricated for testing. No production build/deployment success is claimed.

Files added: the conversation/title/shared-explanation services, conversation API routes, additive schema patch, conversation integration tests and shared browser fixture. Existing Prisma schema, Stewart chat/attachment adapters, client/panel/workspace, regression scripts and documentation were extended. No dependency or credential was added.
