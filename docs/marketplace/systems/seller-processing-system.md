# System: Seller Processing & Fulfillment

## Purpose

Tracks an accepted order from "seller is preparing it" through "seller has physically dropped it at the central drop-off point," using `Order.fulfillmentStatus` — deliberately separate from `Order.status` (the accept/reject decision) and from delivery/escrow state. See [`../decisions/separate-status-fields.md`](../decisions/separate-status-fields.md).

## States

```text
PROCESSING          — set the moment the seller accepts (src/app/api/.../accept/route.ts)
READY_FOR_PICKUP     — seller clicks "Mark ready" once the order is prepared
HANDED_TO_DELIVERER  — set once the seller<->deliverer pickup OTP is verified (see deliverer-system.md)
```

## Actors

Seller.

## Key timestamps (all on `Order`, part of the order-history system — see [`order-history-system.md`](order-history-system.md))

- `sellerMarkedReadyAt` — set on "Mark ready."
- `pickupScheduledAt` — reserved for the delivery coordinator to set once assignment happens; not yet written by any route (**Undocumented / requires clarification** — the coordinator assignment flow currently doesn't schedule a specific pickup time, only assigns; wiring this up is listed in [`../todo/phase-04-delivery.md`](../todo/phase-04-delivery.md)).
- `sellerDroppedOffAt` — set when the seller confirms drop-off (see [`central-dropoff-system.md`](central-dropoff-system.md)).
- `delivererConfirmedPickupAt` — set once the deliverer's OTP-verified pickup completes.

## Buyer notification on "ready"

The moment an order is marked `READY_FOR_PICKUP`, the buyer is emailed the estimated delivery date and delivery window (`services/marketplace/notifications/email.service.ts#buyerOrderReadyEmail`), computed once at checkout time and stored on the `Order` — not recalculated at "ready" time, so the estimate a buyer saw at checkout matches what they're told later. See [`estimated-delivery-and-windows.md`](../data/estimated-delivery-and-windows.md).

## API

`POST /api/marketplace/businesses/[id]/orders/[orderId]/ready` — the only mutation this system owns directly (drop-off has its own system, see below).

## Error handling

409 if the order isn't currently `ACCEPTED` + `PROCESSING` when "ready" is called.

## Dependencies

Depends on: [`seller-response-system.md`](seller-response-system.md) (an order must be `ACCEPTED` first).
Depended on by: [`central-dropoff-system.md`](central-dropoff-system.md), [`deliverer-system.md`](deliverer-system.md).

## Relevant files

`src/app/api/marketplace/businesses/[id]/orders/[orderId]/ready/route.ts`.
