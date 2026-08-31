# Data: Order, Fulfillment, Delivery, and Payment States

Four separate, deliberately-not-collapsed state machines — see [`../decisions/separate-status-fields.md`](../decisions/separate-status-fields.md).

## Order status (`Order.status`, enum `OrderStatus`)

```text
PENDING_SELLER  — initial state, literal value (not a display label)
ACCEPTED
REJECTED
CANCELLED       — reserved for a whole-order cancellation path; no route
                  sets this today (item-level cancellation, via
                  OrderItem.cancelledAt, is what the second-failed-delivery
                  flow actually uses — see delivery-system.md)
```

## Fulfillment status (`Order.fulfillmentStatus`, enum `FulfillmentStatus`, nullable)

```text
PROCESSING           — set the moment the seller accepts
READY_FOR_PICKUP      — seller marks ready
HANDED_TO_DELIVERER   — seller<->deliverer OTP handoff confirmed
```

Null until the order is accepted.

## Delivery status (`OrderItem.deliveryStatus`, enum `DeliveryStatus`, nullable)

```text
ASSIGNED            — coordinator assigned it to a deliverer
PICKED_UP           — seller<->deliverer OTP verified
OUT_FOR_DELIVERY     — deliverer started delivery, buyer OTP issued
DELIVERY_ATTEMPTED   — reserved; the actual attempt outcome is recorded via
                        deliveryAttempted (TRUE/FALSE) rather than this
                        status value being set to DELIVERY_ATTEMPTED itself
                        — see the note below.
DELIVERED
FAILED               — after a failed attempt (first or second)
RETURNED             — set on DeliveryItem (not OrderItem) after a second
                        failed attempt cancels the item
```

**Implementation note**: the enum literally includes `DELIVERY_ATTEMPTED` as a `DeliveryStatus` value (per the schema's spec-derived design), but the actual failed/succeeded outcome of an attempt is tracked via the separate `OrderItem.deliveryAttempted` tri-state field (`PENDING`/`TRUE`/`FALSE`), not by setting `deliveryStatus` to the literal `DELIVERY_ATTEMPTED` value — no code path currently sets `deliveryStatus = DELIVERY_ATTEMPTED`. This is worth flagging as a minor redundancy in the enum rather than a bug: `deliveryAttempted` is the field that's actually consulted for attempt-outcome logic.

## Delivery attempt tri-state (`OrderItem.deliveryAttempted`, enum `DeliveryAttempted`)

```text
PENDING  — no attempt made yet
TRUE     — last attempt succeeded
FALSE    — last attempt failed
```

## Order-level delivery rollup (`Order.deliveryOutcome`, enum `OrderDeliveryOutcome`)

```text
PENDING             — default; still in progress
DELIVERED           — every item delivered
PARTIALLY_DELIVERED — some delivered, some not (failed/cancelled)
FAILED              — none delivered, at least one failed
CANCELLED           — every item cancelled
```

Recomputed by `services/marketplace/order/order-events.service.ts#recomputeOrderDeliveryOutcome` — see [`order-data-flow.md`](order-data-flow.md).

## Escrow / payment status (`OrderItem.escrowStatus`, enum `EscrowPaymentStatus`)

```text
HELD
REFUND_PENDING
REFUNDED
PAYOUT_PENDING
PAYOUT_PROCESSING
PAID_OUT
```

## Seller payout status (`OrderItem.payoutStatus`, enum `PayoutStatus`, nullable — distinct from `escrowStatus`)

```text
PAYOUT_PENDING
PAYOUT_PROCESSING
PAYOUT_SUCCESS
PAYOUT_FAILED
```

Why two separate fields for money: `escrowStatus` is the item's overall money state (has it been handed to the seller path or the refund path at all); `payoutStatus` is the specific bank-transfer attempt, which can independently fail and retry (`payoutAttempts`) without changing what `escrowStatus` says about the item overall (it stays `PAYOUT_PENDING` across retries until the transfer actually succeeds, at which point both flip together).

## Order payment status (`Order.paymentStatus`, plain string, unchanged from the original checkout implementation)

```text
"pending"  — before Paystack confirms
"paid"     — after Paystack confirms
```

Deliberately still a free-text string (not upgraded to an enum in this pass) since it predates this work and represents a different concern entirely — "was payment collected at all," not the post-collection escrow lifecycle above.

## Deliverer application status (`Deliverer.status`, enum `DelivererStatus`)

```text
PENDING
APPROVED
REJECTED   — reapplication resets the same row back to PENDING, see
             deliverer-system.md
SUSPENDED
```

## Late-delivery fine status (`LateDeliveryFine.status`, enum `FineStatus`)

```text
PENDING
PAID
```
