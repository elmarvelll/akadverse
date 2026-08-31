# System: Admin

## This file is now a pointer, not the primary source

The admin surface grew substantially past deliverer approval and delivery-coordinator assignment — it now covers user management, business verification/blocking, disputes, order-history review, fines, and business reports. Full documentation lives in **[`docs/admin/`](../../admin/README.md)**, organized the same way as this folder (README, architecture, systems, security, decisions, data, todo, log).

## What's still true, unchanged

- Every admin function is implemented as UI pages nested under `studashboard/admin/marketplace/` rather than the platform's separate `/admindashboard` (still a "coming soon" placeholder — see [`../decisions/delivery-coordinator-is-admin.md`](../decisions/delivery-coordinator-is-admin.md)).
- Every underlying admin API call is gated server-side by `requireAdmin()` (`src/lib/admin.ts`) regardless of which URL an admin reaches it from.

## What changed since this file was last accurate

- **Authorization narrowed**: `requireAdmin()` now requires `role === "super_admin"` specifically — `role: "admin"` alone is no longer sufficient. See [`docs/admin/decisions/admin-access-level.md`](../../admin/decisions/admin-access-level.md).
- **Disputes are no longer unimplemented**: `Order.isDisputed` and its sibling columns are now read and written — a buyer can dispute their own order, and an admin can review/resolve it. See [`docs/admin/systems/disputes.md`](../../admin/systems/disputes.md).
- **Business moderation now exists**: verification and blocking, both admin-only. See [`docs/admin/systems/business-oversight.md`](../../admin/systems/business-oversight.md).
- **A reporting system now exists** (it didn't before at all): `BusinessReport`, a buyer-facing "Report business" action, and an admin review tab. See [`docs/admin/systems/reports.md`](../../admin/systems/reports.md).
- **New screens**: `studashboard/admin/marketplace/{page.tsx (Overview), users, verifications, disputes, events, fines, businesses, reports}`, alongside the original `deliverers/` and `deliveries/` pages (now sharing a common `layout.tsx` + `AdminMainMenu` instead of each rendering their own navbar).

## Relevant files

`src/lib/admin.ts`, `src/app/api/marketplace/admin/**`, `src/app/studashboard/admin/marketplace/**`, `services/marketplace/admin/**` — see [`docs/admin/architecture.md`](../../admin/architecture.md) for the full map.
