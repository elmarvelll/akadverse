// services/marketplace/vendor/capacity/resolve-vendor-capacity.ts
//
// THE single place that resolves "what is this vendor's order-fulfillment
// capacity for this slot, on this specific date" (spec §7) — checked by
// the checkout summary preview, the booking transaction, and the vendor's
// own capacity dashboard, so none of them can drift apart. Resolution
// order: a VendorTimeframeCapacityOverride row for the exact date, else
// VendorTimeframeCapacity's default/recurring row, else 0 (a vendor who
// never configured this slot at all still has 0 capacity for it, same
// convention as before date-specific capacity existed).

import { prisma } from "@/lib/prisma";
import type { Db } from "@/services/marketplace/order/shared/db";

export async function resolveVendorCapacity(businessId: string, slotId: string, date: Date, db: Db = prisma): Promise<number> {
  const override = await db.vendorTimeframeCapacityOverride.findUnique({
    where: { businessId_slotId_date: { businessId, slotId, date } },
    select: { capacity: true },
  });
  if (override) return override.capacity;

  const defaultRow = await db.vendorTimeframeCapacity.findUnique({
    where: { businessId_slotId: { businessId, slotId } },
    select: { capacity: true },
  });
  return defaultRow?.capacity ?? 0;
}
