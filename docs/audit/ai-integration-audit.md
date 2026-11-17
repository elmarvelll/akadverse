# Study Zone AI integration — Phase 0 audit

Status at audit: checkpoint, 17 November 2026. The subsequent approved implementation is documented in [the learning AI report](../learning-ai/README.md). No feature code, schema, deployment or production flag changes were made for this request. Existing uncommitted portal/productivity work is preserved.

## Scope and authority

Inputs: the supplied next-action integration brief and Study Zone full implementation brief. The latter §0 requires an audit matrix and approval before code; §17 requires approval at each major phase. This document is that review deliverable, not an implementation report.

Contract verified against the configured public service's `/openapi.json`: https://akadverse-concept-explainer-production.up.railway.app/openapi.json . Public schema excerpt, capture time and full-document SHA-256 are in [next-action-contract-snapshot.json](next-action-contract-snapshot.json). No inference request or paid generation was issued. Local credentials were checked only for presence; none are included here. Configuration inspection does not establish deployed Vercel configuration.

The original Handoff v2 §§2.4–2.6 was not located in the repository. The supplied Study Zone §12.4 contains a fallback table, but its equivalence to that handoff cannot be established. Do not invent the missing policy.

## Audit matrix: reuse and gaps

| Logical capability | Existing implementation / tables | Reuse and required addition |
| --- | --- | --- |
| Course authorization | `StudentProfile`, `CourseOffering`, `StudentCourseRegistration`; `services/e-learning/student/stewart/attachment-context.ts` and Study Zone services | Retain registration, offering and selected-week checks; recheck all orchestration targets server-side. |
| Material ingestion | `CourseMaterial`, `AiIngestTask`; `services/e-learning/ai-ingest/{client,worker,ingest-material}.ts`; `/api/webhooks/ai-ingest` | Reuse queued dispatch, callback/reconciliation and deletion. Callback uses `AI_SERVICE_CALLBACK_SECRET` Bearer; it is separate from revision HMAC. |
| Immutable material versions | Existing material ingestion identity and source fingerprints | No dedicated immutable material-version model found. Add version identity without changing existing material semantics; never infer kept mappings from titles. |
| Concept analysis | `RevisionConceptAnalysisJob`, `RevisionConcept`; revision worker and provider `/analyse-material` | Reuse job leases and canonical UUID concepts. Current unique `(materialId, externalId)` maps AI-local IDs. Worker does not persist complete prerequisite graph, ordered plan, sections or source references. |
| Lesson plans/runs/actions | No complete persisted equivalent located | Add versioned plans, prerequisite edges, owned runs and action state after approval; do not duplicate canonical concepts. |
| Conversations and content | `ChatConversation`, `ChatMessage`, `StewartAttachment`; `services/e-learning/student/stewart/{chat,conversations,explain}.ts` | Retain authorization, attachment leases, persistence and existing content path. Generated reply persistence alone is not proof the student received an explanation. |
| Practice attempts | `RevisionPracticeAttempt`; revision learning service and `/generate-practice`, `/evaluate-practice` | Reuse request-key idempotency and evaluation claims. Existing answer hash is not immutable answer/reasoning evidence; add protected evidence/evaluation versions and server-owned assistance. |
| Coverage | `RevisionTeachingEvent`, revision eligibility source checks | Existing teaching event is created from passing practice. It is not explanation delivery coverage. Add explicit generated/delivered transitions with qualifying course-source provenance. |
| Mastery | Existing evaluation JSON and teaching policy | No general versioned mastery ledger found. Add deterministic policy; AI confidence and FSRS retention must never set mastery. |
| Hints | Live `/generate-hint`; no complete persisted local hint workflow | Add attempt-owned events, escalation counters and backend assistance classification. Keep expected answers and response rationale private. |
| Snapshot | `RevisionLearningContext`; revision context worker and `learning-context.ts` | Reuse cache/dirty/lease pattern. Existing revision-only cache is not the requested comprehensive learning snapshot. Extend or introduce scoped snapshot only after deciding ownership/version keys. |
| Orchestrator | No `/next-action` integration or new mode flags found | Add request builder, allowed-action policy, ordered guard, fallback, executor and telemetry behind off/shadow/active modes. |
| Revision generation | `RevisionGenerationJob`, `RevisionTeachingEvent`, revision worker/providers | Reuse unique teaching-event jobs, dispatch uncertainty handling and leases. Advisory signal must only schedule an already eligible event, never generate directly. |
| Revision question bank/dedup | `RevisionQuestion`, `RevisionQuestionEmbedding`, `RevisionQuestionProvenance`, `RevisionQuestionGovernance`, `RevisionAdminAlert` | Reuse existing semantic scopes, provenance and review. Existing embedding dimension is **1536**, not the sketch's 768. Preserve model/version compatibility. |
| FSRS/review | `RevisionStudentCard`, `RevisionReviewLog`, `RevisionSession`, `RevisionSessionItem` | Reuse unique student-question cards, transactional/versioned review and exact `ts-fsrs@6.0.0`. Course and Random modes must share those cards. |
| Webhook idempotency | `RevisionWebhookIdempotency`; revision handler/contract/security/ingest services | Reuse body hash, response replay and transaction ownership. Changes to accepted payload/response require coordinated contract approval. |
| Metering | No shared `AiCallLog` or learning-AI credit ledger identified in inspected Prisma schemas | Add one request/call accounting integration after checking billing ownership; do not manufacture charges from missing usage or reuse unrelated marketplace finances. |
| Security | Server-side provider credentials; registration checks; revision RLS patch `20261116_revision_row_security.sql` | Preserve backend-only database access; add ownership checks to every new state transition and DTO boundaries for private answers. Verify deployed RLS separately. |

## Current request paths and constraints

`/api/e-learning/stewart/chat` → student authentication → bounded input/rate limit → authorized attachment context → `explainStewart` → shared ingest client's `/explain` → approved-source filtering → response. Persistent conversations have separate message routes and attachment leases. Existing optional revision context supplies a bounded excerpt; it is not an orchestration engine. Ordinary chat should continue directly to content generation.

Two existing server adapters share the same service configuration family: `ai-ingest/client.ts` and `revision-questions/providers.ts`. Extend/consolidate these rather than introduce a third credential/configuration path. Config precedence is `CONCEPT_EXPLAINER_API_URL`, then `AI_SERVICE_URL`, with `AI_SERVICE_API_KEY` Bearer authentication. Revision learning requests currently default to 60 seconds; generation has a longer explicit timeout. Explanation timeout is 150 seconds.

Route declarations include chat 180s, conversation messages 240s and conversation detail 120s. These declarations do **not** establish Vercel plan/platform limits. Confirm deployed duration before choosing synchronous 150s execution; otherwise use owned background jobs and polling. `vercel.json` schedules ingestion and revision cron daily; a low-latency refresh workflow needs an explicit worker/dispatch strategy.

## Verified live contract

- `/next-action` uses shared-secret Bearer security. Required request keys: `request_id`, `trigger`, `student_context`, `current`, `allowed_actions`. Request ID is a nonempty string, not schema-constrained to UUID. `allowed_actions` has `minItems: 1`.
- The 14 action enum includes `RECAP`; it excludes `REQUEST_REVISION_QUESTIONS`. The 11 trigger enum includes lesson start, concept open, delivery, student question, hint, guided completion, evaluated attempt, practice completion, lesson completion, revision review and return visit.
- Decision requires action, **string** `target_concept_id`, reason code, rationale and confidence between 0 and 1. `params` is an optional object. Do not demand invented params or accept null targets as if the live decision schema allowed them.
- Response requires only `request_id` and `status` (`ok`/`degraded`). Decision is optional/nullable; signals, usage and model/prompt versions are optional. Signals are arbitrary strings in OpenAPI, so recognize the agreed readiness signal without rejecting future unknown signals.
- `current`, context, evidence entries and policy are generic objects in Swagger. That permissiveness does not establish canonical nested semantics; validate those against backend state and the agreed handoff.
- `/generate-hint` requires concept ID/description, question, expected answer, nonempty student attempt and target level 1–6. Rationale is returned but must remain backend-private. No-attempt requests must not call it with invented evidence.
- Explain response requires answer, sources and retrieval info. Existing endpoint schemas do not universally require usage/status. Preserve backward compatibility and record unknown usage explicitly.

Guard order: structural validity → allowed action → authoritative reachable target → meaningful rationale. Confidence is informational. Failed guards normalize to degraded/null decision and zero decision usage while recording the actual upstream call separately. An empty allowlist means no upstream call and no executor action. If fallback FLAG_FOR_REVIEW is itself disallowed, pause with an explicit local failure rather than execute a forbidden action; obtain handoff confirmation before finalizing that policy.

## Webhook failure diagnostic and contract conflicts

Read-only production log query attempted for `ff40a328-54df-48f6-aa32-13ff925e98c0`, production project `akadverse`, last three days, with no event-name filter. CLI completed with no matching records. This is not proof the request never occurred; retention, project/environment and time range can limit visibility. No payload or response body for that request was available, so the exact invalid field remains **unverified**.

Receiver code: `services/e-learning/revision-questions/{handler,security,contract}.ts`. HMAC runs in the route-handler service, not Edge Middleware. Header validation/freshness happens before body reading; thus invalid headers yield null computed signature/body diagnostics. `INVALID_PAYLOAD` includes a field path in the HTTP response message, but the existing rejected-event log records failure code rather than that field. Obtain the sender's original HTTP response `error.message` and appropriately redacted payload shape to identify the field; do not weaken validation based on a guessed cause.

| Subject | Existing receiver | New brief | Required resolution |
| --- | --- | --- | --- |
| UTC precision | 0–6 fractional digits | 0–9 | Existing Python microseconds are accepted. Broader precision needs explicit agreement and tests. |
| Freshness | 5 minutes past, 30 seconds future | 5 minutes past, 1 minute future | Preserve existing window pending approval. |
| Secret variable | `AI_WEBHOOK_SECRET` | `FSE_WEBHOOK_SECRET` | Confirm matching configured values; do not rename/rotate automatically. |
| Authentication order | Header validation, freshness, bounded raw body, HMAC | Raw HMAC first | Changes affect diagnostics and resource limits; coordinate, preserve bounded reads. |
| Idempotency key | `teach_${teaching_event_id}` | Opaque | Coordinate sender/receiver; retain replay guarantees. |
| Payload | Strict unknown-key rejection; required tags/bloom/difficulty; no accepted_answers | Optional fields and passthrough/accepted_answers | Confirm actual signed delivery contract before changes. |
| Success response | teaching_event_id and outcomes; accepted rows require question/card IDs | event_id, similarity, bank-only acceptance | Separate question-bank persistence from coverage/card attachment through an explicit versioned contract. |
| Event identity | UUID-v4 validation | Broader examples/identifiers | Do not loosen without sender contract evidence. |
| Timestamp in body | UTC format checked | Additional freshness requirement | Distinguish event creation time from delivery freshness; delayed jobs must not be rejected accidentally. |

The reported 400 is distinct from earlier 401 header failures and database pool exhaustion. No production request was replayed and no revision generation was triggered during this audit.

## Learning policy and rollout decisions

Preserve flags-off legacy behavior, including current teaching eligibility. Current policy accepts one independent correct, adequate/strong, no-review evaluation recommending progress. Proposed policy introduces two independent successes and backend hint classification; apply it only to the new versioned workflow. Never retroactively reinterpret existing records.

Proposed defaults from the brief: 8KB deterministic snapshot, two consecutive reinforcement limit, versioned mastery policy 1, explicit high-level hint escalation, no carryover to new material versions without a supplied kept mapping. These are policy defaults, not verified current behavior. Existing dedup review starts at similarity .85; replacing it with .9 changes behavior and needs separate approval.

All requested new flags stay off by default: AI_V2_ENABLED, AI_INGEST_PIPELINE_ENABLED, AI_EXPLAIN_CONTEXT_SUPPORTED, HINTS_ENABLED, SNAPSHOT_ENABLED, REVISION_PIPELINE_ENABLED, REVISIONS_UI_ENABLED; ORCHESTRATOR_MODE defaults off. Existing REVISION_WORKSPACE_ENABLED must remain independent. No production values were modified.

## Proposed reviewable phases

1. Foundations: shared typed client extension, capability-tolerant response parsing, validated flags, safe call telemetry and metering ownership. Read installed Next route/runtime guides before code. No migration application or production activation.
2. Ingestion/plans: reuse jobs and canonical concepts, additive immutable versions/plan edges, suspect-analysis rejection and explicit source mapping.
3. Evidence: owned runs/actions, private attempt answers/evaluation versions, backend hints, generated/delivered provenance and versioned mastery.
4. Snapshot: deterministic bounded projection, transactional dirty/outbox signal, one indexed read on chat; no lifetime transcript.
5. Orchestrator: server allowlist, ordered guard, agreed fallback, exhaustive enum executor and shadow diagnostics before active mode. Route by enum even with empty params.
6. Revision: resolve signed contract discrepancies, eligible readiness signals, replay-safe generation and bank/card separation without weakening eligibility.
7. Revisions UI: extend existing card/review/session implementation, shared Course/Random FSRS state; avoid rebuilding completed flows.
8. Hardening: targeted ownership/replay/query-budget/load checks, sanitized monitoring and explicit staged activation approval.

Each phase returns changed files, focused checks, migration review and manual acceptance instructions for approval. Schema work should follow the repository's existing SQL patch conventions unless an explicit migration workflow is agreed; do not automatically run migrations against production. AI hosting continuity after the reported Railway trial expiry is an operational dependency, not verified by this audit.

## Validation plan

Audit baseline: `npm run test:revision:webhook` passed all 33 tests (0 failures), including Python microsecond timestamps, strict UTC/freshness checks, HMAC diagnostics and payload validation. `git diff --check -- docs/audit` passed. No broad rebuild is necessary for documentation-only changes. Live paid endpoints, database migrations and production writes are outside this audit.

Future 18 synthetic decision fixtures: lesson start; concept open; delivered explanation; guided completion; correct strong independent attempt; correct weak reasoning; incorrect attempt; weak prerequisite; needs-review attempt; developed practice completion; undeveloped practice completion; normal student question; hint request; failed revision review; return recap; lesson completion; disallowed action; unreachable target. Add independent malformed/schema/rationale/empty-allowlist cases, omitted optional fields, empty params, repeated readiness signal, target ownership, generated-versus-delivered coverage, hint independence, timeout uncertainty and flag-off parity checks. Fixtures test backend behavior; they do not establish AI pedagogical quality.

Manual acceptance after approved implementation: registered student starts a lesson; only taught content becomes practice-eligible; hints change assistance; failed/undelivered content leaves coverage unchanged; shadow mode performs no action; repeated signals create one eligible generation job; Course/Random share the same card; unauthorized students cannot fetch private attempts or answer keys; failed upstream calls show a recoverable state without false success.

## Approval questions

1. Approve Phase 0 and authorize **Phase 1 foundations only**?
2. Supply/confirm Handoff v2 §§2.4–2.6, or explicitly authorize Study Zone §12.4 as the fallback source. Until then fallback execution remains unresolved.
3. For the webhook 400, provide the original response error message with field path (and relevant redacted payload shape). Confirm timestamp/key/payload contract changes separately; this audit recommends preserving current security behavior meanwhile.
