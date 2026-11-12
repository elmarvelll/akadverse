# System: Disputes (Admin + Buyer)

## Purpose

Lets a buyer flag their own order as disputed, and lets a `super_admin` review and resolve disputed orders with full historical context.

## Why this needed a new buyer-facing trigger

`Order.isDisputed`/`disputeReason`/`disputeCreatedAt`/`disputeResolvedAt`/`disputeResolvedBy`/`disputeResolution` already existed in the schema before this pass but were completely unused — nothing anywhere could ever set `isDisputed = true`. Building an admin *view* of disputes without also building a way to *create* one would have made the Disputes tab permanently, structurally empty — not a real feature. This pass adds the minimal buyer-facing trigger: a "Dispute this order" action on the buyer's own order-tracking page.

## Responsibilities

- Buyer: open a dispute on their own order, with a reason.
- Admin: list disputed orders (optionally filtered to open/resolved), see full context (buyer, business, items, amount, current order/fulfillment/delivery/payment state) and the complete historical `OrderEvent` trail for that order — not just its current state.
- Admin: resolve a dispute with a resolution note.

## Actors

Buyer (opens); `super_admin` (reviews, resolves).

## Data

The pre-existing `Order` dispute columns (now actually used) + `OrderEvent` (two new event types: `DISPUTE_OPENED`, `DISPUTE_RESOLVED`).

## Inputs

Buyer: `orderId` (their own order only) + reason. Admin: `orderId` + resolution note.

## Outputs

`AdminDisputeRow[]` (with nested `items[]` and `events[]`), 200/404/409/400 on the mutating actions.

## Database

`Order.isDisputed`/`disputeReason`/`disputeCreatedAt`/`disputeResolvedAt`/`disputeResolvedBy`/`disputeResolution`, `OrderItem` (for the items list), `OrderEvent` (for history).

## API

| Route | Method | Actor | Purpose |
|---|---|---|---|
| `/api/marketplace/orders/[id]/dispute` | POST | Buyer | Open a dispute on their own order |
| `/api/marketplace/admin/disputes` | GET | Admin | List disputed orders |
| `/api/marketplace/admin/disputes/[orderId]/resolve` | POST | Admin | Resolve |

## Services

`services/marketplace/order/dispute-order.ts` (buyer), `services/marketplace/admin/list-disputed-orders.ts`, `resolve-dispute.ts` (admin).

## Components

`src/app/studashboard/marketplace/orders/page.tsx` (buyer — "Dispute this order" action), `src/app/studashboard/admin/marketplace/disputes/page.tsx` (admin — expandable rows showing reason, resolution, order state, items, and the full event trail).

## Authentication / Authorization

Buyer route: session required, and the order must belong to the requesting user (`prisma.order.findFirst({ id, userId })` — a buyer cannot dispute someone else's order, not even by guessing an order id). Admin routes: `requireAdmin()`.

## State transitions

`isDisputed`: `false → true` (buyer opens) `→ false` (admin resolves, with `disputeResolvedAt`/`By`/`Resolution` set). A resolved dispute stays visible in the list (filterable) — nothing is deleted.

## Error handling

Buyer: 404 if the order isn't theirs, 409 if already disputed, 400 if no reason given. Admin: 404 if the order doesn't exist, 409 if not currently disputed, 400 if no resolution note given.

## Edge cases

- **A buyer disputing an order twice**: the second attempt 409s (`order.isDisputed` already true) rather than overwriting the first dispute's reason/timestamp.
- **Historical, not just current-state**: the admin view's `events[]` array is every `OrderEvent` for that order in chronological order, regardless of the order's current status — an order sitting at `DELIVERED` still shows the full path it took to get there (`PENDING_SELLER → ACCEPTED → ... → DELIVERED`), per the explicit requirement.

## Notifications

None — no email is sent to either party when a dispute is opened or resolved in this pass.

## Cron jobs

None.

## Dependencies

`OrderEvent` (pre-existing system, see [`docs/marketplace/systems/order-history-system.md`](../../marketplace/systems/order-history-system.md)).

## Usage

Buyer: `studashboard/marketplace/orders`. Admin: `studashboard/admin/marketplace/disputes`.

## Relevant files

- `services/marketplace/order/dispute-order.ts`
- `services/marketplace/admin/{list-disputed-orders,resolve-dispute}.ts`
- `src/app/api/marketplace/orders/[id]/dispute/**`, `src/app/api/marketplace/admin/disputes/**`
- `src/app/studashboard/marketplace/orders/page.tsx`, `src/app/studashboard/admin/marketplace/disputes/page.tsx`
