// .../admin/disputes/[orderId]/resolve/route.controller.ts
//
// Controller for POST .../resolve. See
// services/marketplace/admin/resolve-dispute.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController, readJsonBody } from "@/lib/controller-helpers";
import { badRequest } from "@/lib/service-error";
import { requireAdmin } from "@/lib/admin";
import { resolveDispute } from "@/services/marketplace/admin/resolve-dispute";

export async function resolve(orderId: string, request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const admin = await requireAdmin();
    const body = await readJsonBody<{ resolution?: string }>(request);
    if (!body.resolution?.trim()) throw badRequest("A resolution note is required.");
    await resolveDispute(orderId, body.resolution.trim(), admin.user.id);
    return NextResponse.json({ message: "Dispute resolved." });
  });
}
