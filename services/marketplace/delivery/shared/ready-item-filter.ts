// services/marketplace/delivery/shared/ready-item-filter.ts
//
// The "eligible for delivery-coordinator assignment" filter, shared by
// list-ready-items.ts and assign-delivery.ts so they can never drift apart
// on what counts as ready.
//
// deliveryStatus: null covers both a never-yet-assigned item and one
// that's been returned to the pool by the delivery-retry cron after a
// first failed attempt — neither has an active DeliveryItem, so
// fulfillmentStatus isn't part of the gate here: a retried item's Order is
// still HANDED_TO_DELIVERER from its first (failed) run, but the item
// itself is exactly as eligible for reassignment as a fresh one.
export const READY_ITEM_WHERE = {
  deliveryStatus: null,
  rejectedAt: null,
  cancelledAt: null,
  order: { sellerDroppedOffAt: { not: null } },
} as const;
