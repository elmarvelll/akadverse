# System: Deliverer

## Purpose

Covers the deliverer's whole lifecycle: applying, admin approval, and — once approved — the actual pickup/delivery work (the seller<->deliverer OTP handoff, out-for-delivery, buyer OTP delivery confirmation, failed-attempt handling).

## Application & approval

```text
Footer "Become a Deliverer"
  -> POST /api/marketplace/deliverer/apply { firstName, lastName, email, phone? }
  -> Deliverer row created, status = PENDING (no dashboard access yet)
  -> Admin reviews: POST /api/marketplace/admin/deliverers/[id]/approve
       or .../reject { reason }
  -> Approved: footer link becomes "Delivery Dashboard"
```

`User.deliverer` is a relation to the `Deliverer` model, not a duplicated status column on `User` — see the schema comment on that relation. `services/marketplace/deliverer/deliverer.service.ts#getDelivererState` resolves the footer's five possible states (`not_applied`/`pending`/`approved`/`rejected`/`suspended`) from that relation.

A rejected applicant can reapply (no unique constraint blocks a second `Deliverer` row being created after rejection is checked for — actually `Deliverer.userId` **is** `@unique`, so a rejected applicant currently **cannot** create a second application row; the "reapply" path referenced in the footer's own code comment is aspirational until a reapply flow — likely resetting the existing row rather than creating a new one — is built. See [`../decisions/rejected-deliverer-can-reapply.md`](../decisions/rejected-deliverer-can-reapply.md) for the intended design and why it isn't fully wired yet.)

An admin can also suspend a previously-approved deliverer (`POST .../suspend { reason }`), immediately revoking dashboard access (`requireApprovedDeliverer` only lets `status = APPROVED` through).

## Pickup: the seller<->deliverer OTP handoff

```text
Seller: "READY" (fulfillmentStatus READY_FOR_PICKUP, then dropped off)
Coordinator assigns -> Delivery_x_businesses row created with pickupOtp

Deliverer: POST /api/marketplace/deliverer/handoffs/[handoffId]/confirm-pickup { otp }
  -> src/lib/otp.ts#verifyOtp checks code/expiry/attempt-count
  -> on match: every DeliveryItem for that (deliverer, business) pair still
     ASSIGNED -> PICKED_UP; matching OrderItem.deliveryStatus -> PICKED_UP;
     Order.fulfillmentStatus -> HANDED_TO_DELIVERER;
     Order.delivererConfirmedPickupAt + Delivery_x_businesses.delivererConfirmedPickupAt recorded
```

The deliverer never adds items manually — every `DeliveryItem` here was created by the delivery coordinator from items a business already marked ready (see [`delivery-coordinator-system.md`](delivery-coordinator-system.md)).

## Out for delivery + buyer OTP

```text
Deliverer: POST /api/marketplace/deliverer/deliveries/[deliveryItemId]/out-for-delivery
  -> generates OrderItem.deliveryOtp (src/lib/otp.ts), 30-minute expiry
  -> DeliveryItem.status / OrderItem.deliveryStatus -> OUT_FOR_DELIVERY
  -> buyer emailed: "on its way" + the OTP, with the explicit instruction
     "Only share this code after you have received and checked your order."
```

## Delivery confirmation

```text
Deliverer: POST /api/marketplace/deliverer/deliveries/[deliveryItemId]/deliver { otp }
  -> verifyOtp() against OrderItem.deliveryOtp
  -> on match: DeliveryItem/OrderItem -> DELIVERED, deliveryConfirmedAt recorded,
     deliveryAttempted -> TRUE, item handed to escrow as PAYOUT_PENDING
     (services/marketplace/escrow/escrow.service.ts#markItemEligibleForPayout)
```

## Failed attempt

See [`delivery-system.md`](delivery-system.md) for the full first-failure/retry/second-failure/cancellation flow — the deliverer triggers it via `POST .../fail-attempt { reason }`.

## Dashboard

`GET /api/marketplace/deliverer/handoffs` (pending pickups) and `GET /api/marketplace/deliverer/deliveries` (every assigned item, any status) power `studashboard/marketplace/deliverer/page.tsx`.

## Database

`Deliverer`, `Delivery`, `DeliveryItem`, `Delivery_x_businesses`.

## Authentication / Authorization

- Application: any signed-in user.
- Approval/rejection/suspension: `requireAdmin`.
- Pickup/delivery actions: `requireApprovedDeliverer` (session must belong to a `Deliverer` row with `status = APPROVED`).

## Dependencies

Depends on: [`delivery-coordinator-system.md`](delivery-coordinator-system.md) (assignment), [`central-dropoff-system.md`](central-dropoff-system.md).
Depended on by: [`escrow-system.md`](escrow-system.md) (delivery confirmation is what starts payout eligibility).

## Relevant files

`services/marketplace/deliverer/deliverer.service.ts`, `src/lib/otp.ts`, `src/app/api/marketplace/deliverer/**`, `src/app/api/marketplace/admin/deliverers/**`, `src/app/studashboard/marketplace/deliverer/**`, `src/app/studashboard/admin/marketplace/deliverers/page.tsx`, `src/app/studashboard/marketplace/_components/MarketplaceFooter.tsx`.
