# System: Order (full lifecycle)

## Purpose

Represents one seller's (one business's) side of a checkout, from payment confirmation through seller decision, fulfillment, delivery, and (per item) escrow/payout or refund.

## The full pipeline, as implemented

```text
Checkout & payment (checkout-and-payment-system.md)
  -> Order created: status=PENDING_SELLER, estimatedDeliveryAt/deliveryWindow set
  -> payment confirmed -> ORDER_CREATED + SELLER_NOTIFIED events, seller emailed
Seller response (seller-response-system.md)
  -> ACCEPTED (fulfillmentStatus: PROCESSING) or REJECTED (reason required,
     items refunded) — or auto-REJECTED by the 5-hourly cron after 24h
Seller processing (seller-processing-system.md)
  -> fulfillmentStatus: PROCESSING -> READY_FOR_PICKUP ("Mark ready")
     buyer emailed with estimated delivery date/window
Central drop-off (central-dropoff-system.md)
  -> seller confirms drop-off; 15-hour deadline enforced
     (late-delivery-fine-system.md if missed)
Delivery coordinator (delivery-coordinator-system.md)
  -> admin assigns dropped-off items to an approved deliverer
Deliverer pickup (deliverer-system.md)
  -> seller<->deliverer OTP handoff -> fulfillmentStatus: HANDED_TO_DELIVERER
Delivery (delivery-system.md)
  -> out for delivery (buyer OTP issued) -> delivered (buyer OTP verified)
     or failed (24h retry, second failure = item cancelled)
Escrow (escrow-system.md)
  -> delivered item: HELD -> PAYOUT_PENDING
  -> rejected/cancelled item: HELD -> REFUND_PENDING -> REFUNDED
Seller payout (seller-payout-system.md)
  -> 5-hourly cron: PAYOUT_PENDING -> PAYOUT_PROCESSING -> PAYOUT_SUCCESS/FAILED
```

Every step above records an `OrderEvent` — see [`order-history-system.md`](order-history-system.md).

## State fields — who owns what

| Concern | Field(s) | Model |
|---|---|---|
| Seller's accept/reject decision | `status` (`OrderStatus`) | `Order` |
| Seller's fulfillment progress | `fulfillmentStatus` (`FulfillmentStatus`) | `Order` |
| Order-level delivery rollup | `deliveryOutcome` (`OrderDeliveryOutcome`) | `Order` |
| Per-item delivery progress | `deliveryStatus` (`DeliveryStatus`), `deliveryAttempted` | `OrderItem` |
| Per-item money | `escrowStatus`, `payoutStatus` | `OrderItem` |

This separation (order status ≠ fulfillment ≠ delivery ≠ payment) is deliberate — see [`../decisions/separate-status-fields.md`](../decisions/separate-status-fields.md).

## Partial delivery

`Order.deliveryOutcome` can be `PARTIALLY_DELIVERED` when some items are `DELIVERED` and others aren't (yet, or ever — cancelled after a second failed attempt). Recomputed after every relevant item change by `services/marketplace/order/order-events.service.ts#recomputeOrderDeliveryOutcome`. Individual item statuses remain authoritative — the buyer's order-tracking page (`studashboard/marketplace/orders/page.tsx`) always shows per-item status, never collapses to one line.

## Actors

Buyer (owns the order, views tracking), Seller (accept/reject/process/drop-off), Deliverer (pickup/delivery), Admin (coordinator assignment), System/Cron (auto-reject, payout, retry).

## API surface

See each linked system's own API table above — there is no single "order detail" route; state is read through the seller dashboard's list (`GET /businesses/[id]/orders`), the buyer's list (`GET /marketplace/orders`), and the deliverer's own views.

## Notifications

See [`email-system.md`](email-system.md) for the full list — nearly every transition in this pipeline triggers an email to the relevant party.

## Database

`Order`, `OrderItem`, `OrderEvent`, plus every model referenced by the linked systems (`Deliverer`, `Delivery`, `DeliveryItem`, `Delivery_x_businesses`, `LateDeliveryFine`).

## Relevant files

Every file listed in the linked systems' own "Relevant files" sections.
