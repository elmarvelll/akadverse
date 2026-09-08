// services/marketplace/vendor-checkout/calculate-vendor-checkout-summary.ts
//
// The Vendor checkout page's preview — cart contents, fee breakdown, and
// every active delivery slot with live capacity/bookability. Purely a
// preview: nothing here reserves a slot or commits inventory (see
// docs/marketplace/decisions/vendor-independent-architecture.md — cart/
// checkout is never a reservation). Called by
// src/app/api/marketplace/vendor-checkout/summary/route.controller.ts.
//
// Slot "capacity"/"booked" here reflect each VENDOR represented in the
// cart's own VendorTimeframeCapacity — never
// VendorDeliverySlot.delivererCapacity (that's the admin deliverer-roster
// system, unrelated to whether a customer can book — see the decision doc
// above). A slot is only bookable for this cart if every distinct vendor
// in the cart still has room in it; the numbers shown are the bottleneck
// vendor's remaining capacity, so the UI's "N spot(s) left" always matches
// what create-vendor-orders-for-checkout.ts will actually enforce.

import { prisma } from "@/lib/prisma";
import { getVendorCartForUser } from "@/services/marketplace/vendor-cart/get-vendor-cart-for-user";
import { getMarketplaceSettings } from "@/services/marketplace/admin/shared/marketplace-settings";
import { isSlotBookable, nowInSchoolTimezone } from "@/services/marketplace/vendor-delivery/is-slot-bookable";
import { countVendorBookingsForSlot } from "@/services/marketplace/vendor/capacity/manage-vendor-capacity";
import { calculateVendorFees, type VendorFeeBreakdown } from "./shared/vendor-fees";
import type { VendorCartLineItem } from "@/types/vendor-cart";

export interface VendorSlotAvailability {
  id: string;
  label: string;
  windowStart: string;
  windowEnd: string;
  capacity: number;
  booked: number;
  bookable: boolean;
}

export interface VendorCheckoutSummary {
  items: VendorCartLineItem[];
  fees: VendorFeeBreakdown;
  slots: VendorSlotAvailability[];
}

// Today's calendar date in SCHOOL_TIMEZONE, "YYYY-MM-DD" — the date every
// active slot's capacity is checked/booked against, since these are
// same-day delivery windows.
export function todayInSchoolTimezone(now: Date = new Date()): Date {
  const school = nowInSchoolTimezone(now);
  return new Date(Date.UTC(school.getUTCFullYear(), school.getUTCMonth(), school.getUTCDate()));
}

export async function calculateVendorCheckoutSummary(userId: string): Promise<VendorCheckoutSummary> {
  // Empty cart is a valid, displayable summary state (zero everything) —
  // not an error, same convention as get-checkout-summary.ts.
  const items = await getVendorCartForUser(userId);

  const settings = await getMarketplaceSettings();
  const fees = calculateVendorFees(items, settings);

  const bookedFor = todayInSchoolTimezone();
  const slotRows = await prisma.vendorDeliverySlot.findMany({ where: { active: true }, orderBy: { windowStart: "asc" } });
  const businessIds = Array.from(new Set(items.map((item) => item.businessId)));

  const slots: VendorSlotAvailability[] = await Promise.all(
    slotRows.map(async (slot) => {
      if (businessIds.length === 0) {
        // Nothing in the cart yet to check capacity for — bookability is
        // purely the time cutoff; capacity/booked are meaningless until a
        // vendor is actually selected.
        return { id: slot.id, label: slot.label, windowStart: slot.windowStart, windowEnd: slot.windowEnd, capacity: 0, booked: 0, bookable: isSlotBookable(slot) };
      }

      const capacities = await prisma.vendorTimeframeCapacity.findMany({ where: { slotId: slot.id, businessId: { in: businessIds } } });
      const capacityByBusiness = new Map(capacities.map((c) => [c.businessId, c.capacity]));

      // The bottleneck vendor determines both the displayed numbers and
      // overall bookability — matches create-vendor-orders-for-checkout.ts's
      // per-vendor gate exactly.
      let minRemaining = Infinity;
      let bottleneckCapacity = 0;
      let bottleneckBooked = 0;
      for (const businessId of businessIds) {
        const capacity = capacityByBusiness.get(businessId) ?? 0;
        const booked = await countVendorBookingsForSlot(businessId, slot.id, bookedFor);
        const remaining = capacity - booked;
        if (remaining < minRemaining) {
          minRemaining = remaining;
          bottleneckCapacity = capacity;
          bottleneckBooked = booked;
        }
      }

      return {
        id: slot.id,
        label: slot.label,
        windowStart: slot.windowStart,
        windowEnd: slot.windowEnd,
        capacity: bottleneckCapacity,
        booked: bottleneckBooked,
        bookable: minRemaining > 0 && isSlotBookable(slot),
      };
    })
  );

  return { items, fees, slots };
}
