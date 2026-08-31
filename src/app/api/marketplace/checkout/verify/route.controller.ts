// src/app/api/marketplace/checkout/verify/route.controller.ts
//
// Controller for POST /api/marketplace/checkout/verify. See
// services/marketplace/checkout/confirm-payment-by-reference.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController, readJsonBody, requireSessionUserId } from "@/lib/controller-helpers";
import { badRequest, badGateway, paymentRequired } from "@/lib/service-error";
import { confirmPaymentByReference } from "@/services/marketplace/checkout/confirm-payment-by-reference";
import { verifyTransaction } from "@/lib/external/paystack";

export async function verifyCheckout(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    await requireSessionUserId();
    const body = await readJsonBody<{ reference?: string }>(request);
    const reference = body.reference?.trim();
    if (!reference) throw badRequest("reference is required.");

    let verified;
    try {
      verified = await verifyTransaction(reference);
    } catch {
      throw badGateway("Couldn't verify this payment with Paystack.");
    }
    if (verified.status !== "success") throw paymentRequired(`Payment ${verified.status}.`);

    const { confirmedOrderIds } = await confirmPaymentByReference(reference);
    return NextResponse.json({ status: "success", confirmedOrderIds });
  });
}
