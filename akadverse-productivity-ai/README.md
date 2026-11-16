# AkadVerse Productivity AI

A standalone FastAPI service that uses Gemini function calling to operate the existing AkadVerse Productivity Layer. Next.js owns student authentication, application rules, records, conversations, tool results, confirmations, and mutation receipts. Python receives no database credentials.

## What is implemented

- A floating, account-scoped Productivity Assistant with editable text and voice drafts.
- Multiple persistent conversations, older conversation/message loading, minimisation, and confirmed chat deletion.
- Registered tools for tasks, recurring habits, personal events/categories/backups, official timetable reads, bounded analytics, and timezone preferences.
- Backend-owned confirmation previews for destructive/sensitive changes, with expiry and stale-target detection.
- Separate service authentication and short-lived RS256 delegation, bound to the student, conversation, and turn.
- Durable execution results and receipt-based reconciliation. Confirmed writes, execution completion, and confirmation consumption share the existing mutation transaction.
- Shared AssemblyAI microphone/transcript implementation restored from the preserved branch archive.

No notification-reminder tool, official timetable editing, attendance updates, ordinary-task reopen, general personal-event completion, bulk import, or arbitrary HTTP/SQL tool is registered. Unsupported requests must receive an explanation or clarification.

## Local setup

From the repository root:

```sh
npm run ai:productivity:setup
```

This creates/reuses dedicated local signing/service credentials in ignored files. It does not print keys or change unrelated settings. The default callback origin is `http://localhost:3000`; for a different development port use:

```sh
node scripts/setup-productivity-ai-local.mjs http://localhost:3001
```

The user's supplied Gemini key has already been saved in this workspace's ignored `akadverse-productivity-ai/.env`. On a fresh checkout, set `GEMINI_API_KEY` there. Never commit the real file or put the key in a browser-public environment variable.

Install and start the service:

```sh
cd akadverse-productivity-ai
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
# From the repository root, in a separate terminal:
npm run dev:ai
```

For Windows, use `.venv\Scripts\python`, `.venv\Scripts\pip`, and `.venv\Scripts\uvicorn`.

`npm run dev:ai` reads the root `.env.local` service URL and starts Python on that port (fresh setup defaults to 8001); `PRODUCTIVITY_AI_SERVICE_URL` in the root `.env.local` must match the port used by uvicorn. The service must return JSON `{"status":"ok"}` at `/health`; a Python static file server is not the assistant API.

The Core migration `20261115000000_productivity_ai_assistant` was applied to the configured Supabase Core database with user authorization on 16 November 2026. For a different environment, apply its migrations before using the assistant.

Do not run `prisma migrate reset` to install this feature. The migration is additive and does not replace existing productivity data. `prisma generate` alone updates the client, not the database tables.

Open `/studashboard/productivity-layer`, choose **Assistant**, and start a conversation. The browser calls Next.js; it never calls Gemini or Python directly.

## Environment placement

| Variable | Next.js | Python | Notes |
| --- | --- | --- | --- |
| `PRODUCTIVITY_AI_SERVICE_URL` | Required | No | Canonical Python origin; HTTPS outside loopback development. |
| `PRODUCTIVITY_AI_SERVICE_TOKEN` | Required | Required | Dedicated shared service credential, at least 32 characters. |
| `PRODUCTIVITY_AI_JWT_PRIVATE_KEY` | Required | Never | RS256 PEM signing key. |
| `PRODUCTIVITY_AI_JWT_PUBLIC_KEY` | Recommended | Required | Matching public PEM verification key. |
| `PRODUCTIVITY_AI_JWT_KEY_ID` | Required to match | Required to match | Defaults to `productivity-v1`; change consistently during rotation. |
| `AKADVERSE_API_BASE_URL` | No | Required | Canonical Next.js origin; callback URLs are fixed under this origin. |
| `GEMINI_API_KEY` | No | Required | Provider credential; never sent to Next.js/browser. |
| `GEMINI_MODEL` | No | Optional | Defaults to `gemini-3.5-flash-lite`; change deliberately after checking project availability. |
| `MAX_TOOL_CALLS` | No | Optional | 1–10, default 10. |
| `TURN_TIMEOUT_SECONDS` | No | Optional | 5–55, default 55 seconds. |
| `ASSEMBLYAI_API_KEY` | Required for voice | Never | Existing shared speech provider credential. |
| Existing database/NextAuth settings | Existing app | Never | Python has no database URL or NextAuth secret. |

Use quoted `\n` escapes for PEM values when necessary; both implementations normalise them. The setup script creates a matching pair and preserves the existing provider credential on rerun. Examples contain placeholders only.

The assistant defaults to Gemini 3.5 Flash-Lite, which supports function calling and has a free tier subject to project quota. A model name does not change the project's billing tier. See [Google's pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).

## HTTP contracts

### Browser → Next.js

`GET /api/productivity/assistant` lists the latest 30 owned conversations. Supply `cursor=<conversationId>` for another page. `GET ...?conversation=<id>` loads the latest 60 messages and current operation/proposal information; `before=<sequence>` loads earlier messages.

`POST /api/productivity/assistant` accepts these actions:

```json
{"action":"create"}
```

```json
{"action":"chat","conversation_id":"...","request_id":"stable-client-uuid","message":"Show my pending tasks"}
```

```json
{"action":"decide","conversation_id":"...","request_id":"stable-decision-uuid","pending_id":"...","confirm":true}
```

```json
{"action":"reconcile","conversation_id":"...","request_id":"...","execution_id":"..."}
```

```json
{"action":"delete","conversation_id":"...","request_id":"...","confirmed":true}
```

All browser actions require a current Core student session, same-origin JSON, and ownership checks. `x-productivity-user` detects account switches but never authenticates the caller. The standard response envelope is `{result: ...}` or a sanitised public error with a reference ID.

### Next.js → Python

`POST /api/v1/assistant/chat` requires both:

```text
Authorization: Bearer <short-lived token for akadverse-productivity-ai>
X-Productivity-Service-Token: <dedicated service credential>
```

```json
{"conversation_id":"...","turn_id":"...","callback_token":"<separate backend-audience token>"}
```

The service verifies both tokens and their shared subject/conversation/turn binding. There is no client-authoritative user ID or timezone. It obtains those facts from the backend.

Response:

```json
{"message":"A human-readable response","status":"completed"}
```

Statuses include `completed`, `awaiting_clarification`, `awaiting_confirmation`, and `failed`. Actual mutation results remain in Next.js-owned execution rows; provider prose is not proof of a write.

`GET /api/v1/assistant/conversations/{conversation_id}` is a delegated, active-turn context read. It also needs the callback token in `X-Productivity-Callback-Token`. General browser history retrieval remains in Next.js.

`GET /health` returns only `{"status":"ok"}`. It is a process liveness check, not verification of Gemini credentials or database migrations.

### Python → Next.js

The exact callback path is `POST /api/productivity/assistant/service`. It bypasses only the proxy cookie gate and independently requires the dedicated service credential and a valid RS256 token for audience `akadverse-productivity-backend`. The route revalidates the Core student and active turn.

Allowed actions are `context` and `tool`. A tool call supplies `step`, registered `name`, and validated `arguments`. There is no service action that lets Python approve a pending proposal. Confirmations execute through the owning browser endpoint.

Python uses one fixed backend origin, disables redirects, bounds response sizes, and validates arguments against [the shared registry](app/tools/definitions.json). Next.js independently validates the same schema and applies existing domain rules.

## Confirmations, retries, and history

Edits, archive/delete operations, habit outcomes/corrections, replanning, backups, missed personal events, timezone changes, and conflict overrides use previews. Simple explicitly requested creates and eligible ordinary-task outcomes can execute directly.

Previews expire after ten minutes and bind the current target state. A changed record invalidates the proposal. Expired or failed proposals should be cancelled before asking for a replacement. Typed “yes” does not substitute for the authenticated Confirm control.

The current workflow stops at a confirmation. Confirming applies that proposal and records a deterministic reply; it does not autonomously resume every remaining step of a long earlier request. Ask for the remaining steps after inspecting the confirmed result.

User messages have stable client identities. Tool steps use backend operation identities derived from the saved message and step. Retrying the same request cannot mint a new record merely because the network response was lost. Completed mutation receipts and execution results commit together. **Recheck outcome** consults the original receipt and fences an expired worker; it does not ask Gemini to repeat the write.

A 90-second lease serialises a conversation's turns. The Python turn limit is 55 seconds; Next.js allows 65 seconds for the service request and exports a 120-second route duration. Hosts must support these limits. Interrupted turns recover on reload after their lease expires. Model/provider calls and confirmation waits do not hold database transactions open.

The backend limits a student to 30 new conversations per day and 30 messages/decisions per hour. These limits use persisted rows. Speech issuance uses the existing process-local rate limiter (four token requests per ten minutes); that limiter is not a global multi-instance quota or a billing ledger.

## Voice

Shared endpoints are `/api/speech/token` and `/api/speech/usage`. Core student authentication matches Productivity access; an E-Learning profile is not required. Existing Stuwart authorisation is unchanged because this branch did not previously expose these shared speech routes.

The microphone sends PCM audio directly to AssemblyAI using a temporary token. Partial/final transcripts populate an editable draft. Stop finalises; Cancel releases resources and preserves committed/manual text. Sending always requires the student's Send action. Python and Gemini receive no microphone bytes. HTTPS or loopback is required by browser microphone permissions.

A process liveness check or synthetic transcript test does not prove that a real device microphone and AssemblyAI session work on the deployment. Test those with a consenting user's browser after the service configuration is installed.

## Deployment

1. Review/apply the additive Core migration with your normal migration credentials and workflow. Generate the Prisma client in the Next.js build.
2. Deploy this directory as a separate Python service. The Dockerfile installs pinned runtime dependencies and runs as a non-root user. Railway can build from this directory; its `PORT` is respected.
3. Set the Python provider key, model, backend origin, service credential, public key, and key ID in that service's secret configuration.
4. Set the matching service URL/credential and signing keys in the Next.js server environment. Keep the private key exclusively in Next.js.
5. Retain the AssemblyAI key in Next.js if voice should be enabled. Do not upload `.env`, `.venv`, browser profiles, or temporary recordings.
6. Redeploy/restart both services, check Python `/health`, then run the signed-in smoke workflow below.
7. Verify both services can reach their fixed callback origins over HTTPS and that proxy/platform policies allow the exact callback path. CORS is not authentication.

No remote database, Railway service, or Vercel setting was modified in this implementation session. The repository includes a generated migration and local configuration, not a published deployment.

Conversation retention is currently explicit user deletion; there is no scheduled expiry job. Database access is scoped in application services and ownership constraints; this implementation does not introduce browser Supabase table access or a separate Python migration system. Plan a retention policy and shared speech quota storage before scaling across instances.

## Tests

From the repository root:

```sh
npm run test:productivity:ai
npm run test:productivity:ai:db
npm run test:productivity:ai:browser
npm run test:productivity
npm run typecheck
npm run lint
```

The database test helper rejects non-loopback database URLs. Browser verification uses an isolated Chromium profile and fixture HTTP responses; it does not sign in to real accounts or contact AI providers. Set `CHROME_BIN` if Chrome is installed elsewhere.

Python:

```sh
cd akadverse-productivity-ai
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

Routine Python tests use provider stubs and mock HTTP transports. They cover the SDK-compatible declarations, validated execution loop, call ID propagation, bounds, authentication/token binding, pending confirmations, failure/unknown results, duplicate writes, fixed destinations, redacted failure responses, and streamed body limits.

## Manual smoke workflow

1. Open the assistant as Student A and start a conversation.
2. Ask “What is my account timezone and today's local date?” Check against Account settings.
3. Ask “Create a medium-priority task called AI TEST reading, due tomorrow.” Find the actual task in To-do List and after refresh.
4. Ask to change that task's priority. Inspect the exact record/fields in the proposal; Cancel and verify no change. Ask again and Confirm.
5. Ask to delete it. Verify the preview and confirmation are required.
6. Create a daily habit and inspect its linked occurrence; ask for a future outcome and verify it is rejected.
7. Create a category and event with explicit date/time/description. Test a conflict and an equal-duration later backup.
8. Minimise/reopen the panel, switch sections, refresh, and continue an older conversation.
9. Record speech, inspect partial text, edit it, Stop/Cancel, then explicitly Send. Deny microphone access once and verify typing remains possible.
10. Switch to Student B. A's conversations, drafts, proposals, and records must be absent.
11. Delete a disposable conversation and verify its already-saved productivity records remain.
12. Simulate a provider failure or lost connection. Inspect actual operation rows and Recheck outcome before repeating a write.

## Verification boundaries

See the [implementation verification report](../docs/productivity-ai-verification.md) for the actual results and remaining live-provider/deployment limits. No documentation checklist should be interpreted as a passed live acceptance test.

### Backend failures and database references

`category=backend` means the assistant's callback to AkadVerse failed; it does not mean Gemini rejected the request. Logs now include safe `action`, HTTP `status`, allowlisted `code` and `reference_id`, matching Next.js's error reference. DATABASE_UNAVAILABLE and DATABASE_TIMEOUT also receive explicit user-facing messages. Raw database/provider errors, credentials and callback tokens are never included. Mutations are not automatically retried; inspect saved operation results before repeating a change. See [backend incident and verification](../docs/productivity-ai-backend-failure.md).
