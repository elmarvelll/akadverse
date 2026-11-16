# Productivity Assistant implementation and verification

Date: 15 November 2026. Branch: `productivity-layer-integration`. This report distinguishes implemented code, automated verification, and external deployment/provider state.

## Implemented

The feature now includes a separate FastAPI/Gemini service, a floating student chat panel, Core-owned conversation/message/tool-execution/pending-action persistence, delegated RS256 authentication, a fixed tool registry, existing-service execution, confirmation previews, replay protection, outcome reconciliation, and shared AssemblyAI voice input.

The initial registry covers 24 named tools. Definitions are shared between Python and Next.js in `akadverse-productivity-ai/app/tools/definitions.json`; count the file when extending it rather than assuming this report is an exhaustive future inventory. Registered tool names and exact fields are the contract; models cannot choose arbitrary operations, actors, URLs, sources, or SQL.

Backend browser authentication remains unchanged. A narrowly authenticated service adapter calls the same domain executor with a verified actor. Mutation receipts, saved tool results, and consumed confirmations commit together. Chat deletion preserves already-saved productivity records.

The [approved implementation plan](productivity-ai-implementation-plan.md) records the decisions; the [README](../akadverse-productivity-ai/README.md) contains configuration, contracts, startup/deployment instructions, and manual tests.

## Changed areas

| Area | Main files |
| --- | --- |
| Core persistence | [Schema](../prisma/schema.prisma), [additive migration](../prisma/migrations/20261115000000_productivity_ai_assistant/migration.sql). |
| Trusted executor | [Authentication](../services/productivity-layer/auth.ts), [operations](../services/productivity-layer/operations.ts). |
| Assistant backend | [Security](../services/productivity-layer/assistant/security.ts), [store](../services/productivity-layer/assistant/store.ts), [tools](../services/productivity-layer/assistant/tools.ts), [service integration](../services/productivity-layer/assistant/service.ts). |
| Routes | [Browser API](../src/app/api/productivity/assistant/route.ts), [service callback](../src/app/api/productivity/assistant/service/route.ts), [proxy exception](../src/proxy.ts). |
| Student UI | [Assistant panel](../src/features/productivity/assistant/AssistantPanel.tsx), [workspace shell](../src/features/productivity/workspace/WorkspaceShell.tsx), [styles](../src/features/productivity/styles.css). |
| Python | [FastAPI entry](../akadverse-productivity-ai/app/main.py), [orchestrator](../akadverse-productivity-ai/app/agent/orchestrator.py), [Gemini adapter](../akadverse-productivity-ai/app/integrations/gemini.py), [tool definitions](../akadverse-productivity-ai/app/tools/definitions.json). |
| Shared voice | [AssemblyAI adapter](../services/speech/assemblyai.ts), [browser session](../src/lib/speech/session.ts), [token route](../src/app/api/speech/token/route.ts), [usage route](../src/app/api/speech/usage/route.ts), shared voice/scroll controls and PCM worklet. |
| Setup and test entry points | [Local configuration helper](../scripts/setup-productivity-ai-local.mjs), [browser verifier](../scripts/verify-productivity-assistant.cjs), [package scripts](../package.json), Python requirements/Dockerfile and tests. |

## Verified results

- Prisma schema validation and client generation passed.
- The additive migration was applied successfully to the loopback-only Core test database at port 5433. No remote database was migrated.
- The existing Productivity suite passed **60/60** tests after the executor refactor.
- The full application regression suite passed **321/321** tests at its run point. Later additions received the targeted checks below; this number is not a claim that the full suite was rerun after every later edit.
- Assistant/security/speech unit tests passed **20/20**.
- Real local PostgreSQL assistant tests passed **11/11**: atomic receipts/results, lost-response replay, ownership, confirmation consumption, stale/expired previews, active-turn fencing, concurrent turn serialisation, rollback, reconciliation, habit/category/event/backup tools, chat deletion preserving saved work, the signed chat-to-callback integration with identical-message retry, and the habit-correction confirmation/race guard.
- Python tests passed **35/35**, including SDK schema compatibility, tool call/result identity, bounded loops, invalid inputs, failure/unknown results, delegation binding, safe destinations, and streaming request limits.
- The isolated Chromium test passed nine checks: conversation creation, single send, confirmed feedback, draft preservation, exact target preview, cancellation, mobile bounds, dialog precedence, and account isolation. It uses fixtures, not the deployed application or a real microphone.
- TypeScript compilation passed at the recorded checks. ESLint reported zero errors and the repository's seven pre-existing warnings.

The normal **Turbopack production build passed**, with database URLs explicitly pinned to the local test databases. The initial sandboxed build stalled; the Webpack diagnostic compiled but failed in the existing E-Learning native client loader during page collection. The subsequent normal build outside the sandbox completed successfully. No production deployment was performed.

A scan of **2,570 built JavaScript/JSON files** found no embedded assistant credentials and no secret-file entries in output traces. Gitleaks scanned the changed source snapshot with **zero findings**, and the tracked-browser-artifact guard passed. Ignored provider/signing configuration and the virtual environment were excluded. Next.js tracing exclusions also explicitly exclude Python secret files and its virtual environment while retaining the shared tool registry.

## Live Gemini findings

The supplied provider credential was stored only in the ignored local Python `.env`, with restrictive filesystem permissions. Generated signing/service credentials live in ignored local configuration. None of these values is included in this report or committed templates.

Google's model-list endpoint accepted the key with HTTP 200. A minimal request using the older `gemini-2.5-flash` returned HTTP 404 with a message that the model is unavailable to new users and recommended `gemini-3.8-flash`. Configuration now uses that model.

The attempted live generation/tool smoke checks against the recommended model returned provider HTTP 504 deadline failures. A minimal Interactions-endpoint diagnostic also timed out. **A successful live Gemini conversation/tool round trip has not been established in this environment.** Provider-stub tests must not be presented as proof that live generation works.

The integration bounds provider execution, disables SDK automatic tool execution and retries, preserves function-call identities, and reports failures without claiming success. Confirmed backend effects remain visible even when a later model step times out. Resolve/retest Google project/model availability and service connectivity before live acceptance.

The provider-facing schema uses Gemini's portable subset while Python and Next.js retain the stricter shared constraints. Model reasoning uses the verified account timezone/server time. The configured low thinking level follows [Google's Gemini 3.8 guidance](https://ai.google.dev/gemini-api/docs/latest-model); `minimal` is unsupported for that model.

## Remaining deployment and acceptance work

1. Apply the additive Core migration to the intended remote environment through the normal deployment process. Local test migration does not install tables in staging/production.
2. Deploy/start the Python service and configure the matching service credential, public key/key ID, provider key/model, and canonical callback origin.
3. Configure the Next.js server's Python URL and signing/service credentials, then restart/redeploy it.
4. Repeat the bounded live Gemini test until a real model/tool round trip succeeds. Do not change record-creation identities merely to retry an uncertain write.
5. Test a real consenting browser microphone and AssemblyAI session. Synthetic audio/draft tests do not establish hardware/provider success.
6. Run the two-account manual smoke workflow on the target deployment, including partial failures, confirmation expiry, real official timetable data, and mobile interaction.

No Railway/Vercel deployment, remote environment update, Git commit, or push was performed. Local generated configuration is not an alternative to remote secret configuration.

## Deliberate boundaries

- No arbitrary reminder delivery, official class editing/attendance, ordinary-task reopening, unsupported personal-event completion, or AI bulk import/export.
- No automatic resumption of all remaining multi-step actions after a confirmation; the confirmed proposal is applied, and the student can ask for the rest.
- No scheduled conversation-retention job; users can explicitly delete conversations. Existing mutation receipts remain separate.
- Speech issuance rate limiting is process-local; replace it with shared quota storage before relying on it across instances.
- Core ownership is enforced through backend services and model constraints; Python does not get database credentials or direct table access.
- The pre-existing habit “Needs review” outcome inconsistency was documented and not changed as part of the assistant.

## Local connection repair — 16 November 2026

The configured `http://127.0.0.1:8000` endpoint belonged to an unrelated Python `SimpleHTTP` file server. It returned HTML 404 at `/health`, causing Next.js to save its generic failed-turn message. The dedicated assistant API was started on port 8001, and the ignored root `.env.local` was updated to match. The setup helper now preserves an existing service URL and defaults to 8001 for fresh configuration. The unrelated file server was left running.

The assistant health endpoint returns JSON `{"status":"ok"}`. Service tokens, public signing keys and key IDs were checked for consistency without printing credentials. A separate live probe of the configured `gemini-3.8-flash` provider returned HTTP 503; that provider failure is independent of the repaired local connection. No user task was created or retried during diagnosis.

Python now distinguishes provider outages/access rejection, timeout, backend failure and unexpected failures using safe messages and category/status-only logging. Exception text and credentials are excluded. Python regression suite: **38 passed**, including provider 503/403, timeout and secret-redaction assertions. A real signed-in browser conversation remains necessary to verify the complete local workflow.

## Free-tier-capable model change — 16 November 2026

At the user's request, changed the assistant's private local model setting and source/setup/example defaults from `gemini-3.8-flash` to `gemini-3.5-flash-lite`. Google's pricing lists free input/output for that model on eligible free-tier projects; selecting the model does not change a project's billing tier. The actual assistant adapter returned text with the existing key in 1,695 ms. Python regression suite remained **38/38 passing**. The local Python assistant was restarted to load the new setting. Question-bank embedding model/version/dimensions were not changed.

## Gemini tool-response role repair — 16 November 2026

A live synthetic multi-step reproduction established that the remaining rejection was HTTP 400: `Role 'tool' is not supported`. The first model call and synthetic `list_tasks` execution succeeded; the second model request rejected the tool-result content role. Corrected the orchestrator to send `FunctionResponse` parts in `Content(role='user')`, preserving the original model content and function-call ID. This matches Google's native GenerateContent function-calling contract. Added a regression assertion for the role and an HTTP-400-specific public error message that does not incorrectly suggest provider access failure.

The same live synthetic flow then completed with a final text response after `list_tasks`; no real student operations or data were used. Python tests: **39 passed**. Restarted the local assistant to activate the correction. Previous one-call greeting/tool-selection probes had not exercised this second model request; the multi-step probe now covers it.
