# Revision-question webhook: codebase audit and implementation boundary

> Historical starting-state audit. The user subsequently approved the five-condition pass rule and delegated the independent embedding choice. Those foundations and the learning pipeline are now implemented; see [the current integration guide](../../REVISION-QUESTIONS-WEBHOOK-INTEGRATION.md) for status and verification.

Reviewed 15 November 2026 on `productivity-layer-integration`, including local `staging`, `main`, `marvelous/studyzone`, and `productivity_layer` references. Existing uncommitted Productivity Assistant work is preserved.

## Existing components

| Component | Location / finding |
| --- | --- |
| Stuwart explanations and conversations | `services/e-learning/student/stewart/`, `src/app/api/e-learning/stewart/`. Student-authorised chat exists; no teaching-stage pass result or tracker is persisted. |
| AI service client | `services/e-learning/ai-ingest/client.ts`. Reuses `CONCEPT_EXPLAINER_API_URL` (or legacy `AI_SERVICE_URL`) and `AI_SERVICE_API_KEY`. |
| Durable work and cron | `services/e-learning/ai-ingest/worker.ts`, `AiIngestTask`, `/api/cron/ai-ingest`, shared `requireCronSecret`. Existing leases/backoff are useful patterns; INGEST/DELETE tasks are not teaching-generation jobs. |
| Notifications | `services/marketplace/notifications/notification.service.ts`: persisted admin fan-out and SSE. Email delivery/outbox also exists. No separate notification provider is necessary. |
| Core student identity | Core `User`; E-Learning `StudentProfile.userId` references Core at application level. A wire `student_id` must eventually be bound to the actual teaching event, not guessed from its prefix. |
| Material analysis | Previous implementation is preserved under ignored `.local/branch-work/productivity-isolation-1adb46b4/files/`; it is not active on this branch. Its lesson-plan concepts are JSON results, not an active canonical concept model. |
| Database clients | Existing Core and E-Learning Prisma singletons; avoid creating a pool per webhook. Prisma 6.19.3; Next.js 16.3.3. |
| Hosting | Vercel configuration schedules ingestion daily. Existing workers allow bounded execution with external scheduler guidance. A long frontend generation request is inappropriate. |

## Verified live contract

A read-only GET of the configured AI service's `/openapi.json` returned HTTP 200 and exposes `POST /generate-revision-questions`, protected by `SharedSecretBearer`.

Required outbound fields: `teaching_event_id`, `student_id`, `concept_id`, `concept_description`, `taught_summary` (1–2,000 characters), and `subject`. Optional fields include `curriculum`, `level`, `topic`, `language`, `max_questions` (1–5, default 3), and `question_types` (`mcq`, `short_answer`, `true_false`).

The generation response requires `teaching_event_id`, `generated_count`, `webhook_attempted`, `webhook_status`, and `needs_review`. It also exposes `webhook_results` as an array of arbitrary objects and optional `error_detail`. Thus OpenAPI does not constrain individual webhook-result outcome enums. The published `PracticeQuestion` model uses a different schema and must not be mistaken for the revision webhook wire format.

No generation POST was made during the audit. No student data was sent and no external notification was sent.

## Missing prerequisites, confirmed against source and database metadata

Source searches found no teaching event/stage tracker, pass condition, revision question bank, question embeddings/search service, duplicate/variant judge, FSRS dependency/configuration/card model, or revision review log. Searches of the local branch references above also found no implementation to reuse.

Read-only metadata queries against both configured databases found:

- Core: no teaching/concept/revision/question-bank/card/FSRS tables; the matches `Review` and `SkillReview` belong to other product domains. pgvector is not installed here.
- E-Learning: pgvector is installed, but the matching question tables are only `ClassroomQuestion` and `ClassroomQuestionVote`, which are live-class student question/vote records. There are no canonical teaching/concept/question-bank/FSRS tables.

The vector extension's presence is not an embedding service, a vector dimension/model contract, or a semantic duplicate policy. Course chunk embeddings owned by Concept Explainer are not an AkadVerse revision-question vector store.

There is consequently no discoverable authoritative event that means “the student passed a teaching stage.” Inventing one from a chat reply, concept page visit, or arbitrary score would violate the supplied requirements.

## User clarification

The user confirmed during the audit that the teaching tracker, question bank, deduplication, and FSRS components have **not** been implemented. This is new subsystem work. The passing-rule and embedding-contract questions remain pending; the safe foundation does not invent either. A proposed stricter pass policy was offered for review using the real evaluator fields, not installed as a silent default.

## Proposed sequence

1. Implement bounded raw-body HMAC verification, strict wire-format validation, and structured safe errors at `/api/webhooks/tutor/questions`.
2. Add an independent leased idempotency record, with exact-byte hashes, exact stored response text, atomic claims, recovery fencing, and a final transaction helper for future canonical persistence.
3. Expose authenticated operational readiness and reusable admin alerting without marking processing successful. Keep production processing unavailable while authoritative dependencies are missing.
4. Obtain the actual teaching/question/embedding/deduplication/FSRS source or explicit instructions to build missing prerequisites, including a real passing rule and embedding/FSRS configuration.
5. Bind the webhook to those services: validate trusted event ownership/context, prepare embeddings/judgments outside transactions, and atomically persist questions/variants/cards and the completed receipt.
6. Connect the existing teaching-pass transaction to a durable generation job and existing cron conventions. Define safe replay of the remote generator: webhook retries with stable bytes do not imply that repeating generation yields the same body.
7. Verify real semantic matching, card scheduling/review history, generation orchestration, deployment, and end-to-end provider submission before enabling processing or claiming production readiness.

## Files for the safe foundation

- `services/e-learning/revision-questions/{security,contract,idempotency,errors,readiness,monitor,handler}.ts`.
- `src/app/api/webhooks/tutor/questions/route.ts`.
- `src/app/api/e-learning/admin/revision-generation/route.ts` (existing admin guard, operational status).
- E-Learning `prisma/elearning/schema.prisma` plus a versioned additive SQL patch, following the existing E-Learning patch convention. No question bank or alternate FSRS models are invented.
- `.env.example` placeholders for `AI_WEBHOOK_SECRET`; retain existing service URL/key conventions.
- `tests/revision-questions/` for protocol/security/idempotency and real local-database fencing/atomicity.
- `REVISION-QUESTIONS-WEBHOOK-INTEGRATION.md` for the engineer handoff, explicitly labelled incomplete until canonical integration exists.

The receipt belongs in E-Learning, alongside the existing pgvector extension and future learning persistence. Putting it in Core while questions/cards live in E-Learning would prevent a single atomic final transaction. Core notifications remain a separate best-effort operation after learning-state commits.

## Risks and decisions

- The user has been asked which repository/branch contains the missing learning services, or whether these prerequisites have not yet been built. No default pass condition can be chosen safely.
- A replay timestamp is an unsigned header under the agreed body-only HMAC specification. Freshness limits header age but cannot cryptographically bind that header to the body. Trusted teaching-event validation plus the signed teaching-event ID and durable idempotency key remain necessary; changing signing rules requires coordination.
- Fixed timestamps/signatures across retries must stay within the five-minute window. A later manual retry needs a newly signed submission policy agreed with the AI engineer.
- An expired webhook lease must not allow an old worker to commit; the final persistence transaction needs a claim-token fence. Do not hold a transaction open for embeddings or LLM calls.
- Two distinct teaching events can generate the same question concurrently. Webhook-key uniqueness alone cannot solve semantic question-bank races; canonical-question constraints/locking must be designed with the real existing repository.
- `accepted_async` is a generator response possibility, not permission to return HTTP 202 from this webhook.
- A successful generator HTTP 200 with degraded `webhook_status` is not a completed revision batch.
- No remote migration, production data mutation, deployment, or outgoing generation request has been performed.

## Environment presence observed

Configured locally: `CONCEPT_EXPLAINER_API_URL`, `AI_SERVICE_API_KEY`, `AI_SERVICE_CALLBACK_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `ELEARNING_DATABASE_URL`, `CRON_SECRET`, `ADMIN_EMAIL`, `RESEND_API_KEY`. Presence does not prove provider delivery or remote deployment configuration.

Missing locally: dedicated `AI_WEBHOOK_SECRET`. Legacy `AI_SERVICE_URL` is absent, but the existing client already accepts the configured Concept Explainer URL alias. Do not require a redundant second URL or reuse the API key as the HMAC secret.

No existing secret values were overwritten or included in this report.

## Re-audit of repeated task — 16 November 2026

The newly attached task is byte-identical to the original implementation request. The previously missing components now exist in `services/e-learning/revision-questions/`, the Study Zone revision panel, the four revision API route groups, and the twelve `Revision*` E-Learning models. Reuse these components, the existing Prisma singletons, `ts-fsrs@6.0.0`, pgvector and existing admin notifications. Do not add another question bank, embedding space, scheduler or queue. The user's approved five-condition pass rule and independent 1536-dimensional question-bank embedding decision remain authoritative.

The user subsequently authorized applying the Supabase patches and enabling both local revision flags; those actions completed and were verified. Historical prerequisite/pending statements above refer only to the original audit.

Re-audit finding: the administrator's exact-original-delivery replay invokes the synchronous webhook but does not declare the webhook's hosting duration budget. Add `maxDuration=300` on that admin route and cover authenticated exact replay through the real receipt/transaction path. This requires no database migration and does not broaden recovery permissions.

Implementation sequence: (1) add the admin route duration setting; (2) exercise administrator replay against disposable local PostgreSQL/pgvector with provider calls forbidden on completed replay; (3) rerun revision security/database/browser checks and build/type checks; (4) refresh the integration/deployment report, including environment readiness and external callback/scheduling limitations. Docker Desktop was not running at audit start; start it only for isolated local verification. No new production schema/data mutation or application deployment is required by this re-audit.
