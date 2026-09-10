// .../vendor/[id]/route.controller.ts
//
// Controller for GET .../vendor/[id] — the public storefront. See
// services/marketplace/vendor/get-vendor-storefront.ts.

import { NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { getVendorStorefront } from "@/services/marketplace/vendor/get-vendor-storefront";

export async function getStorefront(businessId: string): Promise<NextResponse> {
  return runController(async () => {
    const vendor = await getVendorStorefront(businessId);
    return NextResponse.json({ vendor });
  });
}
