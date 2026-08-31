# System: Order Events & Fines — Admin Read Layer

## Purpose

Gives a `super_admin` a cross-order, cross-business view of two pre-existing Marketplace systems — order history and late-delivery fines — that previously had no oversight surface at all (only per-business, owner-scoped views existed).

## This is a read layer, not a new data system

Both `OrderEvent` and `LateDeliveryFine` already existed and were already being written to by the order/delivery/fine pipeline (see [`docs/marketplace/systems/order-history-system.md`](../../marketplace/systems/order-history-system.md) and [`late-delivery-fine-system.md`](../../marketplace/systems/late-delivery-fine-system.md)). Nothing here creates or changes that data — the Events tab is strictly read-only; the Fines tab is also read-only (fine payment itself is still only ever confirmed by the existing Paystack verify/webhook flow, never by anything in this admin surface — see [`docs/marketplace/security/payment-security.md`](../../marketplace/security/payment-security.md)).

## Responsibilities

- **Events**: list every `OrderEvent`, most recent first, across every order — with the order's business name and the business owner's ("seller's") name resolved and shown directly, not just IDs, per the explicit requirement. Optionally filterable to one order.
- **Fines**: list every `LateDeliveryFine`, with the business, its owner, the amount, and the real (server-verified) payment status/reference/paid-at.

## Actors

`super_admin` only.

## Data

`OrderEvent` (read-only here), `LateDeliveryFine` (read-only here).

## Inputs

Pagination; Events also accepts an optional `orderId` filter.

## Outputs

`AdminEventRow[]`, `AdminFineRow[]`.

## Database

`OrderEvent` joined through `Order → Business → User` (for business/seller name) and `Order → User` (for buyer email). `LateDeliveryFine` joined to `Business → User` (for owner email).

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/admin/events` | GET | Cross-order event feed |
| `/api/marketplace/admin/fines` | GET | Every fine |

## Services

`services/marketplace/admin/list-order-events.ts`, `list-fines.ts`.

## Components

`src/app/studashboard/admin/marketplace/events/page.tsx` (table), `fines/page.tsx` (cards, with payment status/reference shown per fine).

## Authentication / Authorization

`requireAdmin()` on both routes.

## Historical, not current-state-only

The Events tab is the direct, unfiltered `OrderEvent` table — every event ever recorded stays visible regardless of the order's current status, which is what makes it possible to answer "what did this order go through" rather than only "where is it now." This is inherent to how `OrderEvent` already worked (append-only, never updated or deleted) — the admin tab adds no new guarantee here, it just exposes the existing one platform-wide instead of per-business.

## Error handling

Empty results render as an explicit "No events found." / "No fines found." state, not a blank screen.

## Edge cases

- **"Who paid" for a fine**: the schema has no separate "payer" concept distinct from the business owner — a fine's payment is always initiated from that business's own dashboard by its owner (see [`docs/marketplace/systems/late-delivery-fine-system.md`](../../marketplace/systems/late-delivery-fine-system.md)). The Fines tab shows the owner's email for this reason, rather than inventing a separate "paid by" field the schema doesn't have.
- **Event feed volume**: `OrderEvent` rows accumulate quickly (every state transition writes one) — this is exactly why pagination (see [`../architecture.md`](../architecture.md)) was introduced in this pass rather than loading everything.

## Notifications

None.

## Cron jobs

None — this reads data written by other systems' existing crons (seller-response, seller-payout), it doesn't run its own.

## Dependencies

`docs/marketplace/systems/order-history-system.md`, `late-delivery-fine-system.md`.

## Usage

`studashboard/admin/marketplace/events`, `studashboard/admin/marketplace/fines`.

## Relevant files

- `services/marketplace/admin/{list-order-events,list-fines}.ts`
- `src/app/api/marketplace/admin/{events,fines}/**`
- `src/app/studashboard/admin/marketplace/{events,fines}/page.tsx`
