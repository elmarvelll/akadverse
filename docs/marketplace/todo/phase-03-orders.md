# Phase 3 — Orders (cart, checkout, payment, seller response, fulfillment)

## Status: ✅ Done, one pre-existing gap remains

- [x] Cart, checkout, payment (unchanged from before this phase's completion — see [`../systems/cart-system.md`](../systems/cart-system.md), [`../systems/checkout-and-payment-system.md`](../systems/checkout-and-payment-system.md))
- [x] Seller response system: `PENDING_SELLER` → `ACCEPTED`/`REJECTED`, with rejection reason. See [`../systems/seller-response-system.md`](../systems/seller-response-system.md) and [`../decisions/pending-seller-terminology-changed.md`](../decisions/pending-seller-terminology-changed.md) for the naming resolution.
- [x] 24-hour seller-response deadline + 5-hour enforcement cron, deadline anchored to `Order.createdAt`.
- [x] Fulfillment states (`PROCESSING`/`READY_FOR_PICKUP`/`HANDED_TO_DELIVERER`), `sellerMarkedReadyAt` tracking, buyer notification on "ready."
- [x] Buyer-facing "my orders" view — `studashboard/marketplace/orders/page.tsx`, item-level status.
- [x] Order events/history log — `OrderEvent` model, `services/marketplace/order/order-events.service.ts`. See [`../systems/order-history-system.md`](../systems/order-history-system.md).
- [x] Partial delivery representation (`Order.deliveryOutcome = PARTIALLY_DELIVERED`), computed from item-level state.
- [x] `OrderItem` gained a real status surface (`deliveryStatus`, escrow/payout fields, rejection fields) — no longer statusless.
- [ ] **Stock reservation at checkout** — still not implemented; pre-existing gap, unrelated to this phase's scope. See [`../security/gaps.md`](../security/gaps.md).

## Dependencies

Phase 1, Phase 2. Unblocks Phase 4/5 (both now built on top of this).

## Relevant systems

[`../systems/checkout-and-payment-system.md`](../systems/checkout-and-payment-system.md), [`../systems/order-system.md`](../systems/order-system.md), [`../systems/seller-response-system.md`](../systems/seller-response-system.md), [`../systems/seller-processing-system.md`](../systems/seller-processing-system.md), [`../systems/seller-order-system.md`](../systems/seller-order-system.md)
