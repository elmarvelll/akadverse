# AkadVerse revision questions: integration and testing guide

Updated 16 November 2026. Implementation is on the local `productivity-layer-integration` working tree. **Update: the user authorized Supabase migration and local activation on 16 November 2026.** The Core assistant migration and all three E-Learning patches have now been applied to the configured Supabase databases. All 16 tables, pgvector 0.8.2, the cosine index, the model lock and application ORM reads were verified. Both revision flags are now `true` in the ignored local `.env.local`; example defaults remain off. No application deployment, push, remote hosting environment update, or public callback verification has been performed.

## 1. What this feature does

A student studies an ingested course material, prepares its concepts, and answers an independent practice question with an explanation of their reasoning. AkadVerse asks the AI evaluator to assess the server-saved question. If the teaching stage passes, AkadVerse saves a teaching event and queues background revision generation. The student does not wait for revision generation to finish.

The AI service generates up to five revision questions and sends them to AkadVerse's signed webhook. AkadVerse validates the questions, checks the shared question bank for duplicates, creates or reuses questions, and creates each student's own spaced repetition cards. A successful webhook response contains the final persisted question and card IDs.

The shared bank reduces repeated questions. Students share question content; they never share review history, due dates, or FSRS state.

This work includes the previously absent teaching tracker, question bank, semantic deduplication, scheduler, background jobs, recovery operations, and student practice/review panel. The original audit is in [revision-questions-audit.md](docs/elearning/revision-questions-audit.md); it describes the starting state, not the completed implementation.

## 2. Passing a teaching stage

All five conditions must hold in the **server-saved AI evaluation**:

| Field | Required value |
|---|---|
| `answer_correct` | `true` |
| `evidence_strength` | `independent` |
| `reasoning_quality` | `adequate` or `strong` |
| `needs_review` | `false` |
| `recommended_next_step` | `progress` |

A browser cannot submit a passing grade, expected answer, or arbitrary teaching event. The evaluator receives the question and expected answer loaded by the server from the saved practice attempt. Repeating evaluation with the same answer replays the saved evaluation. Changing an already evaluated answer requires a new practice attempt.

One passed practice attempt has one teaching event and one durable generation job. A student's later FSRS self-rating does not create another teaching event or generation request.

## 3. Endpoints and ownership

| Endpoint | Purpose | Authentication |
|---|---|---|
| `POST /api/webhooks/tutor/questions` | Synchronous signed question delivery | Dedicated HMAC secret |
| `GET/POST /api/e-learning/revision` | Concepts, practice, evaluation, own cards and reviews | Current student session and saved Core role |
| `GET /api/cron/revision-generation` | Durable analysis/generation sweep and alert delivery | Existing cron bearer secret |
| `GET/POST /api/e-learning/admin/revision-generation` | Metrics, failures, original delivery replay, confirmed capacity release | Existing administrator authorization |

Student course/material access uses the existing registration, approval and academic-calendar checks. Student IDs come from the session. Card reveal, review and generation status are restricted to the owning student. Responses are private and uncached.

The student POST actions are `prepare_concepts`, `practice`, `evaluate`, `reveal`, and `review`. Practice/evaluation carry the existing study context (`courseId`, `weekNumber`, `documentId`). Practice has a stable `requestId`; evaluation uses `attemptId`, `answer`, and `reasoning`. Reviews carry `cardId`, rating 1–4, the current card `version`, and a stable `requestId`.

## 4. Webhook wire contract

```http
POST /api/webhooks/tutor/questions
Content-Type: application/json
X-Akadverse-Signature: <hex HMAC-SHA256 of the exact request body bytes>
X-Akadverse-Timestamp: <current UTC ISO-8601 timestamp>
Idempotency-Key: teach_<teaching_event_id>
```

Use `AI_WEBHOOK_SECRET`, independent from the service API key and ingestion callback secret. The receiver authenticates raw bytes before parsing JSON, uses constant-time signature comparison, and limits bodies to 256 KiB. It rejects timestamps older than five minutes or more than 30 seconds ahead. UTC `Z` and `+00:00` timestamps are accepted. Synchronize both services' clocks.

The agreed HMAC signs the body only. It does not cryptographically bind the timestamp header. The timestamp window is therefore an additional check; durable body-hash idempotency provides protection against repeated question/card writes.

```json
{
  "event_id": "32e19f6a-bb46-4e71-82bb-9ea6cb095339",
  "teaching_event_id": "<server-created teaching event ID>",
  "student_id": "<event's student ID>",
  "occurred_at": "2026-11-16T10:00:00.000Z",
  "context": {
    "subject": "Mathematics",
    "curriculum": "Example curriculum",
    "level": "SS2",
    "topic": "Quadratics",
    "concept_id": "<AI concept ID>",
    "concept_title": "<exact concept description sent for generation>",
    "language": "en"
  },
  "taught_summary": "<exact summary sent for this teaching event>",
  "questions": [{
    "client_ref": "q1",
    "type": "short_answer",
    "stem": "What does a negative discriminant imply?",
    "correct_answer": "There are no real roots.",
    "explanation": "The quadratic formula would require the square root of a negative number.",
    "difficulty_estimate": 0.4,
    "bloom_level": "understand",
    "tags": ["discriminant"]
  }]
}
```

`event_id` is UUIDv4. There must be 1–5 questions and unique `client_ref` values. Supported types are `mcq`, `short_answer`, and `true_false`; Bloom levels are `remember`, `understand`, and `apply`; difficulty is a finite number from 0 to 1. MCQs have 2–8 `{key,text}` options and a correct answer matching an option key. Short answers use nonempty text. True/false accepts a boolean or the strings `true`/`false`. Unknown fields and malformed batches are rejected. The validator contains the full size limits in [contract.ts](services/e-learning/revision-questions/contract.ts).

The context, student and taught summary must match the trusted saved teaching event. The producer currently maps its `concept_description` to webhook `context.concept_title`; the receiver verifies that exact contract.

Successful response:

```json
{
  "teaching_event_id": "<same event>",
  "status": "processed",
  "results": [{
    "client_ref": "q1",
    "question_id": "<persisted global question ID>",
    "student_card_id": "<persisted student's card ID>",
    "outcome": "created"
  }]
}
```

Every input reference receives one ordered result. Outcomes are `created`, `reused_existing`, `created_variant`, and `rejected_invalid`. A semantically invalid question has null question/card IDs; valid questions in that batch can still commit. Structural/authentication/context failures reject the request before question writes.

HTTP 200 means the transaction committed. The endpoint never returns 202. Provider outages and processing contention return retryable failures, not manufactured successful IDs. Different bytes under an existing idempotency key return 409. See [handler.ts](services/e-learning/revision-questions/handler.ts) and [errors.ts](services/e-learning/revision-questions/errors.ts) for error handling.

| HTTP status | Meaning / sender action |
|---|---|
| 200 | Committed results or exact completed replay |
| 400 | Invalid payload/key/trusted event context; investigate before resending |
| 401 | Signature or timestamp failure; correct credentials/clock |
| 409 | Same key with different body; resend the original bytes |
| 413 / 415 | Body too large / unsupported content type |
| 503 | Disabled/unconfigured feature, active claim, provider outage or retryable bank race; honor `Retry-After` |
| 500 | Unexpected processing error; retry original bytes after investigation |

Retries must retain the same teaching-event key and identical body bytes, including `event_id` and `occurred_at`. Refresh only the timestamp header/signature as needed. Do not generate a new payload to recover a lost acknowledgment.

## 5. Idempotency and transactions

The receipt stores the exact body hash, authenticated original bytes, a claim token, lease, attempts, and the exact serialized completed response. Concurrent requests cannot both own the same delivery. An active owner causes a retryable response; an expired lease can be taken over using a fenced update. Completed identical deliveries replay the stored response without embedding, judging, resetting cards, or creating duplicates.

AI and embedding requests happen before the final transaction. The final transaction takes ordered scope locks, verifies that its candidate snapshot remains current, writes the questions/vectors/cards/provenance, updates generation counts, and commits the receipt response atomically. A changed bank snapshot produces a retry rather than an unchecked duplicate. A failure rolls everything back. Existing student cards are read and reused; they are never reinitialized.

The webhook claim lasts three minutes. Final database work has a 15-second transaction timeout. Provider preparation has an 8.5-second abort budget; this is **not** a guarantee that the whole webhook completes in 8.5 seconds because database operations and commit also take time.

## 6. Question bank and duplicate decisions

AkadVerse's independent embedding space is locked to:

| Setting | Value |
|---|---|
| Provider | Gemini API, AkadVerse-side credential |
| Model | `gemini-embedding-2` |
| Dimensions | 1536 |
| Internal embedding format version | `revision-v1` |
| Semantic judge | `gemini-3.5-flash-lite`, minimal thinking |

These vectors are never compared to the AI engineer's 768-dimensional ingestion/RAG vectors. No cross-service dimension or model contract is required.

Each question's canonical text includes its type, concept/objective, subject/curriculum/level, question, correct answer, sorted option texts and explanation. MCQ answer labels are resolved to option text. Mathematical case and code indentation are preserved. Exact canonical hashes reuse the existing question without provider calls.

Semantic retrieval uses pgvector cosine search within the trusted concept/context/type/language scope. Below 0.85 is a new candidate. Similarity 0.85–0.92 and above 0.92 both require a judge decision. Similarity alone never discards a question. The judge sees the complete question, answer, options and concept context and can choose duplicate, useful variant, different question, or invalid. Useful variants point to their canonical root. Questions within the same incoming batch are compared too. Provider failure or an oversized ambiguous candidate set fails safely for retry; it never silently treats all questions as unique.

Every new question is also checked against its trusted concept. Provenance saves the event/reference/outcome and deduplication metadata. Database checks enforce model/version/dimension identity. Changing model, canonical format, or dimensions requires an explicit re-embedding migration; do not mix vector spaces in the existing bank.

Gemini embedding inputs are sent separately per question because multiple content parts can represent one aggregated embedding. See the [official embedding documentation](https://ai.google.dev/gemini-api/docs/embeddings).

## 7. Spaced repetition

The scheduler uses pinned `ts-fsrs@6.0.0`, FSRS-7 defaults, without invented scheduling formulas or custom parameters. It requires Node 24 or later. New cards are initialized through the library; review ratings are Again=1, Hard=2, Good=3, Easy=4. See the [official quick start](https://open-spaced-repetition.github.io/ts-fsrs/guide/quick-start).

Each student/question pair is unique. Reviews lock the card, enforce its optimistic version, save the prior/next states and scheduler log, and update the due date in one transaction. Stable review request IDs replay the original result. A stale or conflicting review cannot overwrite a newer schedule.

## 8. Background generation, alerts and recovery

Concept preparation queues analysis for an already ingested material. The worker calls the existing `/analyse-material`, validates its actual response, and saves concepts with trusted academic metadata. Practice uses `/generate-practice`; assessment uses `/evaluate-practice`. A passed stage queues `/generate-revision-questions` with its saved context.

The worker uses a database advisory lock and limits active external analysis/generation work to two slots across instances. Each sweep processes at most three jobs within a bounded time. Pre-dispatch failures can retry with backoff. Once a generation request might have reached the producer, AkadVerse does not blindly generate another batch. It reconciles the local webhook receipt or quarantines the uncertain job for review. Uncertain remote work retains its slot until an administrator confirms it has stopped.

The cron in `vercel.json` is a daily fallback. For responsive student feedback, configure an authenticated external scheduler to invoke the same endpoint regularly, for example once a minute, subject to hosting capacity. No detached browser request or untracked in-process background task is used.

Alerts use a durable outbox and the existing administrator in-app notification service. Repeated webhook processing failure, partial question rejection and uncertain jobs are visible operationally. Delivery retries use backoff. Alert delivery is at least once: a crash after notification delivery but before marking the outbox row delivered can repeat a notification. This integration does not send external email. Configure at least one Core account with `isAdmin=true`; the existing notifier has no recipients when there are no administrators. Actual deployed alert delivery has not been verified.

Administrator GET exposes feature/config readiness, job status counts, generated/created/reused/rejected/card totals, average recorded generation duration, recent failures, analysis jobs and pending alerts. Structured logs record correlation IDs and counts without signing secrets, provider keys or raw bodies.

Recovery POST examples (administrator session required):

```json
{"action":"replay_delivery","confirmReplay":true,"teachingEventId":"<event>"}
```

This replays the stored, originally authenticated bytes internally with a fresh timestamp/signature. It does not regenerate questions or expose the HMAC secret. If the original delivery never reached AkadVerse, the producer must resend its original bytes with the original idempotency key; the operator must investigate the remote request before authorizing any new generation.

```json
{"action":"release_confirmed_stopped","confirmRemoteStopped":true,"kind":"generation","jobId":"<job>"}
```

Only use this after confirming the remote operation has stopped. It releases quarantined capacity and marks original delivery replay required; it does not authorize regeneration. `kind:"analysis"` can release a failed analysis for a bounded retry. Keep the failed event and receipt for investigation.

## 9. Database rollout and environment

The E-Learning schema uses reviewed SQL patches rather than a Prisma migrations folder. Back up and inspect the target before applying anything. Apply in this order:

1. `prisma/elearning/patches/20261115_revision_webhook_idempotency.sql`
2. `prisma/elearning/patches/20261115_revision_learning.sql`
3. `prisma/elearning/patches/20261115_revision_delivery_recovery.sql`
4. Regenerate the E-Learning Prisma client and deploy the matching application.

The learning patch creates pgvector, new tables, relationships, the HNSW index and the model lock. It assumes those learning tables do not already exist; it is not a repeatedly runnable migration. The receipt/recovery patches include additive guards. Do not use an unreviewed production `db push` to resolve drift. Confirm managed PostgreSQL supports pgvector and the extension can be created; the patch uses `public,extensions` search path for common extension locations.

Fresh local setup uses the pgvector-enabled Docker image, `extensions.sql`, schema push, and `constraints.sql`. The guarded local reset reinstalls the extension before creating vector columns; a plain Prisma force-reset removes the extension first and fails. Existing plain-Postgres Docker volumes need a planned pgvector-capable server upgrade; do not delete a volume to work around a missing extension.

Required server configuration:

```dotenv
AI_WEBHOOK_SECRET=<dedicated shared secret>
GEMINI_API_KEY=<AkadVerse embedding/judge credential>
CONCEPT_EXPLAINER_API_URL=<trusted AI service origin>
AI_SERVICE_API_KEY=<existing service API credential>
CRON_SECRET=<existing cron credential>
REVISION_QUESTIONS_ENABLED=false
REVISION_GENERATION_ENABLED=false
```

Use the existing E-Learning/Core database URLs. Never expose these credentials through `NEXT_PUBLIC_*`. Configure the producer's callback to the deployed HTTPS `/api/webhooks/tutor/questions` URL with the same dedicated secret. The receiver flag enables delivery and the student feature; the generation flag enables worker dispatch. Enable the receiver first after schema/config verification, then enable scheduled generation. The example defaults are off. The user has explicitly authorized local activation against the migrated configured databases; a real producer-to-public-callback test and remote scheduler setup remain outstanding.

### Rollback

Disable generation dispatch first, then disable the receiver/student feature if needed. Preserve receipts, passed events, question provenance and review history; do not drop tables to roll back application code. Confirm any submitted remote work has stopped before releasing its capacity. Roll forward a reviewed schema correction rather than overwriting existing cards or embedding rows. Re-enable only after replay/reconciliation and staging checks.

## 10. Latency contract with the AI engineer

Embedding and judging are synchronous in the receiver; HTTP 200 is returned only after populated results are committed. They are not queued behind a 200 or 202.

A live synthetic single-question test of the optimized receiver, using real Gemini embedding/judge calls and disposable local PostgreSQL records, returned **HTTP 200 in 2,647 ms** and created one student card. Exact replay returned the identical response in **56 ms**, with one card still stored. An earlier unoptimized run took **14,709 ms**. These are individual measurements, not a percentile or a production SLA.

The producer's current 10-second timeout cannot be guaranteed across cold starts, provider variability, five-question batches and database latency. **Coordinate at least a 30-second per-attempt webhook timeout before rollout**, subject to the producer's hosting limits. Keep exact-body retries and fresh timestamp headers. If a sender times out while the receiver commits, retrying the same delivery safely obtains the stored response. Larger-batch and deployed p95/p99 latency still need staging measurement.

## 11. How to test manually

1. Use an isolated staging student registered for an approved course with an ingested material. Open its study workspace and expand **Practice & spaced revision**.
2. Load material concepts. If queued, run/wait for the authenticated worker, then refresh. Confirm another student's unregistered material cannot be accessed.
3. Start independent practice. Confirm no expected answer is revealed before evaluation. Submit an answer and reasoning; check the saved evaluation. Verify that failing any of the five conditions creates no passed event.
4. Pass a new attempt. Confirm one teaching event/job, a prompt browser response, and a background generation status. Repeating the same evaluation must not add jobs.
5. Let the real producer call the staging webhook. Inspect its synchronous response, saved receipt, question provenance, vector and card. Confirm all references have final results.
6. Resend identical signed bytes with the same key and a fresh timestamp. Expect exactly the same response and no extra card. Change the bytes under that key: expect conflict.
7. Try exact duplicates, paraphrases, useful numerical variants and genuinely different skills. Confirm question/card outcomes and that high similarity alone never rejects a useful question.
8. Use a second student and the same shared question. Confirm a separate card. Review one student's card and verify that the other's schedule is unchanged.
9. Reveal a due card and choose Again/Hard/Good/Easy. Verify review history and due date; replay the review request and attempt a stale-version review.
10. Simulate provider and notification outages. Confirm retryable failures, no partial question/card writes, preserved passed events, and pending alerts. Confirm uncertain generation is quarantined rather than blindly repeated.
11. Inspect the administrator endpoint; recover an original delivery only after investigating remote execution. Measure five-question/cold-start latency and sender retry behavior before enabling production.

## 12. Automated verification and remaining limits

Useful commands:

```sh
npm run test:revision:webhook
npm run test:revision:webhook:db
npm run typecheck
npm run build
node scripts/verify-revision-panel.cjs
```

Database tests require disposable loopback databases and pgvector. Set `TEST_DATABASE_URL` and `TEST_ELEARNING_DATABASE_URL` explicitly when using alternate local ports. Tests replace external providers with fixtures. The opt-in `REVISION_LIVE_PROVIDER_TEST=true npm run test:revision:live` uses a real provider credential from ignored `.env.local` and only synthetic content/local fixture rows; it can incur provider usage.

Verification completed locally on 16 November 2026:

| Check | Result |
|---|---|
| Full application regression suite | **386/386 passed**, no skipped tests |
| Revision protocol/security suite | **27/27 passed** |
| Receipt + learning database tests | **31 tests included in the passing full suite**, using real local PostgreSQL/pgvector and mocked external providers |
| Browser interaction checks | **8 passed**, real headless Chrome with isolated API fixtures |
| TypeScript check | Passed |
| Focused ESLint | Passed, no findings |
| Normal Next.js production build | Passed |
| Fresh pgvector schema/constraints bootstrap | Passed on a separate disposable probe database |
| Changed-source secret scan | No leaks found |
| Production artifact audit | 2,631 JS/JSON artifacts checked; no configured secret matches or unsafe environment traces |
| Tracked browser artifact guard | Passed |
| Live provider-backed signed receiver | HTTP 200, one card, 2,647 ms; exact replay 200, 56 ms, no duplicate |

The tests cover invalid authentication/body/context, five-condition passing, exact and semantic deduplication, threshold boundaries, intra-batch variants, concurrency/leases, stale dispatch prevention, transaction rollback, provider failure, alert retry, student ownership, independent schedules and review replay. The live provider smoke test is **not** an end-to-end test of the external producer calling a deployed callback. No public callback URL has been verified. Staging must still validate real producer payloads, managed extension support, hosting time limits, scheduled dispatch, and latency under load.

Additional operational limits: the student request limiter is process-local; concurrent initial practice requests can incur more than one provider call before the unique saved attempt wins. The saved question/evaluation/event remain unique. The current panel does not restore an unfinished practice form after a page reload; saved evaluations/cards remain durable. Database access to stored authenticated payloads must follow the same controls as other student learning records. Retention/purge policy is an operational follow-up.

## 13. Re-audit of the repeated implementation task

The task reattached on 16 November 2026 is identical to the original. Its implementation and previously authorized Supabase migrations are reused. The administrator synchronous original-delivery replay route now explicitly declares the webhook's 300-second hosting duration budget, and a new real-database endpoint test verifies admin authorization, exact response reuse, no provider calls and no duplicate cards/provenance. No additional database migration was required or rerun.

Fresh targeted revalidation: **59 revision tests passed**, **8 browser checks passed**, TypeScript and focused ESLint passed. Read-only checks confirmed all 12 revision tables, pgvector 0.8.2, both local flags enabled and all required local configuration present. The external service's published OpenAPI contract still matches. The detailed implementation map, current environment checklist, deployment dependencies and recovery boundaries are in [the deployment report](docs/elearning/revision-questions-deployment-report.md).

Final re-audit verification: **387/387 full-suite tests passed**, production build passed, and the 2,631-artifact credential/tracing audit and browser-artifact guard passed. These supersede the earlier 386-test baseline above. No new remote migration, generation dispatch or deployment was performed during this re-audit.

## 14. Standalone Revisions workspace upgrade

The separately requested standalone feature now lives at `/e-learning/student/revisions` with Course and Random modes, shared existing cards, saved answers/evaluations and sessions, publication/provenance checks and prepared learning evidence. Four additive tables and backend-only RLS across all 16 revision tables were applied to Supabase; no existing learning rows were reset. Local `REVISION_WORKSPACE_ENABLED=true` activation is complete. External generation/signing contracts are unchanged. See [the workspace implementation/release guide](docs/elearning/revisions-workspace.md). This later upgrade used focused tests only, as requested; the older full-suite counts above remain historical.
