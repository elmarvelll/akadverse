// src/app/api/webhooks/paystack/route.controller.ts
//
// Controller for POST /api/webhooks/paystack. See
// services/marketplace/payment/{is-valid-paystack-signature,handle-paystack-event}.ts.

import { NextRequest, NextResponse } from "next/server";
import { isValidPaystackSignature } from "@/services/marketplace/payment/is-valid-paystack-signature";
import { handlePaystackEvent } from "@/services/marketplace/payment/handle-paystack-event";

export async function handleWebhook(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  if (!isValidPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  await handlePaystackEvent(JSON.parse(rawBody));

  // Paystack just wants a 200 to know the webhook was received —
  // everything else (checkout status) is reflected via the confirmed
  // orders themselves.
  return NextResponse.json({ received: true });
}
