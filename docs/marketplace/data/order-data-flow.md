# Data: Order Data Flow

## The full flow, as implemented

```text
CartItem (per user, live product price)
  ↓  POST /checkout/initialize
Order (one per business, status=PENDING_SELLER, paymentStatus=pending,
       estimatedDeliveryAt/deliveryWindow set)
  + OrderItem (price = historical snapshot)
  ↓  Paystack payment + verify/webhook (idempotent)
Order.paymentStatus=paid; ORDER_CREATED + SELLER_NOTIFIED events; seller emailed
  ↓  Seller responds (within 24h, else auto-rejected by cron)
Order.status = ACCEPTED (fulfillmentStatus: PROCESSING) | REJECTED
  ↓  (if accepted) seller prepares, marks ready
Order.fulfillmentStatus = READY_FOR_PICKUP; buyer emailed estimate+window
  ↓  seller drops off at central drop-off (15h deadline enforced)
Order.sellerDroppedOffAt set (late fine + restriction if missed)
  ↓  delivery coordinator (admin) assigns to a deliverer
DeliveryItem created/upserted, OrderItem.deliveryStatus = ASSIGNED
  ↓  seller<->deliverer OTP handoff verified
OrderItem.deliveryStatus = PICKED_UP; Order.fulfillmentStatus = HANDED_TO_DELIVERER
  ↓  deliverer starts delivery
OrderItem.deliveryStatus = OUT_FOR_DELIVERY; buyer OTP issued + emailed
  ↓  buyer OTP verified by deliverer
OrderItem.deliveryStatus = DELIVERED; deliveryAttempted = TRUE
  ↓  escrow
OrderItem.escrowStatus: HELD -> PAYOUT_PENDING
  ↓  seller-payout cron (every 5h)
OrderItem.payoutStatus: PAYOUT_PENDING -> PAYOUT_PROCESSING -> PAYOUT_SUCCESS
```

Rejection/failure branches (at any point above): seller reject (whole order or one item), auto-reject (24h timeout), failed delivery attempt (24h retry, second failure cancels the item) — every one of these routes the affected item's money through `services/marketplace/escrow/escrow.service.ts#refundOrderItem`: `HELD -> REFUND_PENDING -> REFUNDED`, without touching any other item, even a sibling item in the same order.

## How individual items are tracked

Confirmed and now fully real, not just aspirational: different `OrderItem`s within the same `Order` genuinely can have different delivery outcomes (`deliveryStatus`, `deliveryAttempted`, `failedDeliveryAttempts`), different escrow/payout states, and — via item-level rejection — different seller decisions, even though they share one `price`(snapshot)/`quantity` each and one parent `Order`/business. `Order.deliveryOutcome` is a recomputed rollup of exactly this per-item state (`PARTIALLY_DELIVERED` when items diverge) — see [`order-states.md`](order-states.md).

Different *businesses* from the same checkout are still represented as separate sibling `Order` rows (one per business, sharing a `paystackReference`) rather than as items with different `businessId`s inside one `Order` — see [`../decisions/one-order-per-business-shared-reference.md`](../decisions/one-order-per-business-shared-reference.md), unchanged by this pass.

## Escrow, concretely

`OrderItem.escrowStatus` (money's overall state) and `OrderItem.payoutStatus` (the specific bank-transfer attempt) are both item-scoped — see [`../systems/escrow-system.md`](../systems/escrow-system.md) for the full state machine and why two separate fields exist.
