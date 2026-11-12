# System: Late-Delivery Fine

## Purpose

Enforces the 15-hour seller drop-off deadline with a real consequence: a fine, paid through Paystack, that restricts the business from delivery until settled.

## Flow

```text
Seller misses the drop-off deadline (see central-dropoff-system.md)
  -> issueLateDeliveryFine() (services/marketplace/fines/late-delivery-fine.service.ts)
     -> LateDeliveryFine row created, status=PENDING, amount=LATE_DELIVERY_FINE_AMOUNT
     -> Business.deliveryRestricted -> true, deliveryRestrictedAt recorded,
        lateDeliveryCount incremented
     -> seller emailed (sellerLateDeliveryRestrictionEmail)
     -> LATE_DELIVERY_FINE_ISSUED + BUSINESS_DELIVERY_RESTRICTED events recorded

Seller pays via Paystack:
  POST .../fines/[fineId]/initialize -> Paystack reference (prefixed AKD-FINE-
    so the webhook can tell a fine payment apart from an order checkout
    payment without ambiguity)
  Buyer/seller completes payment in the Paystack popup
  POST .../fines/[fineId]/verify (client-triggered) OR the webhook
    (Paystack-triggered) -> confirmFinePaymentByReference() — same
    idempotent "only touch a still-PENDING row" pattern as order payment
    confirmation
     -> LateDeliveryFine.status -> PAID
     -> refreshDeliveryRestriction(): Business.deliveryRestricted only
        cleared once EVERY outstanding fine for that business is PAID —
        never partially, since a business can incur more than one fine
     -> LATE_DELIVERY_FINE_PAID (+ BUSINESS_DELIVERY_UNRESTRICTED if now
        fully cleared) events recorded
```

## Fine amount

`LATE_DELIVERY_FINE_AMOUNT = ₦2,000` — **a placeholder**. No amount is specified anywhere in the product requirements; this is a named constant (same convention as `SERVICE_FEE_RATE`) specifically so it's a one-line change once a real amount is decided. Do not treat ₦2,000 as a settled business decision.

## Database

`LateDeliveryFine` (one row per fine, so history survives even after payment), `Business.{deliveryRestricted, deliveryRestrictedAt, lateDeliveryCount}`.

## API

| Route | Method |
|---|---|
| `/api/marketplace/businesses/[id]/fines` | GET — list + current restriction state |
| `/api/marketplace/businesses/[id]/fines/[fineId]/initialize` | POST |
| `/api/marketplace/businesses/[id]/fines/[fineId]/verify` | POST |

Also wired into `/api/webhooks/paystack` (reference-prefix routing — see [`payment-system.md`](../security/payment-security.md)).

## Authorization

**Important restriction**, not enforced by this system**: a delivery-restricted business is not currently prevented from anything else in the app (products can still be listed, new orders can still be accepted). The restriction flag exists and is surfaced in the seller dashboard, but nothing yet blocks e.g. a new order's fulfillment flow while restricted — the requirement was "restrict the business from delivery," and today's implementation only reaches as far as central drop-off/coordinator assignment naturally already requiring a non-restricted flow implicitly through the normal order lifecycle. If a harder block is needed later, see [`../todo/phase-04-delivery.md`](../todo/phase-04-delivery.md).

## Dependencies

Depends on: [`central-dropoff-system.md`](central-dropoff-system.md).

## Relevant files

`services/marketplace/fines/late-delivery-fine.service.ts`, `src/app/api/marketplace/businesses/[id]/fines/**`, `src/app/api/webhooks/paystack/route.ts`.
