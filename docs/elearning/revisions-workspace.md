# AkadVerse Revisions — implementation, testing and release handoff

Updated 16 November 2026. Standalone Revisions is implemented at **`/e-learning/student/revisions`**, with its own student sidebar entry alongside Study Zone. The user confirmed this is the first standalone page in this checkout; discovery found none in the working tree or 27 available branch references.

## What the student can do

Choose **Course Revision** to practise one approved registered course, or **Random Revision** to mix eligible questions across registered courses. Both use the existing shared question bank and the same personal FSRS card for each question. A review in either mode immediately affects the other mode.

The session presents MCQ, true/false and short-answer questions with suitable inputs. Students submit an answer and optional reasoning, receive saved evaluator feedback and the expected answer/explanation, then choose **Again**, **Hard**, **Good** or **Easy**. Correctness never automatically chooses the recall rating. The next review date and progress are shown without exposing raw FSRS metrics as grades.

Sessions, submitted answers, evaluations and review history are durable. The session ID stays in the page URL; a refresh or saved-session link resumes it. Answers saved before a provider failure can be recovered. Questions that lose eligibility, or were already reviewed in another session, are skipped without deleting evidence or resetting cards. A bank with no eligible questions produces an explicit empty-state message; the interface does not invent questions.

## Three separate systems

- **Study Zone:** material access, Stewart explanations and independent teaching practice. It supplies verified practice evidence, not automatic eligibility from merely opening a document or generating an explanation.
- **Question Bank:** existing `RevisionQuestion`, embedding, variant and provenance records own reusable question content. Generation and semantic deduplication stay in the existing webhook pipeline.
- **Revisions:** selection, persistent sessions, student answers/feedback and personal review scheduling. It works without the Study Zone interface being open.

Learning context is prepared asynchronously from saved revision evidence and can be used by Stewart. Failure to update that context does not undo a successful revision.

## Coverage policy approved for compatibility

The user delegated the compatible choice. Coverage uses an existing `RevisionTeachingEvent` backed by a saved independent practice evaluation meeting all five conditions:

1. Correct answer.
2. Independent evidence.
3. Adequate or strong reasoning.
4. No review flag.
5. Recommended next step `progress`.

This is **practice-based coverage evidence**, not a claim that a separate versioned lesson-delivery system exists. Generated explanations or generated questions alone never establish coverage. A future delivered-teaching/lesson-version contract requires agreement with the AI engineer.

New teaching events save a source fingerprint in existing context JSON. Older events without it qualify only if their pass occurred after the material's last recorded update. This conservative compatibility path preserves history without manufacturing a past version hash.

## Eligibility and selection

Eligibility is checked on the server at selection, question access, answer evaluation and review. It requires current approved registration, valid passed coverage, an active concept, an ingested material, publication and current source provenance. Canonical question course identity is checked against the covered registered course; context text alone cannot authorize a foreign course. Stored cards and client-provided IDs do not grant access.

The governance record stores a snapshot/fingerprint of trusted material metadata: material/offering IDs, storage bucket/path, size, MIME type and week range. Changing that source metadata invalidates the question until provenance is reviewed. This is a **metadata fingerprint**, not a cryptographic checksum of the file bytes or an AI-side material-version ID. A separate immutable material/lesson version contract remains pending.

Selection is centralized in `services/e-learning/revision-questions/workspace.ts`:

- Maximum 20 selected questions per session.
- Due, previously reviewed cards before introductions.
- Up to `REVISION_NEW_QUESTION_LIMIT` introductions, default 5 and bounded to 0–10.
- Unreviewed cards already created by the webhook count as introductions, not due reviews.
- Future-due reviewed cards are excluded.
- No duplicate question IDs inside a session.
- Random mode shuffles within priority bands and interleaves eligible offerings.
- Candidate retrieval is bounded to 200 due and 200 introduction candidates; coverage inspection is bounded to 500 recent passed events. This is not an exhaustive full-bank random sample.
- Selection and card initialization are fenced by a student lock and card locks; existing cards are never reset.

Suspended, retired, unverified and changed-source questions are excluded. Existing bank questions without governance remain preserved and unavailable until reviewed; there is no blanket provenance backfill. A new callback cannot silently reuse a suspended canonical question or create another card for it. Completed exact webhook receipts remain replayable after source changes; replaying history does not restore student eligibility.

## Database mapping and applied patches

The existing twelve revision models are reused. Four additive tables were introduced:

| New table | Purpose |
|---|---|
| `RevisionQuestionGovernance` | One publication/provenance record per existing bank question. |
| `RevisionSession` | Student-owned Course/Random session, stable creation key and status. |
| `RevisionSessionItem` | Ordered question membership, coverage reference, shared card/version, authoritative answer/evaluation, and review-log link. |
| `RevisionLearningContext` | One prepared student snapshot with durable dirty/version/lease/retry metadata. |

Existing bank/card/review/event models received relations only. The source fingerprint for new teaching events is kept in existing context JSON. No duplicate bank, FSRS scheduler, academic hierarchy, answer-copy table, mastery table, broker or vector store was created.

Patches applied to both the disposable local test database and the configured Supabase E-Learning database:

1. `prisma/elearning/patches/20261116_standalone_revisions.sql` — four new tables, restrictive FKs, uniqueness, indexes and state checks. This creates tables and must not be blindly rerun.
2. `prisma/elearning/patches/20261116_revision_row_security.sql` — backend-only RLS for all **16 revision tables**. It is safe to re-enable existing RLS.

Read-only checks had found the older revision tables anonymously readable with RLS disabled. This privacy gap was corrected. No permissive anonymous/authenticated browser policies were added; database access goes through authorized application APIs. The server database role's RLS bypass was verified, and its ORM queries still succeed. Local tests prove a regular role cannot read or insert protected records.

No existing question, card, review or teaching-event row was overwritten or deleted during remote rollout. The four new tables were verified empty immediately after migration. There are now 16 revision tables; the four earlier Productivity AI tables are separate Core database tables.

## API reference

Student API: **`/api/e-learning/revision`**. Existing actions and response envelopes remain available. Identity is derived from the session and verified Core student role. New workspace operations additionally require `REVISION_WORKSPACE_ENABLED=true`.

| Method / query or action | Inputs | Result |
|---|---|---|
| GET `?workspace=1` | None | Registered course choices, latest 15 sessions, latest 20 completed answer/review records and selection policy. |
| GET `?session=<id>` | Owned session ID | Saved mode, progress, current eligible question and submitted answer. Expected answer/explanation appears only after evaluation. |
| POST `start_session` | `mode: COURSE|RANDOM`, `offeringId` for Course, stable `requestId` | New or replayed session view. |
| POST `answer_item` | `itemId`, `answer`, optional `reasoning` | Saved evaluator feedback and refreshed session view. |
| POST `rate_item` | `itemId`, rating 1–4, stable `requestId` | Transactionally saved review, next question and next review date. |

Success envelope: `{ "result": ... }`. Known failures use safe `error`/`code` fields. Responses are private/no-store. New answer input is bounded to 4,000 characters, as is reasoning. Invalid MCQ/boolean selections are rejected before inference.

Administrator API: existing **`/api/e-learning/admin/revision-generation`** authorization remains authoritative.

- GET `?questions=1`: latest 30 bank questions and their governance state.
- POST `{action:"publication",questionId,status}`: `PUBLISHED`, `SUSPENDED` or `RETIRED`.
- Publishing requires `confirmProvenanceReviewed:true`, an active concept and ingested source. It records the reviewed current source fingerprint.
- Existing generation metrics, original-delivery replay and confirmed remote-stop recovery actions are retained.

The signed webhook and external generation contracts are unchanged. No new AI endpoint or undocumented wire field was introduced.

## Answer evaluation, FSRS and evidence

Bank answers use the existing external **POST `/evaluate-practice`** contract. The server loads the question, expected answer, concept and options itself; the browser cannot submit a grade or expected answer. The published schema makes evaluation criteria optional; they are not invented when absent from the bank.

Evaluation claims are leased and fenced. The same evaluated answer replays saved feedback; changed input after evaluation conflicts. An AI failure preserves the submitted answer for recovery and creates no review. A newer card version cannot be silently overwritten by an older session.

Scheduling reuses pinned **`ts-fsrs@6.0.0`**, FSRS-7 defaults, and the existing unique `(studentId,questionId)` card. Node 24+ is required. Card update, immutable review log and session-item review linkage commit together. A database failure rolls them back together. Recall request keys prevent duplicate reviews.

Learning evidence references the session answer/evaluation and authoritative review log rather than duplicating answer payloads. The user's approved rule marks **consistent retrieval** only after independently correct, no-review-flag responses on at least three distinct questions for the concept. Repeating one question three times does not qualify. The label is evidence, **not mastered status**; formal conceptual mastery remains `not_assessed`. FSRS retention and recall ratings remain separate.

## Prepared learning context and Stewart

After a review commits, a bounded dirty signal requests context refresh. If the signal fails, the review remains successful. The existing worker can rediscover missed signals from durable review logs and retry.

`learning-context.ts` builds a bounded summary of the latest 100 completed reviews and up to 30 concepts. Historical distinct-question evidence for those concepts is aggregated in the worker, not during ordinary student requests. Snapshot writes use version/claim fencing so a newer review cannot be erased by a stale refresh.

The existing cron sweep processes at most five context rows per sweep. There is no new cron endpoint or queue service. `preparedRevisionContext()` reads one student snapshot and returns safely when unavailable. Stewart receives a complete compact reference for up to three concepts (without raw answers or internal IDs), as a bounded reference-data prefix through its existing question field when space permits; request/response schemas do not change. The student's own question takes priority over that optional context. Prepared history is not used to grant eligibility.

## Configuration and release state

Already configured: existing Core/E-Learning database URLs, AI service origin/API key, webhook secret, Gemini embedding/judge key and cron secret. No new provider credential was required.

Local rollout settings:

```dotenv
REVISION_QUESTIONS_ENABLED=true
REVISION_GENERATION_ENABLED=true
REVISION_WORKSPACE_ENABLED=true
REVISION_NEW_QUESTION_LIMIT=5
```

The standalone flag was enabled in ignored `.env.local` after migration verification. Example defaults stay off. Next.js was restarted to load the regenerated client. These local changes do not set Vercel environment variables or deploy application code.

For another environment: apply the original revision foundation patches if needed, then the two new patches, generate Prisma, configure server credentials and flags, deploy the matching application and verify it. Existing E-Learning fresh setup uses schema push followed by constraints/RLS; do not use reset or destructive production push to apply this release.

The existing cron configuration is a daily fallback. Configure a regular authenticated sweep for responsive generation and prepared context. No real remote scheduler or public AI callback deployment was performed here. The original external generation/webhook handoff remains in `REVISION-QUESTIONS-WEBHOOK-INTEGRATION.md`.

Rollback: disable generation and the receiver/student APIs before rolling back application code. Keep learning tables, receipts and history, and retain RLS. Do not turn off RLS or reset schedules to restore an older UI. Reconcile any dispatched remote work before releasing its capacity.

## Focused verification

Per the user's instruction, **the full application test suite was not run for this upgrade**. Nor is an earlier full-suite/build result represented as fresh verification of this page.

- **44 focused Revisions database/integration tests passed**, against disposable local PostgreSQL/pgvector.
- **11 standalone browser checks passed**, including React Strict Mode, registered choices, Random mode, all three formats, hidden pre-evaluation answers, separate recall ratings, saved-session resume, completion/next date, no client identity/expected answer, and mobile width.
- TypeScript, generated route types and focused ESLint passed.
- **8 existing Study Zone practice-panel browser checks passed**, preserving its practice, answer hiding, pass decision, review shortcut and mobile behavior.
- A real external `/evaluate-practice` request using synthetic content succeeded in **2,322 ms**, returned the matching concept ID, correct answer and no review flag. No student data or real learning record was sent or created.
- Local route smoke checks: standalone page redirects unauthenticated users (307); workspace API returns 401.
- Supabase post-migration checks: 16 revision tables, all with RLS enabled, and successful server ORM reads of all four new tables.

Reproducible focused commands (set loopback test database URLs for your disposable databases):

```sh
npm run test:revisions
npm run test:revisions:browser
```

Coverage includes revoked registration, missing coverage, invalid source/publication, cross-student access, due/new policy, shared state across modes, exact request replay, provider failure/resume, all ratings, rollback on review-log failure, context failure independence/recovery, distinct-question evidence, direct-role RLS isolation and completed webhook replay after provenance changes.

## Completed / partial / pending

| Status | Work |
|---|---|
| Completed | First standalone route/navigation; Course/Random sessions; existing bank/shared FSRS reuse; dynamic eligibility and publication; answers/feedback/ratings/history/resume; conservative retrieval evidence; recoverable context preparation; bounded Stewart integration; additive migration/RLS; local activation and focused checks. |
| Compatible implementation | Coverage comes from verified passed practice, as delegated by the user, rather than a nonexistent delivered lesson ledger. Source provenance uses a clearly labelled metadata snapshot. |
| Pending AI agreement | Stable material/lesson versions and delivered-concept lineage, optional source/evaluation-criteria fields, schema-version negotiation, actual execution/token usage metadata and retry semantics. Existing contracts were not silently extended. |
| Pending deployment | Hosting application deployment, remote environment flags, public producer callback end-to-end test, regular authenticated schedule, load/latency verification and deployed administrator notification delivery. |
| Not claimed | Definitive conceptual mastery, anonymous database access, fabricated AI usage/billing, completed public deployment, or a new full-suite/build verification. |

See `revisions-ai-integration-gaps.md` for the coordination matrix and `revisions-upgrade-audit-and-plan.md` for the source audit, model classification and approved decisions. No external engineer message was sent.

## Local Supabase connectivity adjustment — 16 November 2026

A later dashboard request failed before SQL execution while connecting to Supavisor transaction port 6543. Both endpoints subsequently became reachable, but measured warm academic-session queries took 4,058 ms on transaction mode versus 419 ms on session mode. These are individual measurements, not a latency SLA or proof of the provider's root cause.

The ignored local `.env.local` E-Learning runtime URL now uses the already configured session-pooler target on port 5432, with `connection_limit=2`, `connect_timeout=15`, `pool_timeout=10`, and required SSL. Credentials, project/database, the migration URL and the base `.env` were preserved. This is a development-only connection choice for the persistent Next.js process; hosted serverless deployments should continue using their transaction-pooler configuration. See [Supabase's connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

No table, RLS policy or student record was changed for this connection adjustment. Verification uses the exact `academicSession.findFirst` lookup, not a full test suite.
