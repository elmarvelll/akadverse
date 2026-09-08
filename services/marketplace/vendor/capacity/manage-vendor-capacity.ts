// services/marketplace/vendor/capacity/manage-vendor-capacity.ts
//
// A vendor's own "Set Product Deliveries Per Time Range" configuration —
// see VendorTimeframeCapacity's schema comment and
// docs/marketplace/decisions/vendor-independent-architecture.md for why
// this is completely independent of VendorDeliverySlot.delivererCapacity
// (admin's deliverer-roster capacity). Owner-scoped via
// requireOwnedBusiness, same pattern as
// services/marketplace/vendor/side/side.service.ts. Called by
// src/app/api/marketplace/vendor/[id]/capacity/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/service-error";
import { requireOwnedVendor } from "@/services/marketplace/vendor/shared/require-owned-vendor";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-checkout/calculate-vendor-checkout-summary";
import type { Db } from "@/services/marketplace/order/shared/db";

export interface VendorCapacityRow {
  slotId: string;
  slotLabel: string;
  windowStart: string;
  windowEnd: string;
  capacity: number;
  bookedToday: number;
}

// Lists every active slot, this vendor's configured capacity for it
// (0 = not configured — the vendor hasn't opted into that timeframe), and
// today's live booked count so the vendor's own dashboard can show
// remaining capacity without a second round trip.
export async function listVendorCapacity(businessId: string): Promise<VendorCapacityRow[]> {
  await requireOwnedVendor(businessId);

  const bookedFor = todayInSchoolTimezone();
  const [slots, capacities] = await Promise.all([
    prisma.vendorDeliverySlot.findMany({ where: { active: true }, orderBy: { windowStart: "asc" } }),
    prisma.vendorTimeframeCapacity.findMany({ where: { businessId } }),
  ]);
  const capacityBySlot = new Map(capacities.map((c) => [c.slotId, c.capacity]));

  // Small, fixed number of active slots (3 by default) — one count query
  // per slot is simpler and safer than resolving Order -> booking -> slot
  // through a groupBy, since Order has no slotId column of its own.
  return Promise.all(
    slots.map(async (slot) => {
      const bookedToday = await countVendorBookingsForSlot(businessId, slot.id, bookedFor);
      return {
        slotId: slot.id,
        slotLabel: slot.label,
        windowStart: slot.windowStart,
        windowEnd: slot.windowEnd,
        capacity: capacityBySlot.get(slot.id) ?? 0,
        bookedToday,
      };
    })
  );
}

// The single place that counts "how many orders has this vendor already
// booked for this slot/date" — both the read-only capacity display above
// and the authoritative booking-transaction check in
// create-vendor-orders-for-checkout.ts call this, so the two can never
// drift apart. Accepts an optional Prisma transaction client so the
// booking transaction can call it with the same connection/isolation
// level it's already running under.
export async function countVendorBookingsForSlot(
  businessId: string,
  slotId: string,
  bookedFor: Date,
  db: Db = prisma
): Promise<number> {
  return db.order.count({
    where: { businessId, vendorDeliveryBooking: { slotId, bookedFor } },
  });
}

export async function upsertVendorCapacity(businessId: string, slotId: string, capacity: number) {
  await requireOwnedVendor(businessId);

  if (!Number.isInteger(capacity) || capacity < 0) {
    throw badRequest("Capacity must be a non-negative integer.");
  }
  const slot = await prisma.vendorDeliverySlot.findUnique({ where: { id: slotId } });
  if (!slot || !slot.active) throw badRequest("Delivery slot not found.");

  return prisma.vendorTimeframeCapacity.upsert({
    where: { businessId_slotId: { businessId, slotId } },
    update: { capacity },
    create: { businessId, slotId, capacity },
  });
}
