# Concept Explainer ingestion integration

Updated 2026-11-04. This document supersedes the earlier integration contract, which incorrectly assumed ZIP support, safe duplicate POST replacement, synchronous completion, and reliable callback delivery.

## Existing architecture and implementation

E-learning uses `prisma/elearning/schema.prisma`, its generated client, and `ELEARNING_DATABASE_URL`; Core/Marketplace uses a separate client. Do not put remote chunks/jobs into either Prisma schema or query the AI schema directly. Existing lecturer offering checks, course/session/semester relationships, week ranges, Supabase bucket configuration, browser-to-Storage uploads and 8 MB upload limit remain in place.

`confirmUpload` atomically creates `CourseMaterial` and its unique `AiIngestTask`. Only `NOTES` in PDF, DOCX or PPTX format are eligible. ZIP notes get `UNSUPPORTED_FORMAT`; assignments and quizzes get no task. Originals remain accessible regardless of AI outcome. Pending tasks are durable even when integration processing is disabled.

`GET /api/cron/ai-ingest` uses the existing `CRON_SECRET` guard and runs a bounded batch. The existing checkout cron route documents that this project’s plan supports daily crons only, so Vercel configuration includes a daily fallback. Configure an authenticated external scheduler every five minutes for prompt ingestion. The handler allows up to 300 seconds; verify the deployment function limit supports that setting, or lower its batch and time budget. No unawaited request work or new permanent file storage is involved.

Workers use a conditional database claim, unique claim token, 90-second lease and 15-second HTTP timeout. They generate fresh one-hour signed URLs immediately before submission, and map metadata from the material's actual offering, curriculum, course, academic session and semester. They never log signed URLs or arbitrary upstream errors. A valid `202 {"status":"queued","document_id":"..."}` records admission, **not** completion. The lecturer badge says queued; there is no fabricated processing-start event.

Tasks use READY, CLAIMED, ACCEPTED, RETRY, DONE and ATTENTION states. Temporary pre-submission failures and idempotent DELETE failures retry with bounded exponential backoff and jitter. Expired POST claims, ambiguous POST outcomes, processing failures, expired callback waits and exhausted retries require review. No automatic second POST is made after a potentially accepted submission. Explicit authentication/validation rejections permit administrator retry after correction; unknown outcomes do not.

`POST /api/webhooks/ai-ingest` authenticates the callback using a timing-safe comparison. Success requires a positive integer chunk count. Updates require an associated task with a recorded submission. The first terminal callback wins; duplicates are acknowledged without changing results. Unknown/deleted/unassociated IDs return `200 {"ok":true,"ignored":"unknown document_id"}`. Deletion tasks ignore ingestion callbacks. Arbitrary processing errors are reduced to safe classifications.

Lecturer deletion first persists a DELETE task, then uses the existing Storage deletion and material deletion workflow. `onDelete: SetNull` retains the task's stable document ID. Cleanup accepts 204/404 and retries independently of the removed original. An active POST lease delays cleanup. If processing may still be running, a successful DELETE stays ATTENTION: the current service does not document worker cancellation and could recreate embeddings afterward. Do not claim race-free remote deletion until that contract is strengthened.

DAPU's dashboard links to `/e-learning/dapu/ai-ingestion`, which shows task totals, outstanding tasks, attempts, timestamps and safe errors. Only DAPU can retry reviewed tasks, and remotely submitted ingestion IDs cannot be reset through this action. Original access and retrieval/Stewart functionality are outside this integration change.

## Verified HTTP contract and remaining dependencies

Public `/health` and `/openapi.json` were inspected on the supplied Railway deployment on 2026-11-04. Health reported `status=ok`, `ingest_status=ready`, `worker_status=running`, `worker_count=1`, `provider=gemini_enterprise`, version 1.2. Published routes contain ingestion, document deletion, health and an unrelated grounding endpoint. **No job-status endpoint exists.** No separate Concept Explainer repository/README was available in this workspace; queue semantics and limitations below also rely on the supplied project brief.

- POST `/ingest`: Bearer `AI_SERVICE_API_KEY`; required fields `document_id`, `file_url`, `file_name`, `mime_type`, `callback_url`, `metadata`. Metadata includes course code/title/offering, academic session, semester, start/end weeks, weeks array, material type/title and document ID.
- DELETE `/documents/{document_id}`: same Bearer key; 204 or 404 confirms current records removed.
- Callback: Bearer `AI_SERVICE_CALLBACK_SECRET`; `{document_id,status:"ingested",chunk_count:N}` or `{document_id,status:"failed",error:"..."}`; receiver returns literal `ok:true` JSON.

Production readiness, embedding credentials/billing, service migration installation, matching deployment secrets and actual end-to-end ingestion have **not** been verified. Health alone cannot establish these. The hostname is not evidence of production readiness.

Required Concept Explainer changes, to agree with its engineer before implementing an enhanced adapter:

1. Safe idempotent POST requeue: accept refreshed signed URL and changed metadata, replace the stored payload, reject concurrent attempts safely, and return a stable `attempt_id`/version echoed in callbacks. Define which non-2xx responses guarantee no admission. Existing duplicate POSTs do not satisfy this.
2. Proposed GET `/documents/{document_id}/status`: authenticated response with document ID, attempt ID, queued/processing/completed/failed/deleted state, chunk count on completion, sanitized error code and explicit `retryable` flag on failure. This endpoint is a proposal, not a deployed capability.
3. Durable callback delivery and/or status reconciliation, retaining terminal outcomes long enough for polling. Current three-attempt best-effort callbacks can be permanently lost.
4. DELETE must invalidate running/queued attempts and prevent later chunk writes, with documented atomic cancellation/tombstone semantics. A 204 must mean deletion cannot be undone by an older worker.

The AkadVerse worker deliberately preserves uncertainty pending these improvements. Full automatic processing recovery and confirmed cleanup of in-flight remote jobs remain blocked on this service contract. Metadata-only/file replacement workflows are not currently provided by the material service; any future replacement must use versioned attempts and reject stale callbacks before allowing re-ingestion. Do not implement replacement as another blind POST with the same ID.

## Configuration and deployment

Server-only values (never `NEXT_PUBLIC_`):

| Variable | Purpose |
| --- | --- |
| `CONCEPT_EXPLAINER_API_URL` | Service origin; legacy `AI_SERVICE_URL` remains supported |
| `AI_SERVICE_API_KEY` | Outbound ingestion/deletion Bearer key |
| `AI_SERVICE_CALLBACK_SECRET` | Inbound callback Bearer secret |
| `APP_BASE_URL` | Public HTTPS application origin; fallback `NEXTAUTH_URL` |
| `AI_INGEST_ENABLED` | Must equal `true` for workers to process tasks; disabled by default |
| `CRON_SECRET` | Existing scheduler authentication secret |
| `AI_INGEST_MAX_ATTEMPTS` | Optional, default 5, capped at 20 |
| `AI_INGEST_RETRY_BASE_SECONDS` | Optional, default 60, capped at 3600 |
| `AI_INGEST_RETRY_MAX_SECONDS` | Optional, default 3600, capped at 86400 |

`AI_SERVICE_CALLBACK_ALLOWED_HOSTS=akadverse.vercel.app` belongs on **Concept Explainer**, along with matching shared secrets. AkadVerse never needs the remote embedding provider key or remote database credentials.

1. Start in an isolated staging environment. Keep `AI_INGEST_ENABLED=false`. Ensure the application has its normal Storage/database secrets and configure the shared values above in the deployment environment; local `.env` values are not automatically deployed.
2. Deploy the E-learning schema using the existing `npm run db:elearning:push` convention, then regenerate its client (`npm run db:elearning:generate`). No Core/Marketplace migration is needed. A reviewable incremental SQL alternative is `prisma/elearning/patches/20261104_ai_ingestion_outbox.sql`, for a database already containing the earlier AI fields; apply it **instead of** db push, not after it. This is a standalone E-learning patch, not a Core Prisma migration. Fresh environments should use db push.
3. Run `npm run ai:ingest-backfill -- --dry-run`, then `npm run ai:ingest-backfill`. This adopts historical submissions for reconciliation without resending them, and queues only previously unsent notes. Run before accepting historical callbacks with the new task checks. Existing remotely ingested assignments/quizzes also retain their identities for cleanup.
4. Configure the external scheduler, enable the staging worker and invoke its authenticated cron endpoint. Upload an isolated real note; confirm a positive chunk count callback, service-owned embeddings via the AI engineer, and continued access to the original. Test unsupported files, authorization, deletion, callback loss, worker crashes and failures. Do not use production lecture notes for destructive tests.
5. Agree and validate the remote recovery/cancellation contracts above before claiming all reliability acceptance criteria. Promote only after staging passes and deployment readiness is confirmed. Keep production processing disabled otherwise.

## Files in this change

- `prisma/elearning/schema.prisma` and `patches/20261104_ai_ingestion_outbox.sql`: integration task, relation, statuses and incremental schema patch.
- `services/e-learning/ai-ingest/{client,ingest-material,policy,worker}.ts`: HTTP contract, enqueue/callback/cleanup logic, eligibility/error/retry policy, durable worker and reviewed retry.
- `services/e-learning/faculty/materials/{upload-material,delete-material}.ts`: atomic enqueue and durable cleanup hooks.
- `src/app/api/{cron/ai-ingest,webhooks/ai-ingest}/route.ts`: authenticated processing and callback routes.
- `src/app/e-learning/faculty/my-subjects/[offeringId]/{actions.ts,AiIngestBadge.tsx,page.tsx}`: remove direct sending, accurate statuses and safe controls.
- `src/app/e-learning/dapu/ai-ingestion/{actions.ts,page.tsx}` and `dapu/dashboard/page.tsx`: authorized visibility and retry.
- `scripts/ai-ingest-backfill.ts`, `vercel.json`, `.env.example`: rollout, scheduler and documented settings. Local `.env` was updated; it is ignored by Git.
- `tests/elearning/ai-ingest{,-policy}.test.ts`, `tests/helpers/fake-providers.ts`: policy/HTTP and local-DB workflow tests.
- This document and `course-materials-system.md`: current contract and rollout notes.

## Validation

Seven independent policy/HTTP tests pass. TypeScript and scoped ESLint pass. Prisma client generation passes. The ten local PostgreSQL workflow tests were attempted but failed in setup because `127.0.0.1:5433` is unavailable and Docker is not running; no workflow assertions ran. They must pass before rollout:

```
npm run db:local:up
npm run test:db:setup
node --import tsx --test tests/elearning/ai-ingest-policy.test.ts tests/elearning/ai-ingest.test.ts
```

No production database migration, upload, ingestion, deletion or deployment was performed.
