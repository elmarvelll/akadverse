// .../deliverer/manifest/route.ts
//
// GET -> the signed-in deliverer's Vendor delivery cards (manifest.ts): their
// own assigned bookings only, codes masked — 30 days of history plus older
// outstanding deliveries. Completed bookings remain visible in Delivered.

import { NextResponse } from "next/server";
import { runController } from "@/lib/marketplace-controller-helpers";
import { requireDelivererId } from "../shared/require-deliverer";
import { buildVendorManifests } from "@/services/marketplace/vendor-delivery/handover/manifest";
import { assignDueDeliveries } from "@/services/marketplace/vendor-delivery/slot-briefing";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-delivery/validate-delivery-date";
import { addDays } from "@/services/marketplace/delivery-roster/shared/roster-calendar";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 30;

export async function GET() {
  return runController(async () => {
    const delivererId = await requireDelivererId();
    // Everything due within two hours is assigned before the cards are built,
    // even if the scheduled briefing job hasn't run yet.
    await assignDueDeliveries();
    const today = todayInSchoolTimezone();
    const cards = await buildVendorManifests({ delivererId, fromDate: addDays(today, -HISTORY_DAYS), includeOutstanding: true });
    return NextResponse.json({ cards });
  });
}
