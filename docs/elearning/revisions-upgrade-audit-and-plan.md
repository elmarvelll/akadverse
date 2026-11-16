# Standalone Revisions: existing implementation audit and implementation plan

16 November 2026. This report precedes structural changes for the new Revisions upgrade task.

## Discovery and confirmed scope

Searched the working tree, route tree, navigation, services, schemas and all 27 available local/remote branch references. There is no standalone Revisions route, Course mode, Random mode, persisted revision session or navigation entry. The only existing revision UI is `src/app/e-learning/student/study-zone/_components/RevisionPracticePanel.tsx`, inside `StuwartPanel.tsx`. The user confirmed: **build the first standalone page here**. It will be `/e-learning/student/revisions`, alongside Study Zone in `src/app/e-learning/_components/nav-config.ts`. This is the first standalone module, not a parallel question bank.

The user delegated the compatible coverage choice. Retain the existing server-verified passed independent practice event as legacy coverage evidence. A generated explanation, open document, or AI-generated question never establishes coverage. This is an explicit compatibility interpretation; existing practice evidence is not a delivered teaching-action/lesson-run record. Versioned delivered lesson contracts remain an AI coordination dependency.

## Existing components and classifications

| Logical entity | Actual source | Classification |
|---|---|---|
| Student identity | Core `User`, E-Learning `StudentProfile`, shared auth | Existing/reusable |
| Registration/course hierarchy | `StudentCourseRegistration`, `CourseOffering`, `CurriculumCourse`, `Course`; `student/registered-courses.ts` | Existing/reusable; no new academic hierarchy |
| Weeks/materials | `CourseMaterial` start/end weeks, offering, storage metadata; study-zone services | Existing/reusable |
| Immutable material/lesson-plan versions | No version ledger, no content checksum | Missing; use a clearly labelled backend source-metadata fingerprint for new records, never pretend it is a content hash |
| Lesson runs/delivered teaching actions | None; chat messages have no authoritative covered concept ID | Missing; do not infer coverage from chat text |
| Concepts | `RevisionConcept` linked to material, external ID, meaning key | Reuse |
| Independent practice | `RevisionPracticeAttempt` plus five-condition saved evaluation | Reuse for teaching practice; preserve old records |
| Passed coverage milestone | `RevisionTeachingEvent` | Reuse, add source fingerprint inside existing context JSON for new events |
| Bank and vectors | `RevisionQuestion`, `RevisionQuestionEmbedding`, `RevisionQuestionProvenance` | Must not duplicate |
| Student memory/reviews | `RevisionStudentCard`, `RevisionReviewLog`; `ts-fsrs@6.0.0` FSRS-7 defaults | Must not duplicate; add optional session-item relation only |
| Approval/suspension/retirement/source validity | No explicit policy model | Missing; additive governance sidecar preserves existing bank schema |
| Revision sessions/answers/evaluation | Existing UI reveals answers and accepts recall rating; no bank-answer attempt/session | Missing; session and session-item records needed |
| Learning evidence | Teaching evaluations and FSRS logs exist; review answer content/evaluation absent | Extend through session items linking the authoritative review log, not another copy of large answers |
| Prepared learning context | No learning snapshot/context service | Missing; one per-student durable snapshot with refresh state, not separate event/evidence/mastery queues |
| Usage metering | No actual usage fields in published revision/evaluation responses | External contract gap; do not estimate/bill invented token counts |

Read-only Supabase audit confirms the 12 `Revision*` tables. At this audit there are zero questions, cards, reviews and passed teaching events. Historical preservation remains mandatory despite empty current counts.

## Current endpoints and lifecycles

All student routes derive identity from the session and verify the current Core student role. Existing success envelope is `{result: ...}`; known errors expose safe messages/codes. No-store responses.

| Method/route | Request and response | Models/services and limitations |
|---|---|---|
| GET `/api/e-learning/revision` | No query -> due card summaries; `?event=id` -> own generation status | Cards/questions or teaching event/job. Ownership only for old card retrieval; no dynamic registration/publication/source check |
| POST same, `prepare_concepts` | courseId/weekNumber/documentId -> analysis status/concepts | Registered material access, concept/job; calls no AI immediately |
| POST same, `practice` | study context/conceptId/requestId -> hidden-answer question/attemptId | Practice attempt; `/generate-practice`; external call before unique save can incur duplicate inference under concurrent initial requests |
| POST same, `evaluate` | study context/attemptId/answer/reasoning -> evaluation/pass/event | `/evaluate-practice`; leased idempotent evaluation, pass/event/job atomic; stores answer hash, not answer text |
| POST same, `reveal` | cardId -> answer/explanation | Owner-only; currently no eligibility revalidation |
| POST same, `review` | cardId/rating/version/requestId -> scheduled state/replay | Card lock, version, log, shared scheduler. No persisted bank answer/evaluation/session |
| POST `/api/webhooks/tutor/questions` | Raw HMAC delivery -> ordered final IDs/outcomes | Receipt + bank/vector/provenance/card/job transaction; strict context, stable exact replay |
| GET `/api/cron/revision-generation` | Cron bearer -> sweep counts | Analysis/generation/alerts; bounded claims; daily Vercel fallback |
| GET/POST `/api/e-learning/admin/revision-generation` | Admin status, original-delivery replay or confirmed capacity release | Existing admin guard; no publication management yet |

Generation lifecycle: passed practice -> event/job -> existing worker -> external generation -> signed webhook -> semantic dedup -> atomic questions/cards/receipt -> combined result reconciliation. Keep it. No external call inside a final persistence transaction.

## Findings and preservation requirements

Course and Random workflows do not exist yet. Due cards are sorted globally by due time and capped at 50. The Study Zone panel has no durable session/resume or answer evaluation for bank questions, and hides most question-type behavior behind reveal/rate. A review does atomically preserve complete official library state and log history; keep that implementation. Course/Random must share its unique `(studentId,questionId)` card rather than creating mode-specific memory.

Current question provenance links to a teaching event and concept/material but has no immutable version/source fingerprint, explicit publication state, evaluation criteria or external usage/source references. Existing semantic dedup and exact-byte callback contracts are sound foundations; preserve model/version/dimensions and HMAC/idempotency.

## Proposed model changes

Add four justified E-Learning tables, not duplicate academic/question/FSRS structures:

1. `RevisionQuestionGovernance`: one sidecar per existing question; publication state, trusted source-metadata fingerprint/snapshot and review notes. No backfilled claim of verified historical provenance.
2. `RevisionSession`: student, Course/Random mode, selected offering, stable creation key, progress/status/times. Fixed bounded question list lives in items.
3. `RevisionSessionItem`: ordered unique question within session, chosen coverage event, shared card/version, answer/reasoning, leased evaluation/result, optional unique review-log link. This is session membership and the authoritative revision answer record; teaching attempts remain intact.
4. `RevisionLearningContext`: one student row, prepared bounded evidence summary, dirty/version/lease/retry metadata. It doubles as its own durable refresh signal; no new broker or cron.

Existing models receive relations only; source fingerprints for newly passed teaching events use existing context JSON. Add review integration to the existing scheduling transaction, not another scheduler. A new additive SQL patch creates only these tables/FKs/indexes. Local validation precedes remote rollout; do not rerun old nonrepeatable patches or drop history.

## Eligibility and question selection policy

Dynamic server checks at session creation, question reveal/evaluation and review: current approved registration, passed practice coverage meeting all five conditions, active concept, available ingested material, current source fingerprint, question publication and source validity. A stored card alone never grants eligibility. Restrict candidates by the student's covered concept/context scopes; no unrestricted bank query. Legacy records lacking new provenance remain preserved and unavailable until reviewed; never invent a historical fingerprint.

Both modes use one selector: due first, configurable bounded new introductions, exclude future-due/recent reviews and unavailable questions, no duplicate IDs. Course limits the student's selected registered offering; Random interleaves/shuffles candidates across eligible offerings within priority bands. Mode does not affect memory state. Queue membership persists across refresh; eligibility is rechecked, and invalidated queued items are skipped without deleting history.

## Review and learning intelligence policy

Present MCQ, short answer and true/false distinctly. Save answer/evaluation before showing feedback; student chooses the four recall ratings independently of correctness. Reuse published `/evaluate-practice` without adding fields: evaluation criteria are optional in current OpenAPI. Use stored criteria when available; do not invent an AI schema field. Wrong/partial/review-needed results are saved as evidence; no forced FSRS rating.

Append the review and update shared card state atomically with marking the session item reviewed and signalling context refresh. Stable request keys and versions prevent duplicate/stale reviews. Context rebuild occurs through the existing worker sweep, outside the review's success path. Evidence is referenced from items/evaluations/review logs. Prepared summaries report correctness/independence/recall counts and coverage; a single correct answer never grants mastery. A definitive mastery threshold is not currently an agreed product rule; do not publish an invented academic grade. Stuwart reads the prepared bounded snapshot, not full revision history. Context failure must not stop review completion.

## Incremental implementation sequence and exact locations

1. Audit/contract report (this file plus `revisions-ai-integration-gaps.md`).
2. Schema/patch/local client: existing E-Learning schema; new additive `20261116_standalone_revisions.sql`.
3. Central policy/access/selector/session/evaluation modules inside existing `services/e-learning/revision-questions/`; extend existing student review transaction and worker.
4. Extend `/api/e-learning/revision` with additive workspace actions/queries; preserve existing actions/responses. Add admin publication action without altering existing recovery contracts.
5. Add the confirmed first standalone page at `/e-learning/student/revisions`, shared question/session UI, sidebar entry; preserve Study Zone practice; make its review shortcut lead to Revisions rather than pretending it is the standalone workspace.
6. Tests: registration/coverage/source/status negatives, Course/Random pool boundaries, due priority, all types, persisted resume, evaluation/ratings, shared FSRS, duplicate/concurrent submissions, context failure independence and Stuwart bounded summary.
7. Build/regression/secret checks, migration/release report with completed/partial/pending/external distinctions.

## Risks and coordination

New signed payload fields, lesson-version IDs, usage metadata and new AI endpoints are not authorized by existing contracts. Do not add them silently. Bank revision evaluation can reuse the existing evaluator with its actual supported schema. Teacher delivery and stable source provenance should eventually use an agreed versioned lesson contract. Definition of mastery remains a product policy dependency; preserve mastery/retention separation meanwhile.

The daily cron is not sufficient for prompt local concept generation/context updates. Existing authenticated worker can be scheduled more frequently; do not create another queue merely for this feature. Provider failures must preserve submitted answers and let students safely resume. Rollout must keep the old UI/API usable while new structures are introduced, with no destructive resets, blanket eligibility or card reinitialization.

## Decisions and security finding during implementation

The user approved the conservative evidence rule: three independently correct answers on three distinct questions, with no review flag, produces **consistent retrieval**, never **mastered**. Prepared summaries keep recent review counts separate from the historical distinct-question aggregation; both are computed asynchronously. Formal conceptual mastery remains unassessed. Both prior API history and newly recorded answer evidence remain authoritative and are not erased by eligibility changes.

Read-only Supabase checks found all 12 older revision tables readable by the anonymous role with RLS disabled. A separate `20261116_revision_row_security.sql` enables backend-only RLS on all 16 revision tables, including the four additions; no permissive browser policies are added. Server Prisma's owner/BYPASSRLS role was verified. Focused local tests prove an ordinary role cannot read or insert while server operations still work. This is a discovered privacy correction, not a new academic eligibility rule.
