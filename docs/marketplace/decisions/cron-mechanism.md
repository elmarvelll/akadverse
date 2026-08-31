# Decision: Cron jobs are authenticated API routes on Vercel Cron, not an in-process scheduler

- **Date**: 2026-08-28.
- **Context**: Five time-based Marketplace rules (seller response, seller payout, deliverer inventory, delivery schedule, delivery retry) need scheduled execution, and nothing in the codebase had ever implemented a cron/scheduler before this pass.
- **Options considered**: 1) `node-cron` (or similar) registered in-process at app startup. 2) Plain API routes under `/api/cron/*`, each independently authenticated via a shared secret, triggered externally by Vercel Cron (`vercel.json`).
- **Chosen option**: 2.
- **Reason**: `node-cron` requires a long-lived Node process to keep its timers alive — incompatible with a serverless/edge deployment target, which Next.js on Vercel typically is (and which this codebase's existing `next build`/`next start` scripts don't rule out either way, but nothing about the app's architecture assumes a persistent process). Vercel Cron + authenticated routes works regardless of the exact deployment model, and keeps each cron as an independently testable, independently callable HTTP endpoint. This was decided with the user directly at the start of this implementation, not assumed.
- **Consequences**: `CRON_SECRET` must be configured in the deployment's environment variables, and `vercel.json`'s `crons` array must be present, for the schedules to actually fire in production. In any environment where Vercel Cron isn't the actual scheduler (e.g. self-hosted, a different platform), an equivalent external scheduler must be pointed at the same `/api/cron/*` routes with the same `Authorization: Bearer $CRON_SECRET` header.
- **Alternatives rejected**: In-process `node-cron` — rejected for the deployment-compatibility reason above.
