// services/marketplace/payment/handle-paystack-event.ts
//
// Routes a Paystack webhook event to the right confirmation action. Called
// by src/app/api/webhooks/paystack/route.controller.ts.

import { confirmPaymentByReference } from "@/services/marketplace/checkout/confirm-payment-by-reference";
import { confirmFinePaymentByReference } from "@/services/marketplace/fines/confirm-fine-payment";

export async function handlePaystackEvent(event: { event?: string; data?: { reference?: string } }): Promise<void> {
  if (event.event !== "charge.success") return;

  const reference = event.data?.reference;
  if (!reference) return;

  // Fine payments use a distinct "AKD-FINE-" reference prefix (see
  // initialize-fine-payment.ts) so this never has to guess which kind of
  // payment just succeeded — order checkout references never collide with
  // it.
  if (reference.startsWith("AKD-FINE-")) {
    await confirmFinePaymentByReference(reference);
  } else {
    await confirmPaymentByReference(reference);
  }
}
