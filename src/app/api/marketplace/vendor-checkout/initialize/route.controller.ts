// .../vendor-checkout/initialize/route.controller.ts
//
// Controller for POST /api/marketplace/vendor-checkout/initialize. See
// services/marketplace/vendor-checkout/create-vendor-orders-for-checkout.ts.
// Mirrors src/app/api/marketplace/checkout/initialize/route.controller.ts's
// shape exactly (same response shape: reference/amountKobo/email) so the
// frontend's Paystack popup wiring is identical between Business and
// Vendor checkout.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runController, readJsonBody } from "@/lib/controller-helpers";
import { unauthorized, badRequest } from "@/lib/service-error";
import { createVendorOrdersForCheckout, EmptyCartError } from "@/services/marketplace/vendor-checkout/create-vendor-orders-for-checkout";

export async function initializeVendorCheckout(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw unauthorized();

    const body = await readJsonBody<{ slotId?: string; location?: string; date?: string }>(request);
    if (!body.slotId?.trim()) throw badRequest("slotId is required.");

    try {
      const { reference, totalAmount } = await createVendorOrdersForCheckout(session.user.id, {
        slotId: body.slotId.trim(),
        location: body.location?.trim() ?? "",
        date: body.date?.trim(),
      });
      return NextResponse.json({ reference, amountKobo: Math.round(totalAmount * 100), email: session.user.email });
    } catch (err) {
      if (err instanceof EmptyCartError) throw badRequest(err.message);
      throw err;
    }
  });
}
