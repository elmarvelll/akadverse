# System: Cron

## Purpose

Scheduled, unattended enforcement of every time-based Marketplace rule: seller response deadlines, seller payouts, deliverer daily digests, and delivery retries.

## Mechanism

Every cron is a plain authenticated `GET` API route under `/api/cron/*`, scheduled by Vercel Cron via `vercel.json`'s `crons` array. Vercel Cron calls the route with `Authorization: Bearer $CRON_SECRET`; every route checks that header via `src/lib/cron-auth.ts#requireCronSecret` before doing anything, and 500s if `CRON_SECRET` itself isn't configured (fails loudly rather than silently skipping auth). `/api/cron/*` is listed in `src/proxy.ts`'s `PUBLIC_API_PREFIXES` so the request reaches the route handler at all (Vercel Cron has no session cookie to send).

This was a deliberate choice over `node-cron` (which needs a long-lived Node process — incompatible with a serverless/edge deploy target) — see [`../decisions/cron-mechanism.md`](../decisions/cron-mechanism.md).

## The five crons

| Cron | Schedule | Purpose | Route |
|---|---|---|---|
| Seller response | Every 5 hours | Auto-reject `PENDING_SELLER` orders older than 24h | `/api/cron/seller-response` |
| Seller payout | Every 5 hours | Process `PAYOUT_PENDING` items; retry `PAYOUT_FAILED` (up to 5 attempts) | `/api/cron/seller-payout` |
| Deliverer inventory | 12:00 AM | Report ready/picked-up `DeliveryItem` counts per business | `/api/cron/deliverer-inventory` |
| Delivery schedule | 12:00 AM | Email each approved deliverer their day's confirmed deliveries | `/api/cron/delivery-schedule` |
| Delivery retry | Not spec'd — recommended hourly | Return failed-then-24h-elapsed items to the drop-off pool | `/api/cron/delivery-retry` |

## Per-cron detail

### Seller response

Query: `Order` where `status = PENDING_SELLER` and `createdAt <= now - 24h`. For each: sets `status = REJECTED`, `autoRejected = true`, mirrors the rejection onto every `OrderItem`, records `SELLER_AUTO_REJECTED`, refunds each item (`services/marketplace/escrow/escrow.service.ts#refundOrderItem`), emails the buyer. The deadline is anchored to `Order.createdAt`, not to "24 hours since this cron last ran" — see [`seller-response-system.md`](seller-response-system.md).

### Seller payout

Query: `OrderItem` where `escrowStatus = PAYOUT_PENDING` and `payoutStatus = PAYOUT_PENDING`, plus a retry pass for `PAYOUT_FAILED` items with `payoutAttempts < 5` (reset to `PAYOUT_PENDING` first, then processed the same way). Delegates the actual work to `services/marketplace/payout/seller-payout.service.ts#processItemPayout` per item — see [`seller-payout-system.md`](seller-payout-system.md).

### Deliverer inventory

Currently read-only: groups `DeliveryItem` by `businessId`/`status` for `ASSIGNED`/`PICKED_UP` rows and returns counts. There is no separate "inventory" table to mutate — a deliverer's live ready-to-ship set is always just the current `DeliveryItem` rows, already visible via `GET /api/marketplace/deliverer/deliveries`. See the route's own comment for why this is intentionally a no-mutation diagnostic today rather than a digest email (that's the delivery-schedule cron's job).

### Delivery schedule

Query: `Deliverer` where `status = APPROVED`, with `Delivery` rows whose `expectedDeliveryAt` falls within today's calendar day. Emails each deliverer with deliveries their day's confirmed items + estimated times/windows (`delivererDailyScheduleEmail`).

### Delivery retry

Query: `OrderItem` where `deliveryStatus = FAILED`, `deliveryAttempted = FALSE`, `failedDeliveryAttempts = 1`, `cancelledAt = null`, `retryDeliveryAt <= now`. Resets `deliveryStatus` to `null` (re-enters the drop-off/assignment pool) and records `RETURNED_TO_DROPOFF`. See [`delivery-system.md`](delivery-system.md).

## Failure behavior

None of the five crons catch-and-continue at the top level except seller-payout (which is item-by-item resilient by construction — one item's exception is caught inside `processItemPayout` itself and turned into a `PAYOUT_FAILED` state rather than aborting the batch). A thrown exception in the others surfaces as a 500 to Vercel Cron, which Vercel's own retry/alerting handles — no custom dead-letter queue exists.

## Idempotency

Seller-response and seller-payout are both idempotent by construction (only ever act on rows still in a specific pre-terminal state — see each system's own doc). Deliverer-inventory is read-only. Delivery-schedule sends an email per qualifying deliverer per run; running it twice in the same day would send a duplicate digest — not currently guarded against, since it's expected to run exactly once at midnight.

## Relevant files

`src/lib/cron-auth.ts`, `src/app/api/cron/**`, `vercel.json`.
