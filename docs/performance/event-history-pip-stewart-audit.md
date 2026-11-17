# Event history, PIP and Stewart latency audit

Date: 17 November 2026. Scope: the Next.js application, its database access, event-history views, PIP panel and delegated callbacks, Study Zone/Stewart history, and Stewart message submission. The Python microservice was inspected for interface context but not modified in this audit.

## Outcome

Implemented seven small application-side optimizations and added Stewart stage timing. These reduce avoidable network/database sequencing and background contention while preserving the same records, answers, grounding, history limits, authorization and write guarantees.

This is a code and focused-test audit, not a production latency benchmark. Improvements below describe work removed or overlapped; no production percentage or seconds-saved claim is made. The changes need a Next.js deployment before they affect the hosted application. No database migration, new environment variable, dependency or microservice deployment is required for these changes.

## Baseline and audit boundary

At the start, the working tree already contained PIP transport/context/UI performance work and `docs/productivity-ai-performance.md`. That work was preserved. In particular, pooled Python clients, bounded callback context, mutation-only workspace invalidation, PIP settlement-based polling and working-state animation were already present. They are not claimed as new changes from this audit.

The user's earlier logs showed workspace operations around 4–9 seconds and official academic reads around 4–7.6 seconds, but those are different request types and are not measurements of this patch. The later Render context failure was HTTP 503, not proof of a slow provider response. Configuration failures must be resolved before comparing performance.

The wording mentioned event history and Stewart, so both Schedule Manager event history and Study Zone conversation history were audited. Revision/learning evidence preparation was also inspected because it is on Stewart's response path.

## Request paths inspected

**Event history:** ScheduleManager → workspace snapshot hook → account-scoped read cache → productivity API authorization → workspaceView → preferences + paginated event/category/habit reads → validated datasets → timezone display → event cards. The history branch is already read-only; it does not need recurrence generation or an owner write lock. Pagination is 100 events plus one sentinel row.

**PIP:** panel → assistant API → durable beginTurn → Render service → delegated context/tool callbacks → model/tool loop → durable finishTurn → conversation view → panel update. Context admission authenticates the student and validates the active conversation, lease and user message before returning context. Write paths keep their owner locks, confirmations, deduplication and receipts.

**Stewart:** authenticated conversation owner → bounded request validation → current course/week/document authorization + attachment metadata → idempotent message reservation → attachment lease → prepared evidence → explanation service → durable completion → attachment release. History reads first establish conversation ownership, then read messages and uploaded/failed attachments. All provider answers still pass existing source filtering and UI rendering rules.

## Findings and changes

| Finding | Implemented change | Why it helps | Quality/correctness preserved |
| --- | --- | --- | --- |
| Starting a new PIP conversation issued create → history → list as three sequential HTTP requests | Use the successful creation response to initialize the empty conversation and prepend its sidebar entry | New-chat creation uses one HTTP request instead of three; opening an initially empty panel now takes list + create, with no redundant history read | Creation still commits on the server before the UI changes; existing drafts and history remain available |
| PIP active-turn admission read the conversation and then its processing message | Start both fully owner/conversation-scoped reads together | Removes one dependent read wave from context and tool admission outside write transactions | Same conversation ID, student ID, role, active turn, message status, expiry and rejection precedence |
| Event-history preferences were awaited before three independent historical reads | Start preferences, events, categories and habits together after API authorization | Four reads now occupy one independent wave instead of two | Same 100-row pagination, category scope, timezone conversion, archived events and dataset validation; no write transaction added |
| All-dates event history included the unrelated selected calendar start/end in its cache key | Canonicalize those unused dates out of history options | Fresh history can be reused after calendar navigation rather than fetched again | Existing account/date/timezone isolation, TTL, page/category keys and write invalidation remain |
| Event history/analytics built timetable entries and computed conflicts for a hidden timetable | Skip those two calculations while those views are active | Avoids hidden card mapping and potentially quadratic overlap work on rerenders | Active timetable still performs conflict detection; history retains the saved plan/edits/outcomes |
| Stewart conversation history read messages and then attachments | Overlap both after ownership/cursor validation | Removes one read wave when opening/recovering a conversation | Same 50-message pagination, failed/pending mapping, attachment status and session ownership |
| Stewart message preflight always queried attachment metadata, even for no attachments, and waited until course context finished | Skip the empty query; overlap nonempty metadata reads with fresh course-context authorization | Plain text saves one DB query; attachment turns remove one sequential dependency | No reservation or provider call proceeds until authorization succeeds; attachment leasing and expiry checks still run |
| Stewart recovery used a fixed interval even if a read took longer than 2.5 seconds | Use a settlement-based sequential poll with cleanup | At most one recovery read per mounted effect; slow reads cannot create an accumulating queue | Same 2.5-second delay before/between settled reads, error retries, unmount/context-switch cancellation and stale-result guard |

The implementation groups the history-render/cache work as one optimization area; the table separates its two mechanisms for review.

### Structural before/after evidence

- PIP new conversation: **3 → 1** HTTP requests after the user presses Create. No optimistic database success is inferred.
- PIP context callback, with the pre-existing context optimization: **7 reads remain 7**, but approximately **3 dependent waves → 2** (actor + conversation + processing message, then four context reads). A single-connection transaction still executes its queries serially; the intended gain is on ordinary callback admission.
- Event history: **4 reads remain 4**, preferences no longer precede the other three.
- Stewart history after ownership and optional cursor validation: **2 sequential reads → 2 concurrent reads**.
- Stewart text-only preflight: **one attachment-metadata query removed**.
- Fresh equivalent history across two selected calendar ranges: focused client test verifies **one history request**, not two. Changing page/category or invalidating schedule data still fetches again.
- Slow Stewart recovery: fake-timer test advances 30 seconds while the first read is blocked and proves no second read starts. Cleanup prevents another request after that read settles.

Parallel work is not free: improvement depends on database/network waits and available pool connections. No pool-size increase was made without production evidence. Reducing redundant calls and overlapping a few independent reads is preferable to speculative high fan-out.

## Stewart observability added

`Stewart timing` entries contain only `referenceId`, static phase name, elapsed milliseconds and `completed`. No prompts, answers, attachments, URLs, student IDs, tokens or raw exceptions are logged.

Persistent-message stages share one reference:

1. `authorize`: session and student authorization.
2. `conversation`: current conversation ownership read.
3. `context`: fresh study context and any attachment metadata.
4. `reserve`: durable idempotent message reservation/history.
5. `attachments`: attachment validation and lease acquisition.
6. `evidence`: prepared learning snapshot or revision evidence lookup.
7. `provider`: explanation-service request and response handling; this is not pure Gemini inference time.
8. `persist`: storing the answer and closing the pending claim.
9. `release`: attachment lease cleanup.

Legacy explanation routes also receive attachment/evidence/provider/release timings. Failures retain `completed: false`; the timing helper preserves the original return value or exception. PIP's pre-existing callback/chat timings remain available.

## Quality and efficiency safeguards

No model, temperature, reasoning setting, prompt budget, generation cap or timeout was reduced. No sources, conversation messages, attachment context or learning evidence were removed to make answers look faster. No AI answer cache or cross-student cache was added.

Student/course registration is still checked on each relevant request. Conversation ownership is established before history reads. PIP actor and active-turn checks still gate callbacks, and mutation paths retain their transaction/fencing rules. Stewart retries retain the same request ID semantics, attachment leases and persistence-before-success behavior. History retention, pagination, timezone display, confirmation dialogs and error paths remain intact.

Poll cleanup stops future scheduling and ignores in-flight results; it does not claim to abort a request already running on the server. Long AI inference, large file processing and remote service availability can still dominate an answer's total time.

## Remaining audit findings and implementation plan

| Priority | Remaining area | Plan and validation gate | Status/reason |
| --- | --- | --- | --- |
| P0 | Deployment latency attribution | Deploy Next.js changes, then compare cold and warm requests of the same kind with correlated PIP/Stewart stages; collect median and p95 separately for plain text, attachments, grounded questions and write requests | Required to establish actual user-visible improvement; not measured against live providers in this audit |
| P1 | Stewart course context uses a general StudyWorkspace read model | If `context` dominates, introduce a narrow authorized Stewart read projection for the requested offering/week/document, preserving fresh approved-registration and material membership checks | Planned; the shared current loader also supplies UI data, and replacing it without equivalence tests risks authorization/source regressions |
| P1 | Event-history sort/index shape | Existing indexes cover owner/date/outcome and owner/category, but not the full owner + createdAt + ID history ordering. Use representative `EXPLAIN (ANALYZE, BUFFERS)` before adding an owner/time/ID or owner/category/time/ID index | Planned; no speculative index migration or production load query executed |
| P1 | Deep offset history pagination | If large histories show increasing query time, add stable createdAt/ID cursor pagination with explicit paging behavior | Planned; current page-based API/UI behavior was preserved |
| P1 | PIP durable transactions | Inspect `chat.begin`, `chat.finish` and `chat.view` timing before changing query projections or transaction scope | Planned; locks and receipt reconciliation must not be weakened for speed |
| P2 | Stewart Markdown/math rerenders | Profile typing, speech updates and large histories; stabilize callback/prop identity before introducing memoization | Planned; memoizing with a new `send` callback each render would not reliably help |
| P2 | Study Zone initial page | Profile current academic context, approved courses, general offering detail and lecturer identity resolution separately; use narrow projections/request-local reuse where authorization remains fresh | Audited; no broad shared-data cache introduced |
| P2 | Learning evidence | Preserve existing indexed prepared-snapshot lookup and worker refresh; use `evidence` timing to verify background preparation is healthy | Already uses prepared evidence; do not rebuild learning history on a chat request |
| P2 | Visibility-aware recovery | Consider pausing recovery while the page is hidden, with an immediate read on resume | Deferred product tradeoff: lower background work versus completion visibility |
| External | Provider wait and hosting startup | Correlate explanation-service/Render request traces with application stages; investigate where time is outside application spans | Outside this application-side change; no provider quality reduction proposed |

Implementation order is deliberate: deploy these low-risk changes, measure actual remaining delay, then tackle narrow read projections/indexes only where the trace supports them. Streaming would improve perceived wait but needs an end-to-end protocol and persistence design; it is not a substitute for removing unnecessary work and was not added here.

## Verification and limitations

Only focused checks were run.

| Check | Command | Result |
| --- | --- | --- |
| Concurrency, history caching/invalidation, sequential polling, timing privacy, PIP security/context/outcomes, Stewart answer/render quality | `node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/performance/app-latency.test.ts tests/performance/polling.test.ts tests/productivity/lifecycle-client.test.ts tests/productivity-ai/context.test.ts tests/productivity-ai/performance.test.ts tests/productivity-ai/security.test.ts tests/productivity-ai/outcome.test.ts tests/elearning/stewart-learning-response.test.ts` | 49 passed |
| Stewart persistence, retry/idempotency, ownership, explanation routing, attachment/source behavior | `node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/elearning/stewart-explanation-route.test.ts tests/elearning/stewart-conversations.test.ts` | 29 passed against local test databases with fake AI responses |
| Actual PIP UI: new chat, single send, proposals/cancellation, account isolation, rendering, viewport/focus and reduced-motion behavior | `NODE_PATH="$PWD/node_modules" node /tmp/akadverse-latency-pip-browser.cjs` (copy of `scripts/verify-productivity-assistant.cjs`, only screenshot destination changed to `/tmp`) | Passed after updating the obsolete pre-optimization list-read expectation |
| Focused lint | `npx eslint` over the changed application, helper, test and runner files listed below | Passed |
| Scoped TypeScript | `node node_modules/typescript/bin/tsc -p /tmp/akadverse-latency-tsconfig.json --pretty false` | Passed; includes touched code, dependencies and project ambient declarations |
| Whitespace | `git diff --check -- <files changed in this audit>` | Passed; an unrelated pre-existing EOF blank-line warning in `assistant/service.ts` was left untouched |

The first Stewart database run in the sandbox could not connect to loopback PostgreSQL. The authorized local-database run passed all 29 checks. The first PIP browser run correctly observed one list read instead of the old expected two; its expectation was updated, alongside new assertions that creation performs no redundant history read. No live-provider calls, production writes, full repository test suite, full build or deployment were performed for this audit. Screenshots from the user's prior work were preserved.

## Files changed in this audit

- `services/productivity-layer/views.ts`: overlap history reads without taking a write lock.
- `services/productivity-layer/assistant/store.ts`: overlap scoped turn admission reads.
- `src/features/productivity/assistant/AssistantPanel.tsx`: initialize new chat from its committed creation response; preserve prior UI optimizations.
- `src/features/productivity/client.ts`: canonical all-dates history cache options.
- `src/features/productivity/schedule/ScheduleManager.tsx`: skip hidden timetable/conflict computation.
- `services/e-learning/student/stewart/conversations.ts`: overlap authorized history reads.
- `src/app/api/e-learning/stewart/conversations/[id]/messages/route.ts`: skip/overlap attachment metadata; stage timings.
- `services/e-learning/student/stewart/explain.ts` and new `timing.ts`: safe per-stage measurements without changing explanation payloads.
- `src/app/e-learning/student/study-zone/_components/StuwartPanel.tsx` and new `src/lib/sequential-poll.ts`: settlement-based recovery reads.
- New `tests/performance/app-latency.test.ts`, `polling.test.ts`: gated concurrency, auth/error behavior, poll cancellation and timing tests.
- `tests/productivity/lifecycle-client.test.ts`: history request reuse, page/category separation and invalidation checks.
- `scripts/verify-productivity-assistant.cjs`: request-count assertions for the new-chat optimization.
- This report: audit findings, completed work, staged plan and verification limits.

No Python microservice source, secret, environment setting, database schema or existing deployment was changed by this audit.
