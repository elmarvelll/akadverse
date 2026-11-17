# PIP request latency audit

Audited the standalone Python service and the sibling AkadVerse backend/UI.
Production accounts, databases and provider requests were not accessed. Findings
are from code inspection, supplied request logs, isolated tests, and a loopback
HTTP benchmark. The benchmark is reproducible with:

```sh
.venv/bin/python scripts/benchmark_transport.py
```

## What was making requests take longer

A normal turn is browser → AkadVerse → Python → Gemini → AkadVerse tool callback
→ Gemini final response → AkadVerse persistence → browser. More complicated
requests need more model/tool rounds. A model selecting a tool is not a confirmed
write; the final response must use the actual saved execution result.

The supplied earlier logs showed assistant HTTP requests of 13.3 and 44 seconds,
workspace loads around 4–9 seconds, and academic reads around 4–7.6 seconds. They
did not break a successful assistant request into model and backend phases, so
they cannot establish how much of that production wait was Gemini, hosting,
network transit, database waits or tool execution. Successful HTTP 200 alone
also does not establish that a tool succeeded.

The following avoidable costs were established in the code:

| Area | Before | Change |
| --- | --- | --- |
| Backend callback transport | New HTTPX client/connection pool for context and every tool | One client per turn, with keep-alive reuse and deterministic close |
| Gemini transport | New SDK client for every generation round | One SDK async client per turn; same model/configuration and all tools |
| Callback context | Repeated user lookup through `executeProductivityAs`, repeated conversation lookup through the general browser history loader | Reuse the freshly authenticated actor after validating the active turn; directly load the needed context |
| Context payload reads | Browser-oriented fetch of up to 60 messages and 40 executions, then discard all but 24/10 | Query 24 messages and 10 executions directly; retain the same context window |
| Context database dependencies | Actor → active-turn checks → repeated identity/conversation checks → history/preferences | Actor and turn admission overlap; four bounded context queries overlap after admission |
| Schema setup | Rebuild SDK declarations and JSON Schema validator objects | Cache static definitions/validators only; no account data cached |
| After each reply | Reload the conversation list before clearing `busy` | Update that conversation's title from the response already received |
| Workspace refresh | Refresh after reads, cancelled proposals and every processing poll | Refresh only when a previously unseen completed `saved: true` execution appears |
| Processing polling | Interval could start another request before a slow one finished | Schedule the next poll after the current request settles; suppress stale responses |
| Loading feedback | Static bullet text | Animated three-dot status with avatar, one accessible announcement, reduced-motion support |

The former context callback made nine Prisma read calls across approximately five
dependent waves: initial actor (1), active-turn checks (2), conversation/history
(4), and repeated actor/preferences (2). It now makes seven reads across three
waves: actor+conversation, active message, then messages/executions/proposals/
preferences. Concurrency is between independent reads; write transactions retain
their locks and receipt checks. Actual speed depends on DB connection availability
and network latency; query concurrency alone is not a speedup guarantee.

## Measured local transport result

See the standalone repository’s `docs/performance/transport-benchmark.json` for the raw samples. Five fixture turns each made
seven callbacks, with identical request counts and results:

- Fresh sessions: 35 TCP connections for 35 requests; median 1172.46 ms per turn.
- Turn-scoped reuse: 5 TCP connections for 35 requests; median 164.62 ms per turn.

This is loopback HTTP and includes local client setup overhead. It is **not** a
production end-to-end benchmark, does not include Gemini/database work, and must
not be represented as a predicted percentage improvement for users.

## Quality and correctness retained

The model, thinking level, output-token cap, complete tool registry, history
window, operation limit, request deadline and Gemini thought signatures remain.
Backend ownership, active-turn fencing, confirmation controls, mutation
transactions, receipts, outcome reconciliation, redacted errors, fixed callback
origins, response bounds and disabled mutation retries remain authoritative.
Connections are scoped to a single delegated turn; credentials and conversation
data are not cached between students. Current preferences are read each time.

## Production timing after deployment

Redeploy both the Python service and AkadVerse. No new variables are required.
Successful Python timings now use Uvicorn's INFO logger and include:

- `request.total`: session setup, execution and cleanup.
- `turn.total`: context + model/tool loop.
- `backend.context`: authenticated context callback, including network transit.
- `provider.generate`: one entry for each Gemini generation round.
- `backend.tool`: one entry for each backend tool step.

AkadVerse emits `PIP timing` entries for `callback.authorize`, `callback.context`,
`callback.tool`, `chat.begin`, `chat.service`, `chat.finish`, and `chat.view`.
Callback and service entries use the same opaque turn reference as Python.
`chat.begin` has its own reference because the persisted turn does not yet exist.
No message bodies, arguments, records, tokens, keys or raw exception messages are
logged. `chat.service` measures fetch-to-response-headers; the bounded JSON body
is consumed immediately after it.

Compare several requests of the same kind, separating the first request after a
deployment from subsequent ones. Do not add nested spans together: e.g.
`request.total` includes `turn.total`, and `backend.tool` includes backend callback
time. Use the spans to locate the remaining delay:

- Large `provider.generate`: model/provider wait or multiple required rounds.
- Large `backend.context` with small callback spans: transit/platform scheduling.
- Large `callback.authorize/context/tool`: database or domain work.
- Large `chat.begin/finish/view`: conversation persistence/database waits.
- A delay before application timing starts remains outside these spans; inspect
  platform request timing separately.

## Verification scope

Regression tests exercise pooled-client reuse and cancellation cleanup, unchanged
model/tool configuration, bounded concurrent context reads, account scoping,
preference freshness, mutation-only workspace refresh, Buddy receipts, confirmation
rules, Markdown safety and accessible loading markup. Browser verification covers
animated dots, reduced motion, loading cleanup, activity disclosure, account
isolation and the existing panel interactions. Actual run results are recorded in
the standalone repository’s `docs/performance/verification.md`; no live-provider or production timing claim is implied.
