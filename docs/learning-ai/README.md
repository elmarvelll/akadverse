# Personalized learning — implementation report

17 November 2026. Continuation of [Phase 0 audit](../audit/ai-integration-audit.md) and [Phase 1 foundations](../audit/learning-ai-phase1.md). The user approved all remaining implementation phases and requested focused tests only. That supersedes the per-phase approval stops. Production deployment and flag activation remain excluded.

## A. Outcome

The remaining local implementation is in place behind default-off flags: immutable material/plan identity, owned lesson runs and queued actions, explicit delivery coverage, protected attempts/evaluations/hints, deterministic mastery, bounded snapshots, orchestration guards/fallback/execution, revision eligibility and shared FSRS integration, student controls, operator recovery and focused verification.

No environment file was changed, no production database migration was applied, no production flag was enabled, and nothing was deployed. New SQL was exercised only against disposable local test databases. Existing unrelated portal/productivity changes in the checkout were preserved.

This is a local implementation and synthetic acceptance report, not a claim that the original production webhook failure or hosting configuration has been resolved. Those external acceptance limits are listed in §K.

## B. Existing components extended

- `services/e-learning/ai-ingest/{client,ingest-material,worker}.ts`: existing authenticated transport and ingestion state/reconciliation; successful ingestion queues analysis only when the new pipeline is enabled. No analysis runs inside a webhook.
- `services/e-learning/revision-questions/{worker,students,workspace,processing,eligibility,handler,contract,monitor,readiness}.ts`: canonical concepts, existing job leases, question bank, embeddings/dedup/provenance, signed receipts, cards, sessions and transactional FSRS review.
- `services/e-learning/student/stewart/explain.ts`: one prepared snapshot read under the snapshot flag; ordinary chat continues directly to explanations and does not call the orchestrator. New context is sent only with the explicit service-capability flag; new workflow messages do not forward client history.
- Study Zone course page and workspace: server-provided enablement boolean mounts `LearningJourney`; flags-off rendering retains the previous workspace.
- Existing Revisions workspace/API: reused for Course and Random modes, with optional new UI enablement. No parallel flashcard or FSRS implementation was introduced.

New implementation modules are in `services/e-learning/learning-ai/`: `flags`, `client`, `metering`, `capabilities`, `plans`, `policy`, `lessons`, `executor`, `worker`, `snapshot`, `revision`, and `review-evidence`.

## C. Contract and identifiers

The authoritative captured public schema is [next-action-contract-snapshot.json](../audit/next-action-contract-snapshot.json), sourced from the configured Railway service's `/openapi.json`. It records capture time and a full-document SHA-256. The service contract has 14 actions, including RECAP, and 11 triggers. REQUEST_REVISION_QUESTIONS is not an action. Readiness is recognized only as the advisory signal CONCEPT_READY_FOR_REVISION.

The live decision requires a string target, action, reason, rationale and confidence in [0,1]. Params can be absent/empty. No confidence threshold is used to accept decisions or set mastery. Optional response usage/status/version fields are handled without inventing token counts. The backend request ID owns transport identity; a mismatching echo fails closed.

AI-local concept IDs are stored only as plan mapping metadata. Each immutable version gets new backend UUID concepts through the existing RevisionConcept model. New content, evaluation, hint, next-action, generation and revision-evaluation requests use those canonical UUIDs. No title matching or undocumented kept-concept mapping is inferred. Existing legacy concepts keep their original integration semantics.

## D. Persistence and migrations

Reused: RevisionConcept, RevisionConceptAnalysisJob, RevisionPracticeAttempt, RevisionTeachingEvent, RevisionGenerationJob, RevisionQuestion, RevisionQuestionEmbedding, RevisionQuestionProvenance, RevisionQuestionGovernance, RevisionStudentCard, RevisionReviewLog, RevisionSession, RevisionSessionItem, RevisionWebhookIdempotency and RevisionLearningContext.

Added:

| Model | Purpose |
| --- | --- |
| AiCallLog | Pending-before-send trace, request hash/scope, actual reported usage, private replay and uncertain outcomes |
| LearningMaterialVersion / LearningPlan / LearningPlanConcept | Frozen source identity, persisted section order and canonical prerequisite graph |
| LearningLessonRun / LearningLessonAction | Student-owned progression, optimistic version fence, job lease and public/private results |
| LearningCoverage | Delivered explanation tied to a real action and qualifying material source |
| LearningMastery | Versioned deterministic policy, review flag and reinforcement counter |
| LearningEvaluation | Append-only private answer/reasoning/evaluation evidence; links practice action or revision review |
| LearningHintEvent | Backend-owned assistance, level, private rationale and actual attempt draft |
| LearningSnapshot | One indexed student/offering context cache with dirty/version compare-and-swap |
| OrchestratorDecision | Mode, allowlist, validated decision, degradation reason, fallback and executed action |

Additive ownership booleans on the existing analysis and generation jobs distinguish new work from legacy work. Disabling the new flags parks owned work; it does not route it through legacy handlers. The new worker selects only its own jobs. Both worker families share the existing global capacity fence.

Apply the existing revision prerequisites first, then review/apply these patches in order:

1. `prisma/elearning/patches/20261117_learning_ai_foundations.sql`
2. `prisma/elearning/patches/20261117_learning_job_ownership.sql`
3. `prisma/elearning/patches/20261117_personalized_learning.sql`

These add tables/indexes/columns, enable backend-only RLS and use RESTRICT foreign keys for durable learning relationships. They contain no DROP or destructive retyping. Additional SQL foreign keys follow the repository's manual-constraint convention. No browser SQL policies grant access to answers, hints or replay bodies. Regenerate the custom E-Learning Prisma client with `npm run db:elearning:generate`.

Material identity uses the existing verified storage metadata fingerprint, not a newly claimed cryptographic content digest. Upload storage paths must remain immutable; replacing content should create a new upload identity. New versions start without transferred coverage because the live service does not publish an authoritative kept-concept mapping. Suspect fallback analysis, missing targets and cyclic prerequisite graphs do not become official plans.

## E. Execution and request lifecycle

`/api/e-learning/learning` authenticates a student, bounds input, rejects cross-origin mutations, applies rate limits and revalidates current registration/material ownership. Start prepares/resumes a plan/run; commands persist a unique request and reserve the run version before returning. Network generation runs after the response through Next `after`, with a cron fallback at `/api/cron/learning-ai`.

The worker takes one bounded job at a time and commits only with the owned run version, current material and live action lease. It rechecks course ownership after remote content generation. Stale/uncertain outcomes never silently retry. Stored responses replay; concurrent identical requests have one owner. A second tab cannot overwrite a busy lesson. Advancing queues a separate concept-open explanation; it does not mark that explanation delivered.

| Action | Reused endpoint / backend behavior |
| --- | --- |
| EXPLAIN_CONCEPT / REINFORCE_CONCEPT / RECAP | `/explain` with canonical concept and current course material |
| CONTINUE_CONVERSATION | `/explain`; ordinary student chat bypasses next-action |
| ADDRESS_MISCONCEPTION | `/explain` using only labels from real stored evaluation evidence |
| SHOW_GUIDED_EXAMPLE | `/generate-example-tasks`; display worked example, retain task answers privately |
| GENERATE_PRACTICE / REASONING_EXERCISE / TRANSFER_TASK | `/generate-practice`; documented question type and description focus select the activity, private expected answer retained server-side |
| GIVE_HINT | `/generate-hint` with owned active attempt, actual draft and stored prior hints |
| TEACH_PREREQUISITE | Move only to an authoritative prerequisite and request its explanation |
| ADVANCE_TO_NEXT_CONCEPT | Move only to the established next concept and queue concept-open content |
| COMPLETE_LESSON | Close the run and queue only already eligible revision work |
| FLAG_FOR_REVIEW | Persist review-needed state and pause progression; no fabricated teaching content |

Responses are stored with explicit public DTOs. Student endpoints never return privateResult, expected answers, hint rationale or raw decision/replay logs. Post-attempt feedback and explicitly requested solution-level hints are intentional educational disclosures.

## F. Guard, fallback and shadow behavior

The guard order is structural/enum validation, allowlist membership, backend reachability, then meaningful rationale. Action-specific targets further prevent using a next concept for a recap or an unrelated target for prerequisite teaching. Failed guards produce degraded/null/zero-decision-model-calls locally; the actual upstream usage stays separately recorded in AiCallLog.

The fallback implemented is the supplied Study Zone brief §12.4, with the same backend allowlist and target checks. The original Handoff v2 §§2.4–2.6 was unavailable, so equivalence to that separate document is not asserted. Empty allowlists cause no provider call or execution. If the specified fallback is disallowed, FLAG_FOR_REVIEW is used only when allowed; otherwise no action executes.

Shadow next-action requests record observations only: no recommended content call, progression, readiness generation or mastery write. Explicit student-selected Explain/Practice activities remain available independently of shadow recommendations. Active mode can execute only guarded actions or permitted documented fallbacks. Unknown signals are ignored; readiness signals cannot manufacture eligibility.

## G. Coverage, assistance and mastery

Generation persists an action result without coverage. The browser acknowledges a completed, rendered result through the owned delivery endpoint. Only explanation-family actions citing the selected lecturer material can create coverage. Attachments, generated examples, empty/unverified sources and undelivered results do not qualify.

Practice is gated by delivered coverage. Legacy practice endpoints reject attempts to bypass the lesson for newly managed concepts. Hints require a real active attempt/draft, advance one verified level at a time and require an explicit request for the full solution. Any hint makes success assisted; levels 5–6 are heavy assistance. Provider evidence_strength cannot override backend hint records.

Policy version 1 keeps mastery separate from FSRS: two independent adequate/strong successes with no unresolved recent misconceptions establish UNDERSTOOD; qualifying transfer/revision can establish STRONG. Repeated incorrect results, repeated misconceptions or failed revision require reinforcement. Degraded/review-needed evaluations stay private and do not enter real evidence or award mastery. Review-needed concepts permit only review/conversation and, when enabled, hints.

Mastery recomputation is serialized per student/plan/concept across lesson and revision transactions. A revision's actual evaluated correctness affects mastery; its self-reported FSRS rating affects retention only. A completed lesson can be explicitly resumed for a concept that later needs reinforcement, preserving earlier evidence.

## H. Snapshot and metering

The snapshot aggregator reads bounded projections, orders them deterministically and caps UTF-8 JSON at 8192 bytes. It contains coverage/mastery/review/run summaries, not raw answers or chat history. Mutations mark it dirty transactionally. Refresh uses version compare-and-swap; chat performs exactly one indexed lookup and labels dirty/aged/mismatched/missing data stale. It never rebuilds from every learning table during a chat message.

AiCallLog records actual reported usage, cache status, capabilities and sanitized outcomes. No existing learning credit tariff/ledger was found, so no invented financial postings were added; creditsCharged remains zero and does not claim the provider execution was free. Missing usage remains unknown. No extra AI call estimates usage.

There are no automatic retries of uncertain generation. A stable request ID is not treated as proof of upstream idempotency support. An operator must reconcile uncertain work before freeing its retained capacity. Repeating a logical request never automatically incurs another generation.

## I. Revision pipeline and webhook diagnostics

Readiness schedules an existing eligible teaching event through RevisionGenerationJob. Eligibility requires owned delivered coverage, current course registration/material, and the existing independently passed-practice rule. Repeated readiness signals upsert/reuse the same event job. A configured daily new-question budget reserves capacity; new learning jobs request one question. Existing legacy generation behavior remains intact.

The existing 1536-dimensional embedding/model lock, semantic dedup, provenance, published bank and student-question unique card are reused. New bank governance is recorded even before the new UI flag is enabled. Course and Random sessions use the same card and history. The receiver rechecks new learning coverage/material before commit. New revision evaluations use canonical IDs and metered calls; failed/degraded evaluations cannot schedule reviews or promote mastery.

HMAC remains in the route-handler service, not Edge Middleware. UTC microseconds remain accepted with the existing five-minute past / 30-second future window. Signed-byte verification, strict payload validation, secret naming and existing idempotency/response contracts were not silently widened.

`INVALID_PAYLOAD` now records a bounded invalidField path in the INFO rejected event; unknown keys identify their path rather than only a parent object. No body, answers or secret is logged. The original correlation ID `ff40a328-54df-48f6-aa32-13ff925e98c0` had no matching retained log records in the audited query. Its exact offending payload field is still unverified. Capture the sender's original HTTP error.message and redacted payload shape for that diagnosis; do not weaken the schema merely to make it pass.

## J. Focused verification

See [verification.md](verification.md) for commands/results and [manual-acceptance.md](manual-acceptance.md) for the acceptance checklist. Only affected-area checks were run; no full repository test suite or broad production build was run for this continuation. Provider calls in database/browser tests are mocked. Browser captures are isolated component fixtures, not screenshots of a production deployment.

## K. Rollout, recovery and external acceptance limits

1. Review and apply SQL in a controlled environment before deploying code that reads the new ownership columns. Regenerate the custom Prisma client. Do not remove data to roll back; keep new flags off.
2. Keep AI_V2_ENABLED and all other new booleans false, ORCHESTRATOR_MODE=off. Verify existing student chat, ingestion and revisions remain available.
3. Confirm AI origin/key, ingestion callback secret, revision webhook secret, CRON_SECRET and required model/embedding configuration through the existing server environment. Never expose them as NEXT_PUBLIC variables.
4. Confirm the hosting platform actually supports the configured `after`/240-second worker duration. A route declaration is not evidence of the deployed account limit. If unsupported, dispatch the persisted queue to an external worker invoking the authenticated cron endpoint; do not truncate a 150-second explain call into a synchronous short route.
5. In staging, enable the master/ingestion/snapshot flags as appropriate and test plan preparation with real authorized material. Keep AI_EXPLAIN_CONTEXT_SUPPORTED false until the service accepts that context extension.
6. Enable shadow orchestration first. Inspect guard/fallback reasons, real usage and request latencies without recommendation execution. Verify the missing Handoff v2 policy against the supplied fallback before production active mode.
7. Test a real synthetic revision event with coverage and the sender's exact signed payload. Confirm strict required metadata, key/response shape and timestamp agreement. This report does not claim that the earlier production 400 has been reproduced or fixed.
8. Activate active mode/revision/UI flags in a limited rollout only after staging acceptance and explicit production authorization. Watch review/uncertain counts, p95 latency, database pool pressure and unknown usage. The user-approved implementation work did not activate production.

Admin recovery: `/api/e-learning/admin/learning` is admin-only and returns bounded status metadata. `resolve_review` requires an idle run and review reason; it clears the review fence without granting coverage/mastery. `reconcile_uncertain` also requires explicit confirmation that the provider operation has stopped. Both append a private operator/reason audit activity. They never retry the original remote request or expose private content to students.

Remaining external facts: original Handoff v2 text, the original failed webhook response/payload, production hosting duration/worker guarantees, live sender/receiver acceptance, AI decision-quality review and hosting continuity. The policy/test defaults are implemented locally; these external facts are not fabricated or represented as verified deployment outcomes.
