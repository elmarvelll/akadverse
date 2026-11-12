// src/app/api/marketplace/vendor/featured/route.controller.ts
//
// Controller for GET /api/marketplace/vendor/featured. See
// services/marketplace/vendor/get-featured-vendors.ts.

import { NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { getFeaturedVendors } from "@/services/marketplace/vendor/get-featured-vendors";

export async function listFeaturedVendors(): Promise<NextResponse> {
  return runController(async () => {
    const vendors = await getFeaturedVendors();
    return NextResponse.json({ vendors });
  });
}
