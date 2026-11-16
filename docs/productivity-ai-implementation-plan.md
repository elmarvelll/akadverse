# Productivity Assistant: approved implementation plan

The user approved implementation after the Stage 1 audit on 15 November 2026. This file fixes the implementation decisions before code changes.

## Contracts

- Browser: `/api/productivity/assistant` supports owned conversation list/detail/create, chat turns, cancellation of a pending action, and confirmation. All requests use the existing NextAuth student session and same-origin JSON checks. Browser-supplied IDs never establish ownership.
- Service callback: exact path `/api/productivity/assistant/service`, exempt only from the proxy's cookie gate; the route requires a dedicated service credential and an RS256 context token with `akadverse-productivity-backend` audience. Identity, conversation, and turn are bound into that token.
- Python: standalone `akadverse-productivity-ai`, FastAPI, `/api/v1/assistant/chat`, owned delegated conversation read, and `/health`. Confirmation executes in the authenticated Next.js browser endpoint, so Python cannot approve its own proposal.
- Next.js signs separate five-minute tokens for Python and backend audiences. Python holds only the public verification key and dedicated service credential. No browser cookies, NextAuth secret, provider key, or database connection is passed between trust boundaries unnecessarily.
- Gemini SDK function calling uses an explicit allowlist with automatic execution disabled. Python validates each tool's arguments; Next.js repeats validation and ownership/business-rule checks.

## Persistence and execution

Add Core-owned conversation, message, execution, and pending-action models. Use monotonically allocated message ordering and unique client turn IDs. A bounded lease serialises turns. Rate limits use persisted message counts, not only process memory.

The existing dispatcher gains a trusted actor entry point and transaction hooks while its browser entry point retains session authentication. Receipted mutations, execution completion, and pending-action consumption commit together. Unknown outcomes retry with the original operation identity; completed receipts never become new writes. Confirmation previews bind canonical arguments and target fingerprints, expire after ten minutes, and require a current browser decision. Partial successes remain visible as individual execution results.

Initial tools cover context/tasks, habit rules/outcomes/replanning, personal categories/events/backups/archive, official timetable reads, bounded analytics, and timezone preferences. Bulk import/export, reminders, attendance, ordinary-task reopening, and unsupported personal-event completion are excluded. Personal-event missed recording is exposed with existing elapsed-end rules. Archive/delete, edits, outcome corrections, conflict overrides, missed-personal-event recording, backup removal, and timezone changes use confirmations. Ordinary explicitly requested creates and initial completions keep a direct flow.

## Memory and UI

Persist messages and tool metadata in Core via Next.js. Limit model context to recent messages plus relevant current records; never supply a complete database dump. Read tools return bounded projections with explicit truncation. A floating account-scoped panel supports conversations, minimisation, drafts, actual execution statuses, clarification, confirmation/cancellation, retry, record links, and refresh after saved mutations. Use existing CSS conventions and reduced-motion support; keep native-dialog interactions accessible.

## Voice

Restore the preserved shared AssemblyAI adapter, browser session/draft processing, voice controls, worklet, and follow-latest hook. Adapt token/usage routes to the existing Core student policy used by Productivity; preserve provider credentials server-side and same-origin checks. Voice inserts partial/final text into an editable composer and never sends automatically. No raw audio reaches Python or Gemini.

## Delivery order and verification

1. Backend delegated authentication and trusted executor.
2. Core schema/migration and durable conversations/executions/confirmations.
3. FastAPI foundation, Gemini adapter, validated tool orchestration.
4. Floating frontend and confirmed-result refresh.
5. Shared AssemblyAI integration.
6. Meaningful auth/ownership/replay/confirmation/concurrency tests, Python provider-stub tests, TypeScript/lint/build checks as appropriate, and local database integration.
7. Deployment instructions and exact remaining configuration/reporting.

Use a configurable Gemini model rather than claiming a fixed latest model. Generate dedicated local service/signing secrets into ignored configuration. The user-supplied Gemini key belongs only in ignored Python configuration. Apply migrations only to an explicitly identified local disposable database during verification; publish the migration for normal deployment instead of silently changing a remote database. No deployment, commit, or push is included.
