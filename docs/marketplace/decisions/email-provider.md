# Decision: Resend for transactional email

- **Date**: 2026-08-28.
- **Context**: No email/notification system existed for the Marketplace before this pass; the order/delivery pipeline requires many transactional emails (new order, ready, OTP, failure, payout, etc.).
- **Options considered**: 1) Resend (API-based provider). 2) SMTP via nodemailer. 3) Build the state machine only, stub email sending for later.
- **Chosen option**: 1 — Resend, via `services/marketplace/notifications/email.service.ts`.
- **Reason**: Decided directly with the user at the start of this implementation. A simple API-based SDK fits a Next.js app well without needing SMTP credentials/connection management.
- **Consequences**: `RESEND_API_KEY` must be set for real email delivery; without it, `sendEmail()` logs a warning and no-ops rather than failing (see [`../systems/email-system.md`](../systems/email-system.md)) — so the app functions correctly in an environment without the key configured, just silently without email. `resend` was added as a new npm dependency (`package.json`).
- **Alternatives rejected**: SMTP/nodemailer — not chosen, per the direct decision above. Stub-only — not chosen, since a real provider was preferred over deferring the integration.
