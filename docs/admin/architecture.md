# Admin — Architecture

## Component diagram

```text
Browser (isAdmin session)
  │
  ├─ src/app/studashboard/admin/marketplace/layout.tsx
  │    DashboardNavbar + AdminMainMenu (navigation only — not a security
  │    boundary; every tab's data comes from an API call that re-checks
  │    requireAdmin() server-side regardless of how the URL was reached)
  │
  ├─ page.tsx (Overview) ─┬─ users/page.tsx
  │                       ├─ verifications/page.tsx
  │                       ├─ disputes/page.tsx
  │                       ├─ events/page.tsx
  │                       ├─ fines/page.tsx
  │                       ├─ businesses/page.tsx
  │                       ├─ reports/page.tsx
  │                       └─ deliverers/, deliveries/ (pre-existing)
  │
  ▼ axios (src/lib/axios.ts)
src/app/api/marketplace/admin/**/route.ts (thin)
  ▼
route.controller.ts
  │  1. requireAdmin() — src/lib/admin.ts — throws 401/403 before anything else runs
  │  2. parse/validate input (readJsonBody, query params)
  │  3. call the service
  ▼
services/marketplace/admin/*.ts (one action per file)
  ▼
Prisma → MySQL
```

## Request flow, concretely (promoting a user)

```text
Admin clicks "Grant admin" on a user row
  → POST /api/marketplace/admin/users/{userId}/promote  (userId only — no isAdmin/role field sent)
  → route.controller.ts: requireAdmin() resolves the ACTOR from the session
  → services/marketplace/admin/promote-user-to-admin.ts:
      - loads the TARGET user by the URL id, 404s if missing
      - 409s if already isAdmin (idempotent, no silent re-write)
      - sets isAdmin = true (User.role is never touched)
      - writes an AdminActionLog row (actor, action, target, message)
  → 200 { message: "User promoted to admin." }
```

`revoke-admin.ts` is the same shape in reverse (`isAdmin = false`), reachable via `.../revoke-admin`.

The actor (who is doing this) and the target (who it's being done to) are never the same lookup — the actor comes only from `requireAdmin()`'s session check; the target comes only from the URL. The request body is never trusted for identity at all (see [`security/authorization.md`](security/authorization.md)).

## Where each tab's data actually comes from

| Tab | Service | Underlying data |
|---|---|---|
| Overview | `get-overview-stats.ts` | `User.count()`, `Business.count()` |
| Users | `search-users.ts`, `get-user-detail.ts`, `promote-user-to-admin.ts` | `User` |
| Verifications | `list-businesses-for-admin.ts` (filtered) | `Business.verified` |
| Businesses | `list-businesses-for-admin.ts`, `get-business-detail-for-admin.ts`, `verify-business.ts`, `block-business.ts`, `unblock-business.ts` | `Business` |
| Disputes | `list-disputed-orders.ts`, `resolve-dispute.ts` | `Order.isDisputed`/dispute columns + `OrderEvent` |
| Events | `list-order-events.ts` | `OrderEvent`, joined through `Order` |
| Fines | `list-fines.ts` | `LateDeliveryFine` |
| Reports | `list-reports.ts`, `review-report.ts` | `BusinessReport` |

## Two audit trails, deliberately not merged

- **`OrderEvent`** — order-scoped events (dispute opened/resolved reuse this, since a dispute is inherently about one order). Pre-existing system, documented in [`docs/marketplace/systems/order-history-system.md`](../marketplace/systems/order-history-system.md).
- **`AdminActionLog`** — everything else an admin does that isn't scoped to one order (promote user, verify/block business, review report). New in this pass. See [`data/schema.md`](data/schema.md).

Merging these into one table would force every admin action to pretend it's about an `Order` (it usually isn't) or force `OrderEvent` to make `orderId` optional everywhere (which would weaken the guarantee that every order event really is about a specific order).

## Pagination — new to this codebase

Every existing Marketplace list before this pass was naturally bounded (one business's own products, one deliverer's own deliveries). The admin dashboard is the first place listing platform-wide data that can genuinely grow large, so `services/marketplace/admin/shared/pagination.ts` introduces simple offset-based `page`/`pageSize` pagination — used by Users, Businesses, Verifications, Disputes, Events, Fines, and Reports.
