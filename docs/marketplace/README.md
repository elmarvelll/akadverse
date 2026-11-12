# Marketplace — Documentation

> **Status check first:** this documentation describes the Marketplace **as it actually exists in the codebase today** (last verified 2026-08-28). AkadVerse is a student-platform monorepo; the Marketplace is one feature area inside it (`src/app/studashboard/marketplace/`, `src/app/api/marketplace/`). As of this update, it implements the **full order lifecycle**: business/product listing, cart, Paystack checkout, seller accept/reject, seller processing and central drop-off, delivery-coordinator assignment, deliverer pickup/delivery (with OTP handoffs), delivery retry/cancellation, item-level escrow, seller payouts via Paystack Transfers, late-delivery fines, deliverer application/admin approval, and five scheduled cron jobs.
>
> Every claim below is checked against the actual schema/routes/components. Where the codebase is silent, this doc says **Undocumented / requires clarification** instead of guessing. See [`todo/`](todo/) for what's still genuinely missing (mostly hardening, not core functionality).

## What the Marketplace is

The Marketplace lets a student (any `User`, regardless of `role`) create a **Business**, list **Products** on it, and lets other students browse, cart, and buy them through Paystack — and then tracks that purchase through seller acceptance, fulfillment, central drop-off, deliverer pickup and delivery (with OTP-verified handoffs both ways), and finally escrow release into a seller payout. There is a separate, **UI-only "Skills" marketplace** (services people offer, e.g. tutoring) that is not backed by the database at all — it renders static mock data (see [`systems/skills-marketplace-mock.md`](systems/skills-marketplace-mock.md)).

## What the Marketplace is responsible for

- Business onboarding, including delivery-day selection (days of the week, up to 4).
- Product listing and management, with basic attribute-only variants.
- Browsing/searching/filtering products; per-product estimated delivery date/window.
- A shopping cart, scoped per signed-in user.
- Checkout and Paystack payment confirmation (webhook + client-side verify fallback).
- Seller accept/reject (with a 24-hour deadline enforced by cron), whole-order or per-item.
- Seller fulfillment (processing → ready → central drop-off), with a 15-hour drop-off deadline and late-delivery fines (paid via Paystack) for missing it.
- Delivery-coordinator assignment of dropped-off items to approved deliverers (admin-gated).
- Deliverer pickup (seller↔deliverer OTP), out-for-delivery, and delivery confirmation (buyer OTP), with a failed-attempt → 24h retry → second-failure-cancellation flow.
- Item-level escrow: refund path for rejected/cancelled items, payout path for delivered items.
- Seller payouts via Paystack Transfers, on a 5-hourly cron, idempotent and retryable.
- Deliverer application + admin approval/rejection/suspension.
- Order history (append-only event log) and per-item, per-order tracking for buyers, sellers, and deliverers.
- Transactional email for nearly every transition above (Resend).
- Five scheduled crons (Vercel Cron): seller-response, seller-payout, deliverer-inventory, delivery-schedule, delivery-retry.

## What's still genuinely missing

See [`todo/`](todo/) for the honest remainder — mainly: real Paystack refund calls (refunds reach `REFUNDED` state without an actual reversal transfer yet), Paystack transfer-webhook resolution for non-instant payouts, business-configurable delivery windows (currently one fixed window for everyone), harder enforcement of delivery restriction beyond the dashboard warning, and general hardening (rate limiting, stock reservation at checkout — pre-existing gap, unrelated to this pass).

## Who uses it

- **Buyer** — browses, purchases, tracks orders, confirms delivery via OTP.
- **Seller / Business owner** — lists products, accepts/rejects/processes orders, drops off at the central point, pays late fines, receives payouts.
- **Deliverer** — an approved applicant; picks up (OTP), delivers (OTP), reports failed attempts.
- **Admin** (`super_admin` role) — approves/rejects/suspends deliverer applications; acts as the delivery coordinator assigning deliveries; and, via the full Admin Dashboard, promotes users, verifies/blocks businesses, resolves disputed orders, and reviews fines/reports. No separate "delivery coordinator" account type exists — see [`decisions/delivery-coordinator-is-admin.md`](decisions/delivery-coordinator-is-admin.md). Full admin documentation: **[`docs/admin/`](../admin/README.md)**.
- **System (Paystack, Cron)** — Paystack calls back via webhook for both order payments and late-fine payments; Vercel Cron calls the five `/api/cron/*` routes on schedule.

## Major Marketplace systems

| System | Doc |
|---|---|
| Business (incl. delivery days) | [`systems/business-system.md`](systems/business-system.md) |
| Product (incl. estimated delivery) | [`systems/product-system.md`](systems/product-system.md) |
| Cart | [`systems/cart-system.md`](systems/cart-system.md) |
| Checkout & payment | [`systems/checkout-and-payment-system.md`](systems/checkout-and-payment-system.md) |
| Order (full lifecycle overview) | [`systems/order-system.md`](systems/order-system.md) |
| Seller response (accept/reject/24h deadline) | [`systems/seller-response-system.md`](systems/seller-response-system.md) |
| Seller order dashboard | [`systems/seller-order-system.md`](systems/seller-order-system.md) |
| Seller processing & fulfillment | [`systems/seller-processing-system.md`](systems/seller-processing-system.md) |
| Central drop-off | [`systems/central-dropoff-system.md`](systems/central-dropoff-system.md) |
| Delivery coordinator | [`systems/delivery-coordinator-system.md`](systems/delivery-coordinator-system.md) |
| Deliverer (application, approval, pickup, delivery) | [`systems/deliverer-system.md`](systems/deliverer-system.md) |
| Delivery (attempts, retry, cancellation) | [`systems/delivery-system.md`](systems/delivery-system.md) |
| Escrow | [`systems/escrow-system.md`](systems/escrow-system.md) |
| Seller payout | [`systems/seller-payout-system.md`](systems/seller-payout-system.md) |
| Late-delivery fine | [`systems/late-delivery-fine-system.md`](systems/late-delivery-fine-system.md) |
| Order history (events) | [`systems/order-history-system.md`](systems/order-history-system.md) |
| Email | [`systems/email-system.md`](systems/email-system.md) |
| Cron | [`systems/cron-system.md`](systems/cron-system.md) |
| Admin | [`systems/admin-system.md`](systems/admin-system.md) |
| Skills marketplace (mock UI) | [`systems/skills-marketplace-mock.md`](systems/skills-marketplace-mock.md) |

## How this documentation is organized

- [`architecture.md`](architecture.md) — component diagram and how pieces communicate, including the full buyer → seller → drop-off → coordinator → deliverer → buyer → escrow → payout flow.
- [`systems/`](systems/) — one file per system: purpose, actors, data, API routes, services, components, security, edge cases.
- [`data/`](data/) — Prisma schema, order data flow, price snapshots, delivery days/windows/estimated-delivery, and the full state-machine reference.
- [`security/`](security/) — authentication/authorization, payment security, OTP security, and a living list of gaps.
- [`decisions/`](decisions/) — recorded architectural/business decisions, including where a later decision superseded an earlier one (never silently overwritten).
- [`todo/`](todo/) — phased roadmap; reflects real implementation status.
- [`log/`](log/) — chronological development log by month.
- [`log/postmortems/`](log/postmortems/) — write-ups of significant incidents. Empty until one occurs.

## Where to start

1. Read this README, then [`architecture.md`](architecture.md).
2. Read [`systems/order-system.md`](systems/order-system.md) — the full-lifecycle map that links to every other system in the right order.
3. Read [`data/schema.md`](data/schema.md) alongside `prisma/schema.prisma`, and [`data/order-states.md`](data/order-states.md) for the four separate state machines.
4. Check [`todo/`](todo/) before starting new work.
