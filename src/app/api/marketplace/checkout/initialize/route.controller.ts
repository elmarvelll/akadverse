// src/app/api/marketplace/checkout/initialize/route.controller.ts
//
// Controller for POST /api/marketplace/checkout/initialize. See
// services/marketplace/checkout/create-orders-for-checkout.ts.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runController, readJsonBody } from "@/lib/controller-helpers";
import { unauthorized, badRequest } from "@/lib/service-error";
import { createOrdersForCheckout, EmptyCartError } from "@/services/marketplace/checkout/create-orders-for-checkout";

export async function initializeCheckout(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw unauthorized();

    const body = await readJsonBody<{ location?: string }>(request);

    try {
      const { reference, totalAmount } = await createOrdersForCheckout(session.user.id, body.location?.trim() ?? "");
      return NextResponse.json({ reference, amountKobo: Math.round(totalAmount * 100), email: session.user.email });
    } catch (err) {
      if (err instanceof EmptyCartError) throw badRequest(err.message);
      throw err;
    }
  });
}
