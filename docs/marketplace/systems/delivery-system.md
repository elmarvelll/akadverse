# System: Delivery

## Purpose

Tracks an assigned order item from pickup through final outcome (delivered, or cancelled after a second failed attempt), including the attempt/retry mechanics.

## Delivery attempt tri-state

`OrderItem.deliveryAttempted`: `PENDING` (no attempt made yet) / `TRUE` (last attempt succeeded) / `FALSE` (last attempt failed). Deliberately not a boolean — collapsing "not yet attempted" and "attempted and failed" into the same `false` would make the two indistinguishable. See `prisma/schema.prisma`'s comment on the `DeliveryAttempted` enum.

## Failed-attempt flow

```text
Deliverer: POST .../deliveries/[deliveryItemId]/fail-attempt { reason }

First failure (OrderItem.failedDeliveryAttempts was 0):
  DeliveryItem/OrderItem.status -> FAILED
  deliveryAttempted -> FALSE
  failedDeliveryAttempts -> 1
  retryDeliveryAt -> now + 24h
  seller + buyer emailed ("will be revisited in 24 hours")

24h later, src/app/api/cron/delivery-retry/route.ts sweeps items where
  deliveryStatus=FAILED, deliveryAttempted=FALSE, failedDeliveryAttempts=1,
  retryDeliveryAt <= now
  -> OrderItem.deliveryStatus reset to null (back in the drop-off pool —
     see delivery-coordinator-system.md's ready-items query, which
     deliberately doesn't gate on Order.fulfillmentStatus for exactly this
     re-entry case)
  -> RETURNED_TO_DROPOFF event recorded

Coordinator reassigns (same or different deliverer) -> DeliveryItem row is
  upserted (reused, not duplicated — see delivery-coordinator-system.md)

Second failure (failedDeliveryAttempts was already 1):
  OrderItem.cancelledAt set, cancellationReason recorded
  DeliveryItem.status -> RETURNED
  refundOrderItem() called (services/marketplace/escrow/escrow.service.ts) -> item-level refund
  ITEM_CANCELLED event recorded
  Order.deliveryOutcome recomputed (likely PARTIALLY_DELIVERED or
    CANCELLED depending on sibling items)
```

## Actors

Deliverer (reports attempts), System/Cron (retry sweep).

## Database

`OrderItem.{deliveryStatus, deliveryAttempted, failedDeliveryAttempts, retryDeliveryAt, deliveryConfirmedAt}`, `DeliveryItem.status`.

## API

`POST /api/marketplace/deliverer/deliveries/[deliveryItemId]/{out-for-delivery,deliver,fail-attempt}`.

## Cron jobs

`delivery-retry` — see [`cron-system.md`](cron-system.md) for why this one doesn't follow the spec'd 5-hour/24-hour cadence of the other four crons (it's recommended to run more frequently, e.g. hourly, since it's gating a customer-facing SLA more directly than a batch job).

## Notifications

Failed-attempt emails to both seller and buyer (`sellerDeliveryFailedEmail`, `buyerDeliveryFailedEmail`).

## Edge cases

- A `DeliveryItem` row is reused (upserted) across retries rather than recreated, since `DeliveryItem.orderItemId` is `@unique` — see [`delivery-coordinator-system.md`](delivery-coordinator-system.md).
- The buyer OTP (`OrderItem.deliveryOtp`) is only ever surfaced to the buyer (via the order-tracking page) while `deliveryStatus = OUT_FOR_DELIVERY` — see [`../security/otp-security.md`](../security/otp-security.md).

## Dependencies

Depends on: [`deliverer-system.md`](deliverer-system.md).
Depended on by: [`escrow-system.md`](escrow-system.md) (delivery/cancellation outcome drives refund vs. payout eligibility).

## Relevant files

`src/app/api/marketplace/deliverer/deliveries/[deliveryItemId]/{out-for-delivery,deliver,fail-attempt}/route.ts`, `src/app/api/cron/delivery-retry/route.ts`, `src/lib/otp.ts`, `services/marketplace/order/order-events.service.ts`.
