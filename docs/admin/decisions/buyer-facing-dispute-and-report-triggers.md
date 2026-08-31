# Decision: Disputes and Reports needed new buyer-facing triggers, not admin-view-only

- **Date**: 2026-08-28.
- **Context**: Before this pass, `Order.isDisputed` and its sibling columns existed but nothing ever set them; no reporting system (model, route, or UI) existed at all.
- **Problem**: Building only the admin-side "view disputes" / "view reports" tabs would have produced two tabs that could never show real data — no code path anywhere would ever populate them. That reads as a disconnected/mock feature even though the admin query logic itself would be entirely real.
- **Options considered**:
  1. Admin-view-only: build the tabs to correctly query the real (but always-empty) data, document the gap, ship it.
  2. Add minimal buyer-facing triggers — a "Dispute this order" action and a "Report business" action — so the tabs have a genuine path to real data.
- **Chosen option**: 2, confirmed with the requester before implementation.
- **Reason**: Option 1 would have technically satisfied "view disputes/reports" while producing something that could never be exercised end-to-end — closer to a demo than a feature. Option 2 is a small, contained addition (one modal-style action each, reusing the existing `window.prompt()` reason-entry convention already used throughout the Marketplace for reject/suspend/block reasons) that makes the whole path real.
- **Consequences**: Two new small services (`report-business.ts`, `dispute-order.ts`) and two new buyer-facing routes exist that weren't explicitly itemized in the original spec's route list — documented here so it's clear they were a deliberate, scoped addition, not scope creep. Both are owner/session-scoped like every other buyer route (a buyer can only dispute their own order; anyone signed in can report any business, since reporting is inherently about someone else's business).
- **Alternatives rejected**: A full public business-profile page (as the natural home for "Report business") was considered and rejected as out of scope for this pass — the action was placed on the existing product detail modal instead, the only place a buyer currently sees a specific business identified. See [`../systems/reports.md`](../systems/reports.md).
