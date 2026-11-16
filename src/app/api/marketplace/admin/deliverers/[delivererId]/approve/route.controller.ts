// .../admin/deliverers/[delivererId]/approve/route.controller.ts
//
// Controller for POST .../approve. See
// services/marketplace/deliverer/approve-deliverer.ts.

import { NextResponse } from "next/server";
import { runController } from "@/lib/marketplace-controller-helpers";
import { requireAdmin } from "@/lib/marketplace-admin";
import { approveDeliverer as approveDelivererAction } from "@/services/marketplace/deliverer/approve-deliverer";

export async function approveDeliverer(delivererId: string): Promise<NextResponse> {
  return runController(async () => {
    const admin = await requireAdmin();
    await approveDelivererAction(delivererId, admin.user.id);
    return NextResponse.json({ message: "Deliverer approved." });
  });
}
