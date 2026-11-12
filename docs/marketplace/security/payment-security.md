# Security: Payment (Paystack)

See [`authentication-and-authorization.md`](authentication-and-authorization.md#payment-security) for the primary writeup (webhook signature verification, double-verification, idempotency, key separation). This file exists as the dedicated pointer requested by the documentation structure; the content lives there to avoid duplicating the same explanation in two places and having them drift.

## Quick reference

| Mechanism | Where | Purpose |
|---|---|---|
| HMAC-SHA512 signature check | `src/app/api/webhooks/paystack/route.ts#isValidSignature` | Proves a webhook call actually came from Paystack |
| `timingSafeEqual` | same | Prevents a timing side-channel on the signature comparison |
| Server-side `verifyTransaction()` | `src/lib/external/paystack.ts` | Confirms payment status directly with Paystack rather than trusting the client popup |
| `confirmPaymentByReference`'s pending-only filter | `services/marketplace/checkout/checkout.service.ts` | Idempotency — the webhook and client verify path can't double-process a payment |
| Test/live key split by `NODE_ENV` | `src/lib/external/paystack.ts#getPaystackSecretKey` | Local dev can never accidentally hit Paystack's live API |

## Now implemented

- **Seller payout via Paystack Transfers** — `src/lib/external/paystack.ts#createTransferRecipient`/`initiateTransfer`, driven by `services/marketplace/payout/seller-payout.service.ts`. `Business.paystackRecipientCode` is created once (lazily, on first payout) and cached. See [`../systems/seller-payout-system.md`](../systems/seller-payout-system.md).
- **Late-delivery fine payment via Paystack** — same initialize/verify/webhook pattern as checkout, with a distinct `AKD-FINE-` reference prefix so the webhook can route between order-payment and fine-payment confirmation without ambiguity. See [`../systems/late-delivery-fine-system.md`](../systems/late-delivery-fine-system.md).

## Still not implemented

- **Real Paystack refunds** — `refundOrderItem` reaches `REFUNDED` without an actual Paystack refund API call. See [`gaps.md`](gaps.md).
- **Transfer-webhook resolution** — a transfer that doesn't immediately report `success` (Paystack `pending`/`otp` statuses) has no follow-up handler; see [`gaps.md`](gaps.md).
