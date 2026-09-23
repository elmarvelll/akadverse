# System: Seller Response

## Purpose

Gets a paid order in front of its seller and forces a timely decision: accept it (and start fulfilling it) or reject it (and release the buyer's money back into the refund path) — never leaves an order in limbo indefinitely.

## Responsibilities

- Notify the seller by email the moment a paid order lands (`ORDER_CREATED`/`SELLER_NOTIFIED` events, sent from payment confirmation itself).
- Let the seller explicitly accept or reject.
- Require and record a reason on rejection.
- Enforce a 24-hour response deadline, anchored to the order's actual `createdAt` — not to when a cron happens to run.
- Auto-reject anything still unanswered past that deadline, with the fixed reason **"Seller took too long to respond."**

## Actors

Seller (accept/reject), System/Cron (auto-reject on timeout).

## Data

`Order.status` (`OrderStatus`: `PENDING_SELLER` → `ACCEPTED`/`REJECTED`), `Order.rejectionReason`, `Order.autoRejected`, `Order.acceptedAt`/`rejectedAt`.

## Inputs

`POST .../orders/[orderId]/accept` (no body), `POST .../orders/[orderId]/reject { reason }`.

## Outputs

Updated order state; item-level refunds for a rejected order (see [`escrow-system.md`](escrow-system.md)); buyer/seller emails.

## Database

`Order`, `OrderItem` (rejection is mirrored onto every item so item-level escrow has something to act on), `OrderEvent`.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/businesses/[id]/orders/[orderId]/accept` | POST | Seller accepts |
| `/api/marketplace/businesses/[id]/orders/[orderId]/reject` | POST | Seller rejects (reason required) |
| `/api/marketplace/businesses/[id]/orders/[orderId]/items/[itemId]/reject` | POST | Seller rejects one item of an already-accepted order |
| `/api/cron/seller-response` | GET (cron) | Auto-rejects overdue `PENDING_SELLER` orders |

## Services / Functions

- `services/marketplace/order/order-events.service.ts#recordOrderEvent` — logs every transition.
- `services/marketplace/escrow/escrow.service.ts#refundOrderItem` — called once per item on any rejection path (explicit, item-level, or auto).

## Components

`business/[id]/orders/page.tsx` — Accept/Reject buttons in the Pending section.

## Authentication / Authorization

Seller routes go through `requireOwnedBusiness`. The cron route is unauthenticated by session (no seller is "logged in" when it runs) and instead requires `CRON_SECRET` (`src/lib/cron-auth.ts`).

## State transitions

```text
PENDING_SELLER --accept--> ACCEPTED (fulfillmentStatus: PROCESSING)
PENDING_SELLER --reject (reason)--> REJECTED
PENDING_SELLER --24h elapsed, no response--> REJECTED (autoRejected: true, reason: "Seller took too long to respond.")
```

## Error handling

409 if the order isn't currently `PENDING_SELLER` when accept/reject is called (prevents double-accepting or accepting-after-auto-reject races). 400 if a rejection reason is missing.

## Edge cases

- The 24-hour deadline is computed as `Order.createdAt + 24h`, checked against `now` at cron time — so a cron that's late (or runs early) doesn't shift the actual deadline; it just catches up whatever's already overdue.
- An item individually rejected on an already-`ACCEPTED` order does **not** go through this system's accept/reject transition (the order itself stays `ACCEPTED`) — see [`escrow-system.md`](escrow-system.md) for the item-level path.

## Notifications

New-order email (seller), rejection email (buyer) — see [`email-system.md`](email-system.md).

## Cron jobs

`seller-response`, every 5 hours (`vercel.json`). See [`cron-system.md`](cron-system.md).

## Dependencies

Depends on: [`../systems/checkout-and-payment-system.md`](checkout-and-payment-system.md) (order creation).
Depended on by: [`seller-order-system.md`](seller-order-system.md), [`escrow-system.md`](escrow-system.md).

## Relevant files

`src/app/api/marketplace/businesses/[id]/orders/[orderId]/{accept,reject}/route.ts`, `.../items/[itemId]/reject/route.ts`, `src/app/api/cron/seller-response/route.ts`.
