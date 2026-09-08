// .../vendor/[id]/capacity/route.controller.ts
//
// Controller for GET/PUT .../vendor/[id]/capacity — "Set Product
// Deliveries Per Time Range" (spec §3). See
// services/marketplace/vendor/capacity/manage-vendor-capacity.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController, readJsonBody } from "@/lib/controller-helpers";
import { badRequest } from "@/lib/service-error";
import { listVendorCapacity, upsertVendorCapacity } from "@/services/marketplace/vendor/capacity/manage-vendor-capacity";

export async function getCapacity(businessId: string): Promise<NextResponse> {
  return runController(async () => {
    const rows = await listVendorCapacity(businessId);
    return NextResponse.json({ capacity: rows });
  });
}

export async function putCapacity(request: NextRequest, businessId: string): Promise<NextResponse> {
  return runController(async () => {
    const body = await readJsonBody<{ slotId?: string; capacity?: number }>(request);
    if (!body.slotId) throw badRequest("slotId is required.");
    const row = await upsertVendorCapacity(businessId, body.slotId, Number(body.capacity));
    return NextResponse.json({ capacity: row });
  });
}
