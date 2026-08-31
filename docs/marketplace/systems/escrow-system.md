# System: Escrow

## Purpose

Holds a buyer's payment per order item until that item's outcome (delivered vs. rejected/cancelled) is known, then routes the money correctly — to the seller (payout) or back toward the buyer (refund) — without ever letting one item's outcome affect an unrelated item's money, even within the same order.

## Why item-level, not order-level

The product requirement is explicit: rejecting Business B's item in a multi-business checkout must not touch Business A's or C's items. Because checkout already splits into one `Order` per business (see [`checkout-and-payment-system.md`](checkout-and-payment-system.md)), that requirement is satisfied for *cross-business* isolation automatically. But a single business's own order can still contain multiple items with different individual outcomes (one out of stock, one delivered, one failed twice) — so escrow state (`EscrowPaymentStatus`, `PayoutStatus`) lives on `OrderItem`, not `Order`. See [`../data/order-data-flow.md`](../data/order-data-flow.md).

## Escrow states (`OrderItem.escrowStatus`)

```text
HELD            — the resting state right after payment is confirmed
REFUND_PENDING  — refundOrderItem() has started the refund
REFUNDED        — refund complete
PAYOUT_PENDING  — item delivered, eligible for seller payout
PAYOUT_PROCESSING — the payout cron has started the Paystack transfer
PAID_OUT        — Paystack confirmed the transfer succeeded
```

## Refund path (`services/marketplace/escrow/escrow.service.ts#refundOrderItem`)

Triggered by: explicit whole-order rejection, explicit item-level rejection, seller auto-reject (24h timeout), or cancellation after a second failed delivery attempt.

```text
HELD -> REFUND_PENDING (REFUND_INITIATED event) -> REFUNDED (REFUND_COMPLETED event)
```

Idempotent: an item already `REFUNDED`/`REFUND_PENDING` is a no-op on a second call — this matters because more than one code path can legitimately try to refund the same item (e.g. the whole-order reject route calls it per item, but so could a future dispute flow).

**Honest limitation**: there is no real Paystack refund API call yet — `refundOrderItem` moves straight from `REFUND_PENDING` to `REFUNDED` without an external call, since building the actual Paystack refund integration is out of scope for this pass (see [`../todo/phase-05-escrow-and-payments.md`](../todo/phase-05-escrow-and-payments.md)). The state machine is real and reachable; the money movement behind `REFUNDED` is not yet backed by an actual transfer back to the buyer's payment method.

## Payout path

See [`seller-payout-system.md`](seller-payout-system.md).

## Historical price snapshot

Every payout/refund calculation uses `OrderItem.price` (the checkout-time snapshot), never `Product.price` — see [`../data/price-snapshots.md`](../data/price-snapshots.md). `services/marketplace/escrow/escrow.service.ts#calculateItemPayout` takes `price`/`quantity` as arguments specifically so a caller can never accidentally substitute the live product price.

## Service fee

`services/marketplace/checkout/checkout.service.ts#SERVICE_FEE_RATE` (currently `0`, a percentage of gross) is the single source both the checkout-time buyer-facing fee and the payout-time seller deduction read from — see [`../decisions/flat-zero-service-fee.md`](../decisions/flat-zero-service-fee.md).

## Database

`OrderItem.{escrowStatus, refundedAt, refundReference, payoutStatus, payoutAttempts, payoutProcessingAt, payoutSucceededAt, payoutFailedAt, payoutFailureReason, payoutReference}`.

## Dependencies

Depends on: [`seller-response-system.md`](seller-response-system.md), [`delivery-system.md`](delivery-system.md).
Depended on by: [`seller-payout-system.md`](seller-payout-system.md).

## Relevant files

`services/marketplace/escrow/escrow.service.ts`.
