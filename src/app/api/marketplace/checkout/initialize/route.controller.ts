// src/app/api/marketplace/checkout/initialize/route.controller.ts
//
// Controller for POST /api/marketplace/checkout/initialize. See
// services/marketplace/checkout/create-orders-for-checkout.ts.
//
// Initializing a checkout reserves stock and records a payment attempt; it
// never marks anything paid. The response carries the Paystack publishable
// key for the SAME mode (test/live) the server will verify in, so the browser
// popup and the server can't disagree (see src/lib/external/paystack.ts).

import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "@/lib/marketplace-session";
import { runController, readJsonBody } from "@/lib/marketplace-controller-helpers";
import { getCheckoutSummary } from "@/services/marketplace/checkout/get-checkout-summary";
import { ServiceError, unauthorized, badRequest } from "@/lib/service-error";
import { getPaystackPublicKey } from "@/lib/external/paystack";
import { createOrdersForCheckout, EmptyCartError } from "@/services/marketplace/checkout/create-orders-for-checkout";
import { reconcileUserPendingCheckouts } from "@/services/marketplace/checkout/reconcile-user-pending-checkouts";
import { scheduleCheckoutBackgroundWork } from "@/lib/schedule-checkout-background";
import { CHECKOUT_CURRENCY } from "@/services/marketplace/checkout/shared/checkout-payment-config";

export async function initializeCheckout(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const session = await getActiveSession();
    if (!session?.user?.id) throw unauthorized();

    const body = await readJsonBody<{ location?: string; selections?: Record<string,string>; quoteToken?: string }>(request);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      (body.location !== undefined && typeof body.location !== "string") ||
      (body.quoteToken !== undefined && typeof body.quoteToken !== "string")) throw badRequest("Invalid checkout request.");

    // Settle this buyer's earlier unpaid attempt (if any) before reserving
    // again — see reconcile-user-pending-checkouts.ts.
    const prior = await reconcileUserPendingCheckouts(session.user.id, "BUSINESS");
    const emailIds = prior.paid.flatMap((p) => p.emailIds);
    scheduleCheckoutBackgroundWork({ emailIds, sweep: true });

    try {
      const { reference, amountKobo } = await createOrdersForCheckout(session.user.id, body.location?.trim() ?? "", body.selections, body.quoteToken);
      return NextResponse.json({ reference, amountKobo, email: session.user.email, currency: CHECKOUT_CURRENCY, publicKey: getPaystackPublicKey() });
    } catch (err) {
      if (err instanceof ServiceError && err.status === 409 && /changed/.test(err.message)) {
        return NextResponse.json({ error: err.message, summary: await getCheckoutSummary(session.user.id, body.selections) }, { status: 409 });
      }
      if (err instanceof EmptyCartError) throw badRequest(err.message);
      throw err;
    }
  });
}
