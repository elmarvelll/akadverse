// .../vendor-checkout/summary/route.controller.ts
//
// Controller for GET /api/marketplace/vendor-checkout/summary. See
// services/marketplace/vendor-checkout/calculate-vendor-checkout-summary.ts.

import { NextResponse } from "next/server";
import { runController, requireSessionUserId } from "@/lib/controller-helpers";
import { calculateVendorCheckoutSummary } from "@/services/marketplace/vendor-checkout/calculate-vendor-checkout-summary";

export async function getVendorCheckoutSummary(): Promise<NextResponse> {
  return runController(async () => {
    const userId = await requireSessionUserId();
    return NextResponse.json(await calculateVendorCheckoutSummary(userId));
  });
}
