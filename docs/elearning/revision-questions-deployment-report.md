# Revision generation implementation and deployment report

Updated 16 November 2026 after re-auditing the repeated task against the existing implementation. The new attachment is identical to the original request. This report records current state; it does not claim a fresh deployment or a real external callback test.

## Architecture and ownership

AkadVerse owns the twelve `Revision*` tables in its E-Learning Supabase database, the pass decision, generation jobs, exact-byte webhook authentication, receipts, question embeddings/deduplication, question variants, student cards/reviews, alerts and recovery. The external Concept Explainer service owns revision generation, its prompts, wire-format transformation, signing and submission. Its separate RAG database is not used for our question bank.

Reused: existing E-Learning/Core Prisma singletons, existing student material access checks, existing service origin/API key conventions, existing cron bearer authentication, PostgreSQL/pgvector, and existing admin in-app notifications. The new subsystem was necessary because the original audit found no teaching tracker, question bank or FSRS implementation; the user confirmed this and approved the pass rule and independent embedding choice. There is one question bank and one FSRS scheduler, not parallel systems.

The teaching milestone is a saved independent practice evaluation meeting all five user-approved conditions. Its taught summary is constructed from trusted concept description/objective; it is not a transcript-derived summary of a separate lesson session. This integration does not provide a complete lesson-session/resume/concept-mastery dashboard.

## Database state

The user explicitly authorized remote migrations and activation earlier in this conversation. The Core `20261115000000_productivity_ai_assistant` migration and the three E-Learning patches were applied successfully. This re-audit does not apply them again.

Read-only re-verification found all twelve revision tables and pgvector 0.8.2. The previous migration verification also confirmed the HNSW cosine index, embedding model/version/dimension lock and application ORM reads. Existing course/material/user tables are reused. No new migration is needed for the re-audit's recovery-route duration adjustment.

Question/vector/card/provenance/receipt completion writes share a short transaction. AI calls occur outside it. Per-scope locks and candidate snapshot checks protect cross-delivery races. Unique student/question cards preserve existing memory/review state. Receipt keys/hash/claim tokens fence duplicate and abandoned deliveries. Card review uses row locks, optimistic versions and stable replay keys.

## Current implementation map

| Area | Location |
|---|---|
| Models and relations | `prisma/elearning/schema.prisma`, twelve `Revision*` models |
| SQL patches | `prisma/elearning/patches/20261115_revision_*.sql` |
| Raw-body HMAC and timestamp security | `services/e-learning/revision-questions/security.ts` |
| Wire format and result validation | `services/e-learning/revision-questions/contract.ts` |
| Atomic receipts and lease fencing | `services/e-learning/revision-questions/idempotency.ts` |
| Trusted event checks, preparation and atomic persistence | `services/e-learning/revision-questions/processing.ts` |
| Canonical text, model locks, scope and pass policy | `services/e-learning/revision-questions/policy.ts` |
| Embedding, semantic judgment and AI API adapter | `services/e-learning/revision-questions/providers.ts` |
| Official FSRS library integration | `services/e-learning/revision-questions/scheduler.ts` |
| Owned practice/evaluation/card/review workflow | `services/e-learning/revision-questions/students.ts` |
| Analysis/generation claims, reconciliation and alerts | `services/e-learning/revision-questions/worker.ts` |
| Thin synchronous webhook | `src/app/api/webhooks/tutor/questions/route.ts` |
| Scheduled worker | `src/app/api/cron/revision-generation/route.ts` |
| Student API | `src/app/api/e-learning/revision/route.ts` |
| Admin status/replay/capacity recovery | `src/app/api/e-learning/admin/revision-generation/route.ts` |
| Study Zone UI | `src/app/e-learning/student/study-zone/_components/RevisionPracticePanel.tsx` |
| Tests | `tests/revision-questions/` and browser/live verification scripts |

## Re-audit change

The administrator route can synchronously replay an authenticated original delivery through the webhook. It now declares `maxDuration=300`, matching the webhook's hosting execution allowance. This setting is deployment metadata, not a guarantee that a hosting plan permits 300 seconds.

A new real-database regression exercises the admin endpoint: non-admin denial, admin exact-original replay, no external provider call, identical results, one card, one provenance record and no additional receipt attempt. No student or question data was changed remotely during re-audit.

## Environment checklist

### Already configured locally

Readiness checks confirmed presence of `AI_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `CONCEPT_EXPLAINER_API_URL`, `AI_SERVICE_API_KEY`, `CRON_SECRET`, application origin settings and the existing Core/E-Learning database URLs. Both `REVISION_QUESTIONS_ENABLED` and `REVISION_GENERATION_ENABLED` are true in ignored `.env.local`, as previously authorized. No secret values are included in this report.

### Required but missing locally

No required variable was missing in the re-audit's presence checks. Presence is not verification that the external producer shares the same secret or that a public callback is deployed.

### Optional / compatibility settings

`AI_SERVICE_URL` remains the legacy fallback for `CONCEPT_EXPLAINER_API_URL`; configuring both is unnecessary. Keep dedicated webhook signing and provider/service credentials separate. A conventional process-local student rate limiter is included; a distributed quota mechanism is not implemented.

### Production deployment settings and external dependencies

- Deploy the current application with Node 24+ and the matching generated Prisma clients.
- Configure the variables in the target hosting environment; local `.env.local` edits do not update Vercel.
- Configure and verify the producer's public HTTPS callback URL and dedicated shared secret.
- Confirm a sender per-attempt timeout of at least 30 seconds and exact-body retries. The known 10-second timeout is not guaranteed to accommodate cold starts or larger batches.
- Set up a regular authenticated worker schedule. `vercel.json` currently provides a daily fallback, not minute-by-minute student delivery.
- Verify that the hosting plan supports the route execution budgets and appropriate database pool limits; existing Prisma singletons are reused.
- Ensure an appropriate Core administrator exists and verify its actual in-app alert delivery. No external email/phone delivery was added.
- Define learning-payload retention/purge operations according to the application's data policy.

These are deployment/coordination requirements, not missing database tables. No push, merge, hosting environment mutation or application deployment was performed during this re-audit.

## Monitoring and recovery

Admin GET exposes readiness, status counts, generated/created/reused/rejected/card totals, average recorded processing time, recent failures, analysis work and pending alerts. Logs allow traceability through correlation/event IDs without raw bodies, keys or signatures. Repeated failures, uncertain dispatches and partial rejection use the existing administrator notification channel through a durable outbox. Delivery is at least once.

Original-delivery replay uses saved authenticated bytes and the original teaching key. It does not generate a new batch. Quarantined capacity release requires explicit remote-stop confirmation. Once an external generation might have started, do not blindly dispatch it again. Preserve the passed event and investigate/reconcile the remote operation first.

Rollback: stop generation dispatch, disable the receiver/student feature if needed, preserve receipts/questions/cards/reviews, reconcile outstanding remote work and roll forward reviewed schema corrections. Do not drop learning tables or reset student schedules to roll back application code.

## Verification

Current re-audit security/idempotency/learning/recovery suite: **59/59 passed** using isolated local databases. Browser interaction verification: **8 passed** with isolated API fixtures. TypeScript and focused ESLint passed. The published external AI OpenAPI returned HTTP 200 and still exposes the expected revision generation endpoint and response fields. Both remote generation and analysis queues were empty at the read-only check; no real generation was dispatched for this audit.

Earlier live provider-backed local receiver measurement: one card committed with HTTP 200 in 2,647 ms; exact stored replay 56 ms and no duplicate. This was not a deployed external-producer-to-webhook test. Fresh full application regression suite: **387/387 passed**, no failed or skipped tests. The normal Next.js production build passed. The production artifact audit checked 2,631 JS/JSON artifacts with zero configured-secret matches and zero unsafe environment traces. The tracked browser-profile artifact guard passed.

## Engineer handoff

Use the root `REVISION-QUESTIONS-WEBHOOK-INTEGRATION.md` for the exact headers, body/result schema, outcome enums, error codes, idempotency/retry rules and manual staging checklist. Synchronous processing and exact replay are implemented and verified locally. A public deployed callback URL and a complete real producer-to-AkadVerse run remain unverified; do not label them live based on a local test.
