// src/app/api/marketplace/checkout/summary/route.controller.ts
//
// Controller for GET /api/marketplace/checkout/summary. See
// services/marketplace/checkout/get-checkout-summary.ts.

import { badRequest } from "@/lib/service-error";
import { NextResponse } from "next/server";
import { runController, requireSessionUserId } from "@/lib/marketplace-controller-helpers";
import { getCheckoutSummary } from "@/services/marketplace/checkout/get-checkout-summary";

export async function getSummary(request?: Request): Promise<NextResponse> {
  return runController(async () => {
    const userId = await requireSessionUserId();
    let selections = {};
    try { selections = request ? JSON.parse(new URL(request.url).searchParams.get("selections") || "{}") : {}; } catch { throw badRequest("Invalid delivery selections."); }
    return NextResponse.json(await getCheckoutSummary(userId, selections));
  });
}
