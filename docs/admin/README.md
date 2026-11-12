# Admin System — Documentation

## What this is

The Admin Dashboard is the Marketplace's oversight surface: an admin-only area for managing users, verifying and blocking businesses, reviewing disputed orders, auditing order history, monitoring late-delivery fines, and reviewing reported businesses. It's an extension of the Marketplace's pre-existing (smaller) admin area — deliverer-application approval and delivery-coordinator assignment, documented in [`docs/marketplace/systems/deliverer-system.md`](../marketplace/systems/deliverer-system.md) and [`delivery-coordinator-system.md`](../marketplace/systems/delivery-coordinator-system.md) — not a parallel system.

This folder is organized like [`docs/marketplace/`](../marketplace/README.md) (same reason: a developer should be able to find "how does X work" without asking the person who built it), scoped specifically to the admin surface. For everything the admin surface *reads* (order events, fines, businesses, deliverer applications), the underlying domain systems are still documented in `docs/marketplace/` — this folder documents the admin-specific layer: who can access it, what it adds (verification, blocking, reports, disputes, user promotion), and how.

## Who uses it

Any user with `User.isAdmin === true` — independent of their `role` (a student, faculty, admin, or super_admin account can independently also be an admin). See [`decisions/admin-flag-replaces-role-check.md`](decisions/admin-flag-replaces-role-check.md). There is no self-service path — the only way to gain admin access is an existing admin granting it via the Users tab, and the only way to lose it is an existing admin (including yourself) revoking it.

## Where things live

- **UI**: `src/app/studashboard/admin/marketplace/` — `layout.tsx` (shared chrome), `page.tsx` (Overview), and one folder per tab (`users/`, `verifications/`, `disputes/`, `events/`, `fines/`, `businesses/`, `reports/`), plus the pre-existing `deliverers/` and `deliveries/` pages.
- **API**: `src/app/api/marketplace/admin/**` — every route gated by `requireAdmin()` (`src/lib/admin.ts`), route → `route.controller.ts` → service, same convention as the rest of the Marketplace backend.
- **Services**: `services/marketplace/admin/` — one file per action (`verify-business.ts`, `promote-user-to-admin.ts`, etc.), plus two shared helpers (`shared/pagination.ts`, `shared/log-admin-action.ts`).
- **Buyer-facing triggers**: `services/marketplace/business/report-business.ts` and `services/marketplace/order/dispute-order.ts` — the only way Reports/Disputes ever get real data; see [`systems/disputes.md`](systems/disputes.md) and [`systems/reports.md`](systems/reports.md).

## Documentation map

- [`architecture.md`](architecture.md) — how the pieces fit together, request flow, and the authorization boundary.
- [`systems/`](systems/) — one file per admin capability: [`user-management.md`](systems/user-management.md), [`business-oversight.md`](systems/business-oversight.md) (verification + blocking), [`disputes.md`](systems/disputes.md), [`reports.md`](systems/reports.md), [`events-and-fines.md`](systems/events-and-fines.md).
- [`security/authorization.md`](security/authorization.md) — the `requireAdmin()` gate, what it does and doesn't protect, and how self-promotion is prevented.
- [`decisions/`](decisions/) — why admin access is an independent `isAdmin` flag rather than a role, why blocking is a flag not a delete, why disputes/reports needed new buyer-facing triggers to be real.
- [`data/schema.md`](data/schema.md) — the new `Business` fields, `BusinessReport`, `AdminActionLog`, and the reused-but-previously-dormant `Order` dispute columns.
- [`todo/phase-01-admin-dashboard.md`](todo/phase-01-admin-dashboard.md) — what's built vs. what's still a known gap.
- [`log/2026-08.md`](log/2026-08.md) — the development log entry for this pass.

## Where to start

Read [`architecture.md`](architecture.md), then [`security/authorization.md`](security/authorization.md) — the authorization model is the one thing every other page in this folder assumes you already understand.
