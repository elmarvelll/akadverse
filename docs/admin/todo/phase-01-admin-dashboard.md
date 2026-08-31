# Phase 1 — Admin Dashboard

## Objective

Give an admin (`User.isAdmin`, independent of `role` — see [`../decisions/admin-flag-replaces-role-check.md`](../decisions/admin-flag-replaces-role-check.md)) real oversight of the Marketplace: users, businesses, disputes, order history, fines, and reports.

## Status: ✅ Done for what was scoped, with documented gaps

- [x] Server-side-only authorization — every admin route gated by `requireAdmin()`, verified live for the unauthenticated case; verified by code inspection (grep, no route missing the check) for the wrong-role case. See [`../security/authorization.md`](../security/authorization.md).
- [x] Admin Main Menu + shared layout (`studashboard/admin/marketplace/layout.tsx`) — the 8 required tabs, plus the pre-existing deliverer/delivery-coordinator pages linked from Overview.
- [x] Overview — real user/business counts; Skill Owners "Coming Soon" (no such concept exists yet — see `docs/marketplace/systems/skills-marketplace-mock.md`).
- [x] Users — search, detail, grant/revoke admin access (`User.isAdmin`, both directions implemented).
- [x] Verifications / Businesses — verify, block (with reason), unblock. Blocking is a flag, never a delete.
- [x] Disputes — buyer-facing "Dispute this order" trigger (new; the columns existed, nothing used them before) + admin list/resolve with full historical `OrderEvent` context.
- [x] Events — cross-order `OrderEvent` feed with business/seller names resolved, not just IDs.
- [x] Fines — real, server-verified payment status/reference (never trusts the frontend).
- [x] Reports — buyer-facing "Report business" trigger (new; no reporting system existed before) + admin list/review.
- [x] `AdminActionLog` for non-order-scoped admin actions; `OrderEvent` (`DISPUTE_OPENED`/`DISPUTE_RESOLVED`) for dispute actions.
- [x] Offset-based pagination, new to this codebase, added specifically because admin lists are the first genuinely-unbounded lists in the app.

## Known gaps

- [ ] **`Business.blocked` isn't enforced anywhere outside the admin UI** — no buyer/seller route checks it yet. The flag and its audit trail are real; the restriction itself isn't wired into checkout/product-listing/order flows.
~~- No demotion path~~ — closed: `revoke-admin.ts` + the Users tab's "Remove admin" action.
- [ ] **No "unverify" action** — verification is one-way.
- [ ] **No email notifications** for any admin action (promotion, verification, blocking, dispute resolution, report review) — all are visible in the dashboard/audit logs, none trigger `services/marketplace/notifications/email.service.ts`.
- [ ] **No admin tooling for skill-owner or skills-marketplace oversight** — correctly out of scope, since that system is still mock data (`docs/marketplace/systems/skills-marketplace-mock.md`).
- [ ] **No bulk actions** anywhere in this surface (bulk verify, bulk block, bulk review) — every action is one row at a time.
- [ ] **Live 403-for-wrong-role wasn't tested end-to-end** in this pass (would need a real non-admin test session) — see [`../security/authorization.md`](../security/authorization.md) for exactly what was and wasn't verified.
- [ ] **No automated tests** for any of the new services/routes — verified via `tsc`/`next build`/`lint` passing and one live `curl` check, consistent with how the rest of the Marketplace has been verified so far (see `docs/marketplace/todo/phase-08-testing-and-hardening.md`).

## Dependencies

`docs/marketplace/systems/order-history-system.md`, `late-delivery-fine-system.md`, `deliverer-system.md`, `delivery-coordinator-system.md`.

## Relevant systems

[`../systems/`](../systems/) — one file per capability.
