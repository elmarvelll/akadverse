# Phase 6 — Notifications & Cron Infrastructure

## Status: ✅ Done (email + cron); in-app notifications still not wired

- [x] Cron mechanism decided and built: authenticated `/api/cron/*` routes + Vercel Cron (`vercel.json`). See [`../decisions/cron-mechanism.md`](../decisions/cron-mechanism.md), [`../systems/cron-system.md`](../systems/cron-system.md).
- [x] Email sending implemented via Resend. See [`../decisions/email-provider.md`](../decisions/email-provider.md), [`../systems/email-system.md`](../systems/email-system.md).
- [x] Every notification from the original list is implemented: seller (new order, accepted/processing, delivery failure, late delivery/restriction, payout success/failure), buyer (acceptance, ready+estimate, on-the-way, delivery OTP, failed delivery+retry, refund), deliverer (daily schedule digest, application approval).
- [ ] **In-app `Notification` model is still unused.** `NotificationDropdown.tsx` still always renders empty — no Marketplace code path creates a `Notification` row. Wiring each `sendEmail` call site to also write a `Notification` row is the natural next step if in-app notifications are wanted alongside email.
- [ ] Deliverer-inventory cron is currently a read-only diagnostic (counts), not a digest email of its own — see [`../systems/cron-system.md`](../systems/cron-system.md) for why (its job — "make ready items visible" — is already satisfied by the live `GET /api/marketplace/deliverer/deliveries` the dashboard reads from).

## Dependencies

None — this phase was tackled early, ahead of Phases 3-5, exactly as recommended in the prior version of this file.

## Relevant systems

[`../systems/email-system.md`](../systems/email-system.md), [`../systems/cron-system.md`](../systems/cron-system.md)
