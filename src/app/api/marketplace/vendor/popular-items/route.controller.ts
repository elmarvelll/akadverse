// src/app/api/marketplace/vendor/popular-items/route.controller.ts
//
// Controller for GET /api/marketplace/vendor/popular-items?limit=. See
// services/marketplace/vendor/get-popular-vendor-items.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { getPopularVendorItems } from "@/services/marketplace/vendor/get-popular-vendor-items";

export async function listPopularVendorItems(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 8;
    const products = await getPopularVendorItems(Number.isFinite(limit) ? limit : 8);
    return NextResponse.json({ products });
  });
}
