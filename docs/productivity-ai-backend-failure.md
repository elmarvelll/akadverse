# Productivity AI backend failure — 16 November 2026

The supplied Python `category=backend` entry correlates with a Next.js `POST /api/productivity/assistant/service` returning 503 / DATABASE_UNAVAILABLE (reference c116e351-e6c1-4e22-8785-1ac44ee73bd5). Other requests show Prisma P2024 pool acquisition timeouts. Successful Uvicorn startup does not establish backend database availability. This is separate from the tutor webhook signature issue and does not establish a Gemini model-access failure.

## Findings

- The Core connection targets Supabase's transaction pooler; the local runtime URL already has connection_limit=10 and pool_timeout=20. Those settings were not blindly increased.
- Three read-only SELECT 1 probes succeeded in 3788, 1008 and 846 ms. The endpoint was reachable at verification time, while the supplied logs establish intermittent failures and substantial request latency. These probes do not reproduce load or prove ongoing availability.
- Python discarded the backend's safe code/reference and logged only category=backend, making database, authentication and transport failures indistinguishable.
- Callback admission performed two read-only turn checks inside an unnecessary interactive transaction. It pinned a connection and added begin/commit overhead despite taking no locks or writes. Mutation transactions retain their own authoritative checks and fencing.

## Changes

- BackendError carries a bounded HTTP status, allowlisted error code, validated UUID reference and context/tool action. It does not carry raw response or transport exception text into logs or user-facing errors.
- The Python API now logs backend action/status/code/reference and returns a specific safe database/timeout explanation with the backend reference.
- Transport timeouts, non-JSON errors, invalid response envelopes and oversized responses have distinct safe categories. Redirects remain disabled. No automatic operation retry was added.
- Next.js assistant errors include the existing allowlisted Prisma diagnostic, enabling correlation of public DATABASE_* errors with P2024/P1001/P1017 without logging database URLs or credentials.
- Callback admission now uses the existing turn checks without the read-only transaction. Ownership, active-turn/lease verification, mutation locks, confirmations, receipts and idempotency remain enforced.

## Verification and runtime

- 45 targeted Python assistant tests passed, including a full authenticated API request whose context callback returns DATABASE_UNAVAILABLE: Gemini is never invoked, one callback is sent, safe reference is preserved and private response text is excluded.
- 20 local backend/persistence/error tests passed, including expired callback denial and existing mutation safety.
- TypeScript, relevant ESLint and git diff checks passed. Full repository suite not run.
- Three production Core probes were SELECT 1 only; no user records read or changed. All persistence/mutation tests used localhost fixtures.
- Restarted only the repository's Python server on localhost:8000; GET /health returned {"status":"ok"}. Next.js and other servers were left running.

The Python changes are loaded locally. No production deployment, database migration, provider/model switch or financial operation was performed. Live authenticated AI completion was not tested: health does not test Gemini or the database. Supabase connectivity/load may still cause failures; the new diagnostics identify the action, status and reference rather than hiding it behind category=backend. Inspect those correlated database codes if another attempt fails.
