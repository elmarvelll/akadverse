# Focused verification — 17 November 2026

No full repository suite or production build was run. Checks were limited to the new learning workflow and the ingestion/chat/revision paths it changes. Fixtures use local databases and mocked providers unless explicitly described as the single live smoke check below.

| Check | Result |
| --- | --- |
| `npm run test:learning-ai` | 47 passed: foundations, 18 decision fixtures, policy/graph/hint/mastery/snapshot limits, student-route boundaries, snapshot query count and operator authorization |
| `npm run test:learning-ai:db` with disposable pgvector target | 8 passed: seven learning workflows and durable call-log persistence |
| New browser fixture `npm run test:learning-ai:browser` | 9 checks passed: coverage gating, StrictMode delivery ordering, practice unlock, hint/draft preservation, backend assistance feedback, fresh attempt inputs, completion, private-field absence, desktop/mobile bounds |
| Affected unit/HTTP/protocol batch | 96 passed across new foundations/policy/routes/snapshot, existing webhook protocol, Stuart HTTP and learning-response tests; the three admin checks were then added/passed separately |
| Affected integration regression batch | 76 passed across learning, existing revision learning, ingestion and reconciliation |
| Worker ownership follow-up | 4 affected legacy worker tests passed after adding new/legacy job ownership fences |
| Final policy delta | 24 passed after enforcing real failed-revision evidence for reinforcement fallback |
| Final revision trigger delta | 1 focused end-to-end revision case passed after wiring the failed-revision follow-up trigger |
| Prisma generation | Passed for the custom E-Learning client |
| TypeScript | `npm run typecheck` passed |
| Targeted ESLint / whitespace | Passed for changed learning integration code/tests and `git diff --check` |

Counts describe separate overlapping batches; do not sum them as distinct tests.

## What the database walkthrough actually proves

- Plans persist canonical concept IDs in prerequisite order.
- Practice cannot bypass delivery coverage; another student cannot fetch an owned run.
- Generated explanations create zero coverage rows until acknowledged. Duplicate acknowledgements create one row.
- Public lesson views omit private answers, explanations and hint rationale.
- AI-reported independent success becomes assisted when backend hint events exist.
- Degraded evaluations create no real evaluation evidence or teaching event and pause progression.
- Repeated readiness reuses an eligible generation job; signals without passed covered evidence queue nothing.
- Shadow decisions generate no downstream content.
- Guard failures retain actual upstream usage while selecting a permitted local fallback.
- Advancing queues a separate undelivered explanation; completing closes the run.
- The real existing bank/provenance/card persistence path accepts a synthetic covered event and completes its durable receipt.
- Course and Random evaluations use the same card; evaluated correctness and FSRS self-rating affect separate state.
- Failed revision evidence selects REVISION_REVIEW_COMPLETED for the next learning activity.
- Flag rollback parks new analysis work without a provider call.
- Five concurrent start requests produce one student-owned run and no copied coverage.
- Snapshots contain no raw answers, remain within 8192 bytes and perform one indexed lookup on chat reads.
- RLS is enabled on the private new tables. Test records are cleaned up.

## Single real-service smoke check

One synthetic `/next-action` request used the configured shared server transport and the production AI service. Its student/course/concept context was synthetic; the call store was in-memory, and the guard ran without an executor. It made no application database writes or flag/environment-file changes.

- Request ID: `2327d8f0-1ba4-4e10-a73a-abe68c499b49`
- HTTP 200; guard accepted EXPLAIN_CONCEPT.
- Usage was reported; model_calls was 1.
- Executed recommendation: false.
- Application database writes: 0.

This confirms one real transport/contract/guard interaction. It is not a pedagogical quality benchmark, production rollout or live webhook acceptance test. The 18 decision fixtures are synthetic backend policy checks.

## Local setup and reproduction

Use a disposable PostgreSQL instance with pgvector installed and the base E-Learning schema already present. `tests/helpers/env.ts` rejects non-local hosts and replaces external provider credentials with fixtures. Set TEST_DATABASE_URL / TEST_ELEARNING_DATABASE_URL to the disposable local targets as needed; never substitute production URLs.

```sh
npm run db:elearning:generate
npm run test:learning-ai:setup
npm run test:learning-ai
npm run test:learning-ai:db
npm run test:learning-ai:browser
npm run typecheck
```

The setup helper applies missing existing revision prerequisites before the three new learning patches. In this session the default local PostgreSQL instance lacked pgvector, so the database checks used the already-running disposable pgvector instance on localhost:55435 for E-Learning and the guarded local Core fixture database. No existing database/container was replaced or reset. Local credentials were read internally for the test process, never printed or committed.

An initial integration attempt failed because revision prerequisites/pgvector were absent. A later legacy context-refresh assertion exposed one orphaned context left by the new fixture; fixture cleanup was corrected and the affected batch passed. Generated `.next/dev/types` files were also found inconsistent during concurrent development/type generation; only the corrupted generated declarations were removed, and a serial type check passed. Existing tests were not edited to hide those failures.

## Browser artifacts

[Desktop fixture](../audit/screenshots/learning-desktop.png) and [mobile fixture](../audit/screenshots/learning-mobile.png) show the real LearningJourney component under isolated HTTP fixtures. Next Link uses the existing test adapter; fixture CSS is minimal. These captures verify component behavior/bounds, not the full deployed site's visual design or hosting behavior.

## External acceptance still required

Use [manual-acceptance.md](manual-acceptance.md) in staging for real material/source quality, latency, signed webhook compatibility and user acceptance. The original webhook 400's offending field, original Handoff v2 policy, production worker duration, AI context-extension capability and hosting continuity remain externally unverified. No automated result here substitutes for those checks.
