# Phase 7 — Admin & Deliverer Approval

## Status: ✅ Done for what was scoped

- [x] Marketplace-specific admin tooling: deliverer application approval, delivery-coordinator assignment (both under `studashboard/admin/marketplace/`, not the still-empty `/admindashboard`).
- [x] Deliverer application form — footer "Become a Deliverer" link, real submission flow.
- [x] Admin approval queue for deliverer applications, with reject (reason) and suspend (reason) too.
- [x] `User`-side deliverer state — via the `Deliverer` relation (see [`../decisions/...`](../decisions/) — deliberately not a duplicated status column on `User`).
- [x] Deliverer Dashboard access gating (`requireApprovedDeliverer`).

## Dependencies

Phase 4 — satisfied; built together in the same pass.

## Update (2026-08-28, later): superseded by the full Admin Dashboard

The remaining items below this line described gaps as of the original deliverer/delivery-coordinator pass. They're now closed — a full Admin Dashboard exists (user promotion, business verification/blocking, dispute resolution, order-event/fine oversight, business reports), documented in **[`docs/admin/`](../../admin/README.md)**. This phase file is kept for history rather than deleted, per the documentation's own decision-preservation rule; see [`docs/admin/todo/phase-01-admin-dashboard.md`](../../admin/todo/phase-01-admin-dashboard.md) for the current, accurate remainder.

~~- No order-dispute admin tooling (`Order.isDisputed`/etc. are still unused schema columns).~~ — now implemented, see [`docs/admin/systems/disputes.md`](../../admin/systems/disputes.md).
~~- No business moderation/admin oversight of Marketplace listings.~~ — now implemented, see [`docs/admin/systems/business-oversight.md`](../../admin/systems/business-oversight.md).
- Admin role reused wholesale for both deliverer-approval and delivery-coordinator functions — see [`../decisions/delivery-coordinator-is-admin.md`](../decisions/delivery-coordinator-is-admin.md) for the trade-off if these ever need splitting. Still true, and now also true of the entire Admin Dashboard — see [`docs/admin/decisions/admin-access-level.md`](../../admin/decisions/admin-access-level.md).

## Relevant systems

[`../systems/deliverer-system.md`](../systems/deliverer-system.md), [`../systems/admin-system.md`](../systems/admin-system.md), [`../systems/delivery-coordinator-system.md`](../systems/delivery-coordinator-system.md), and **[`docs/admin/`](../../admin/README.md)** for everything built since.
