// .../fines/[fineId]/verify/route.controller.ts
//
// Controller for POST .../fines/[fineId]/verify. See
// services/marketplace/fines/confirm-fine-payment.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController, readJsonBody } from "@/lib/controller-helpers";
import { badRequest, badGateway, paymentRequired } from "@/lib/service-error";
import { requireOwnedBusiness } from "@/services/marketplace/business/business-ownership.service";
import { confirmFinePaymentByReference } from "@/services/marketplace/fines/confirm-fine-payment";
import { verifyTransaction } from "@/lib/external/paystack";

export async function verifyFinePayment(businessId: string, request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    await requireOwnedBusiness(businessId);
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

    const { confirmedFineId } = await confirmFinePaymentByReference(reference);
    return NextResponse.json({ status: "success", confirmedFineId });
  });
}
