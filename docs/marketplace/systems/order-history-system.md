# System: Order History (Order Events)

## Purpose

An append-only log of everything that happens to an order or one of its items, so "who did this, and when" is always answerable — needed for dispute resolution and for verifying whether a seller or deliverer was actually late.

## Model

`OrderEvent`: `orderId`, optional `orderItemId` (item-scoped events, e.g. per-item delivery attempts, are scoped; order-wide events like `SELLER_ACCEPTED` are not), `type` (`OrderEventType` enum — see the full list in `prisma/schema.prisma`), `actorType` (`"buyer" | "seller" | "deliverer" | "admin" | "system"`), `actorId`, `message`, `metadata` (JSON, e.g. `{ success: boolean }` on an OTP-attempt event), `createdAt`.

## Recording convention

Every route that changes order/item state calls `services/marketplace/order/order-events.service.ts#recordOrderEvent` as part of the **same** `$transaction` as the state change itself — never as a best-effort side call after the fact. This is enforced by convention (code review), not by the database.

## Which event types are actually wired up today

All of the following are recorded by real code paths: `ORDER_CREATED`, `SELLER_NOTIFIED`, `SELLER_ACCEPTED`, `SELLER_REJECTED`, `SELLER_AUTO_REJECTED`, `SELLER_PROCESSING`, `SELLER_MARKED_READY`, `SELLER_DROPPED_OFF`, `SELLER_MISSED_DROPOFF_DEADLINE`, `DELIVERER_ASSIGNED`, `DELIVERER_PICKUP_OTP_VERIFIED`, `DELIVERER_CONFIRMED_PICKUP`, `HANDED_TO_DELIVERER`, `OUT_FOR_DELIVERY`, `BUYER_DELIVERY_OTP_ISSUED`, `BUYER_OTP_VERIFICATION_ATTEMPTED`, `BUYER_OTP_VERIFIED`, `DELIVERY_ATTEMPTED`, `DELIVERY_FAILED`, `DELIVERY_RETRY_SCHEDULED`, `RETURNED_TO_DROPOFF`, `DELIVERED`, `ITEM_CANCELLED`, `REFUND_INITIATED`, `REFUND_COMPLETED`, `PAYOUT_PENDING`, `PAYOUT_PROCESSING`, `PAYOUT_SUCCESS`, `PAYOUT_FAILED`, `LATE_DELIVERY_FINE_ISSUED`, `LATE_DELIVERY_FINE_PAID`, `BUSINESS_DELIVERY_RESTRICTED`, `BUSINESS_DELIVERY_UNRESTRICTED`.

**Reserved but not yet emitted**: `DELIVERER_PICKUP_OTP_ISSUED` (the OTP is created at assignment time but no explicit event is logged for its issuance — only its verification), `PARTIALLY_DELIVERED` as a discrete event (the *state* `Order.deliveryOutcome = PARTIALLY_DELIVERED` is real and computed — see below — but no `OrderEvent` row is written specifically when that transition happens; it's implied by the individual item events around it).

## Order-level rollup: `deliveryOutcome`

`services/marketplace/order/order-events.service.ts#recomputeOrderDeliveryOutcome` recalculates `Order.deliveryOutcome` (`PENDING`/`DELIVERED`/`PARTIALLY_DELIVERED`/`FAILED`/`CANCELLED`) from the current state of all of an order's items, every time an item's delivery status or cancellation changes. This is the answer to "did this whole order ship" without needing to join every item every time — but the *items themselves* remain authoritative; this is a cached rollup, not a separate source of truth.

## Key timestamps

Tracked directly on `Order` (not derived from events, though events are recorded alongside each): `sellerMarkedReadyAt`, `pickupScheduledAt` (reserved, not yet written — see [`seller-processing-system.md`](seller-processing-system.md)), `sellerDroppedOffAt`, `delivererConfirmedPickupAt`. Per-item: `OrderItem.deliveryConfirmedAt`.

## Database

`OrderEvent`.

## Dependencies

Every other Marketplace system that changes order/item state writes into this one.

## Relevant files

`services/marketplace/order/order-events.service.ts`, `prisma/schema.prisma` (`OrderEvent`, `OrderEventType`).
