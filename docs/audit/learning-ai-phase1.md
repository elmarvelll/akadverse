# Learning AI foundations — Phase 1 review

Implemented after Phase 0 approval. Nothing is deployed or enabled. The SQL patch was applied only to the local disposable test database.

## Changes

- `services/e-learning/learning-ai/flags.ts`: exact-true server flags, invalid values fail closed, orchestrator mode requires AI_V2_ENABLED. No environment file was edited.
- `client.ts`: one internal callAi entry point extending the existing Concept Explainer transport/configuration, bounded response reads, endpoint deadlines, backend-minted UUIDs, request hashing, scope-aware replay and durable claims. Ordinary chat and legacy revision/ingestion callers are unchanged. This foundation returns content/envelopes, never executes a teaching decision.
- `capabilities.ts`: tolerant optional status/usage/model-version handling; capability observations are saved per response. Missing usage remains unknown. Invalid token counts are omitted, never estimated. Existing degraded content signals are marked for downstream rejection; full endpoint schemas and lesson-state decisions belong to subsequent phases.
- `metering.ts`: PENDING before dispatch, outcome/actual usage after dispatch, immutable request identity, private response cache and sanitized error codes. There is no learning credit ledger/tariff in the audited repository: creditsCharged remains zero; actual provider usage is preserved, not claimed to be free. No financial ledger was invented.
- `AiCallLog` Prisma model and additive `20261117_learning_ai_foundations.sql`: unique request IDs, query indexes and backend-only RLS. Cached responses may contain private content and must never be serialized directly to browser DTOs.
- Existing RevisionWebhookIdempotency remains the webhook receipt mechanism. Its signed contract/security behavior is unchanged.

## Operational behavior

All new flags default off. Example server-only configuration, **not activated**:

```dotenv
AI_V2_ENABLED=false
AI_INGEST_PIPELINE_ENABLED=false
ORCHESTRATOR_MODE=off
AI_EXPLAIN_CONTEXT_SUPPORTED=false
HINTS_ENABLED=false
SNAPSHOT_ENABLED=false
REVISION_PIPELINE_ENABLED=false
REVISIONS_UI_ENABLED=false
```

The eventual caller must authorize the student/course before invoking callAi and persist/reuse the logical action's requestId. Reusing an ID with a different payload, operation or student/course scope fails. Concurrent duplicate requests have one owner. Successful/degraded envelopes replay without another provider call. PENDING, FAILED and UNCERTAIN records are fenced, not automatically retried. A response-log persistence failure does not trigger another AI request.

Automatic retries are deliberately absent until upstream idempotency guarantees are established: a stable request_id alone does not prove a provider deduplicates executions. The briefs conflict on 429 retries; non-idempotent generation must not be replayed blindly. A future approved recovery mechanism can support one safe retry using a provider-confirmed cache or explicit human review. Uncertain outcomes currently require reconciliation. No credit debits occur for errors, missing usage, cache hits or zero model calls; no positive tariff is configured for any call.

Endpoint timeouts: next-action 10s, explain 150s, example/practice 40s, evaluate 20s, hint 15s, revision generation 60s, background analysis 60s. These do not override hosting limits. Before integrating long-running work, confirm deployed Vercel duration or use owned jobs/polling.

No lesson models, coverage/mastery updates, executor, hint workflow, new revision eligibility, UI changes, flag activation or webhook contract widening are included. Handoff v2 remains missing; fallback execution stays unresolved for Phase 5.

## Verification

- Prisma client generation passed.
- TypeScript checks passed.
- 98 targeted tests passed across foundations, ingestion policy/database/reconciliation, Stuart HTTP/learning response and webhook protocol, before two additional persistence-failure tests were added.
- Local database test passed: five concurrent claims yield one owner; usage/capability fields persist; a recreated client replays; RLS is enabled. Test rows cleaned up.
- Initial sandboxed database tests could not reach localhost; the same guarded suite passed with local-network access. No remote test database or provider was used.
- Final foundation suite: all 12 tests passed (`npm run test:learning-ai`); local persistence test: 1 passed (`npm run test:learning-ai:db`). Targeted ESLint and `git diff --check` passed. Final TypeScript check passed.

## Next checkpoint

The user subsequently approved all remaining phases and focused tests only. See [the implementation report](../learning-ai/README.md) for the continuation. Production migration application and flag activation require separate rollout approval. The existing Phase 0 audit documents the full phase sequence and unresolved signed-webhook contract questions.
