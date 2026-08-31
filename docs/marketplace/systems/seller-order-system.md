# System: Seller Order (dashboard)

## Purpose

The seller's single view of every order touching their business, organized into the five sections a seller actually needs to act from: **Pending**, **Accepted / Processing**, **Ready for Pickup**, **Completed**, **Rejected**.

## Responsibilities

- Classify each order into exactly one section (`services/marketplace/order/seller-order-sections.service.ts#classifySellerOrder`).
- Surface the estimated delivery date/window and the 15-hour drop-off deadline per order.
- Warn when a business is delivery-restricted (unpaid late-delivery fine) and let the seller pay it.
- Host the accept/reject/mark-ready/confirm-drop-off actions (implemented in [`seller-response-system.md`](seller-response-system.md), [`seller-processing-system.md`](seller-processing-system.md), and [`central-dropoff-system.md`](central-dropoff-system.md) — this system is the dashboard surface, not where the transition logic itself lives).

## Actors

Seller (business owner).

## Data

`BusinessOrderSummary` (`src/types/order.ts`) — status, fulfillment status, section, estimated delivery, drop-off deadline, per-item summaries.

## Section classification

```text
REJECTED / CANCELLED status          -> "rejected"
PENDING_SELLER status                -> "pending"
ACCEPTED + fulfillmentStatus PROCESSING (or unset) -> "accepted_processing"
ACCEPTED + fulfillmentStatus READY_FOR_PICKUP       -> "ready_for_pickup"
ACCEPTED + fulfillmentStatus HANDED_TO_DELIVERER    -> "completed"
```

"Completed" means the seller's part is done (handed to a deliverer) — it does not mean the buyer has received it; that's tracked separately as `Order.deliveryOutcome` (see [`order-history-system.md`](order-history-system.md)) and shown on the buyer's own order-tracking page, not this dashboard.

## API

`GET /api/marketplace/businesses/[id]/orders` — returns every order with its `section`, plus drop-off-deadline fields computed via `services/marketplace/delivery/dropoff-deadline.service.ts`.

`GET /api/marketplace/businesses/[id]/fines` — outstanding late-delivery fines + the business's current restriction flag, shown as a banner above the section tabs.

## Components

`business/[id]/orders/page.tsx` — the whole dashboard: section tabs, per-order cards, action buttons, fine-payment banner.

## Authentication / Authorization

Owner-scoped via `requireOwnedBusiness`, same as every other business-dashboard route.

## Edge cases

- An order with a mix of accepted and individually-rejected items still shows as `accepted_processing`/`ready_for_pickup`/`completed` at the section level — the rejected item's own row shows "Rejected" in the item list within the card.

## Dependencies

Depends on: [`seller-response-system.md`](seller-response-system.md), [`seller-processing-system.md`](seller-processing-system.md), [`central-dropoff-system.md`](central-dropoff-system.md), [`late-delivery-fine-system.md`](late-delivery-fine-system.md).

## Relevant files

`services/marketplace/order/seller-order-sections.service.ts`, `src/types/order.ts`, `src/app/api/marketplace/businesses/[id]/orders/route.ts`, `src/app/studashboard/marketplace/business/[id]/orders/page.tsx`.
