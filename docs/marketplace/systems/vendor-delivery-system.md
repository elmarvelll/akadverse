# System: Vendor Delivery (operations)

## Purpose

The operational layer that moves School Vendor orders from vendor prep, through pickup **at the vendor's own location**, to a student deliverer, to the buyer. There is no central vendor drop-off point — see [`../decisions/vendor-independent-architecture.md`](../decisions/vendor-independent-architecture.md) for the correction from the earlier central-drop-off design. It reuses the existing chain-of-custody OTP primitive (`Delivery`, `DeliveryItem`, `Delivery_x_businesses.pickupOtp`, `confirm-pickup.ts`) unchanged — only *who holds the OTP* changes (the vendor, not a coordinator) and the seller→coordinator drop-off confirmation step simply does not exist for vendor items. See [`delivery-coordinator-system.md`](./delivery-coordinator-system.md) and [`central-dropoff-system.md`](./central-dropoff-system.md) for the Business-side machinery this reuses.

## Two independent capacity systems — never conflate these

- **Vendor order-fulfillment capacity** (`VendorTimeframeCapacity`, `businessId + slotId + capacity`): the maximum number of *customer orders* a given vendor can fulfil in a timeframe. Vendor-configured, vendor-owned, shown and edited on the vendor's own dashboard (see [`vendor-system.md`](./vendor-system.md)). Checked per-vendor inside the checkout transaction (below).
- **Admin deliverer-roster capacity** (`VendorDeliverySlot.delivererCapacity` + `DelivererRosterAssignment`): how many *deliverer positions* exist for a timeframe, admin-configured, used only for deliverer applications/scheduling/roster (see "Deliverer roster" below). Never read anywhere in the customer checkout/booking path, and never a substitute for a vendor's own capacity setting.

A vendor's capacity and the deliverer roster's capacity are configured independently, checked independently, and neither one ever gates the other.

## Delivery slots

`VendorDeliverySlot` — a real, admin-editable row per window (seeded with the three defaults: 5-6PM/6-7PM/7-8PM), never a hardcoded array. Each carries `windowStart/windowEnd`, `bookingCutoffMins` (default 90), `vendorPrepDeadlineMins` (default 30, how early a vendor must have an order ready for pickup), `delivererCapacity` (default 1, the admin deliverer-roster number described above), `active`. Admin editor: Admin → Vendor Delivery tab (`services/marketplace/admin/vendor-delivery/manage-vendor-slots.ts`).

**Booking cutoff**: `services/marketplace/vendor-delivery/is-slot-bookable.ts` is the single centralized function both the checkout-summary preview and the booking transaction call — never re-implemented ad hoc. Timezone is explicit `Africa/Lagos` (no existing convention to match; documented as a deliberate choice in the function's own comment), computed via `Intl.DateTimeFormat` rather than server-local `Date` math (Vercel's serverless runtime runs in UTC regardless of request origin).

**Vendor capacity**: enforced by counting existing `Order`s for `(businessId, slotId, bookedFor)` (`countVendorBookingsForSlot`) against that vendor's own `VendorTimeframeCapacity.capacity` — a missing row means the vendor hasn't opted into that timeframe, so capacity is 0. Checked per-vendor-in-cart, re-checked inside the booking transaction at Postgres **Serializable** isolation (see below) — never trusted from a pre-transaction read, and never reserved merely by adding to cart.

## Booking → payment → transactional commit

```text
Vendor cart (may span multiple vendors) -> Vendor checkout (slot picker + fee breakdown)
  -> POST /vendor-checkout/initialize
     (create-vendor-orders-for-checkout.ts, SERIALIZABLE transaction)
     - re-validates slot bookability (time cutoff only — never delivererCapacity)
     - re-validates stock AND price for every line (never trusts the cart snapshot)
     - re-validates EACH vendor's own VendorTimeframeCapacity independently
     - creates one VendorDeliveryBooking (PENDING_PAYMENT) + one logically
       separate Order (+ its own OrderItems) per vendor represented, all
       sharing one Paystack reference — one vendor never sees another
       vendor's Order from the same checkout
  -> Paystack popup
  -> POST /checkout/verify (the SAME endpoint the Business flow uses)
     (confirm-payment-by-reference.ts — additive branch)
     - confirms the booking (CONFIRMED) in the same transaction as its Orders
     - auto-accepts every vendor Order (PENDING_SELLER -> ACCEPTED,
       fulfillmentStatus: PROCESSING) — a vendor never manually accepts/rejects
     - clears only the Vendor-scoped cart lines, never the whole cart
```

No inventory or vendor capacity is ever committed just because something is in a cart — only this transaction commits it, exactly once, retrying automatically (bounded) on a Postgres serialization failure rather than risking a double-booked slot or oversold item. A live concurrency check (two simulated concurrent checkouts for the same vendor+slot at capacity 1) confirms exactly one succeeds and exactly one order is created — see the "Verification" note in [`../decisions/vendor-independent-architecture.md`](../decisions/vendor-independent-architecture.md).

## Fees

`services/marketplace/vendor-checkout/shared/vendor-fees.ts` — the one authoritative calculation, used by both the preview and the booking transaction:
- **Delivery fee**: flat, once per checkout (not per vendor), admin-configurable via `MarketplaceSettings.vendorDeliveryFee` (default ₦1000), snapshotted onto `VendorDeliveryBooking.deliveryFee`.
- **Service fee**: `MarketplaceSettings.vendorServiceFeeAmount` (default ₦100) × the count of *distinct* chargeable product ids in the cart — a product's variant lines all share one productId, so quantity/variant selection never multiplies it; `serviceFeeExempt` items and all Sides are excluded. Snapshotted onto `VendorDeliveryBooking.serviceFee`.

Both fees live on `VendorDeliveryBooking`, never split across the per-vendor `Order.totalAmount` rows from the same checkout.

## Vendor prepares, deliverer collects from the vendor's own location

```text
Vendor marks order ready (mark-vendor-order-ready.ts -> fulfillmentStatus:
  READY_FOR_PICKUP, sellerMarkedReadyAt) — no coordinator drop-off step exists
  for vendor items; READY_ITEM_WHERE treats a vendor item as ready the moment
  the vendor says so
  -> Admin assigns a deliverer (from that day's roster, see below) to the
     ready item(s) — assign-delivery.ts, unchanged, already generic over
     ready items regardless of business type
     -> generates the existing pickup OTP (Delivery_x_businesses.pickupOtp),
        now shown on the VENDOR's own Orders page, not a coordinator screen
  -> Deliverer's assigned-items view shows the vendor's own location
     (Business.location) as where to go, distinct from the buyer's delivery
     destination
  -> Deliverer travels to the vendor's location, enters the vendor's OTP
     (confirm-pickup.ts, unchanged) to confirm collection
  -> Deliverer confirms delivery per item to the buyer (existing OTP flow, unchanged)
  -> Order.deliveryOutcome -> DELIVERED_PENDING_DISPUTE_WINDOW (vendor-only;
     recompute-order-delivery-outcome.ts routes here instead of straight to
     DELIVERED, guarded against ever regressing an already-finalized order)
  -> 24h later, hourly cron (vendor-dispute-window-sweep):
     - no dispute -> Order.deliveryOutcome = DELIVERED
     - once every order under a (deliverer, vendor) handoff has cleared
       (DELIVERED, not disputed) -> delivererPayoutStatus: null -> PAYOUT_PENDING
     - disputed order -> left exactly where it is, never auto-finalized
  -> Same cron run also processes PAYOUT_PENDING handoffs via
     process-deliverer-payout.ts (direct structural mirror of the existing
     seller-payout pair) — Paystack transfer, idempotent, bounded retries
```

A deliverer is never permanently tied to one vendor — the same deliverer, in the same timeframe, may collect from several vendors and deliver to several customers; assignment is by timeframe/order, not a fixed vendor relationship.

**Dispute resolution consequence**: `resolveDispute` accepts an optional `responsibleParty`. Only `"DELIVERER"` withholds payment — sets the handoff's `delivererPayoutStatus: REJECTED`. Every other outcome (including "no dispute at all") flows through the normal 24h-window release, satisfying the non-negotiable rule that a deliverer is only ever unpaid when a dispute was upheld against them specifically.

**Item unavailable after payment**: Admin → Vendor Delivery → refund one item (`refund-vendor-item.ts`, reuses `refundOrderItem` unchanged) — only the affected item is refunded; sibling items on the same order are untouched.

## Deliverer application, ranked preferences, and admin roster

Deliverer application is a completely separate concern from vendor capacity — this is purely about scheduling deliverer availability against admin-configured deliverer positions per timeframe (`VendorDeliverySlot.delivererCapacity`):

```text
Applicant sees each active slot's admin-configured capacity and remaining
  positions (GET /marketplace/vendor-delivery/slots) and RANKS their
  preferred timeframes in order (Deliverer.preferredAvailability, a
  comma-separated field reinterpreted as ranked — index 0 = first choice;
  no schema change)
  -> Applicant is shown explicitly that a preference is not a guarantee:
     admin makes the final assignment, and a low-ranked or heavily
     contested timeframe has a lower chance of being assigned
  -> Admin reviews applications (studashboard/admin/marketplace/deliverers),
     sees each applicant's ranked preferences resolved to slot labels
  -> Admin approves, then assigns/reassigns approved deliverers onto the
     roster (DelivererRosterAssignment: delivererId, slotId, date, status)
     via studashboard/admin/marketplace/vendor-delivery's Roster section —
     admin has full control to modify assignments at any time
```

`DelivererRosterAssignment` is who is on duty for a `(slot, date)` — independent of any specific order or vendor. It feeds which deliverers are eligible to be assigned to actual ready items (above), but a roster assignment is not itself an order assignment.

**Deliverer arrival time**: fixed at 30 minutes before the slot's `windowStart` (`DELIVERER_ARRIVAL_LEAD_MINS` in `services/marketplace/vendor-delivery/deliverer-arrival.ts`; e.g. 5-6PM → arrive 4:30PM) — distinct from the vendor's own configurable `vendorPrepDeadlineMins`, which is a different, per-slot, admin-editable number that happens to also default to 30. A deliverer's own dashboard (`GET /marketplace/deliverer/roster`, `list-my-roster.ts`) shows their upcoming `DelivererRosterAssignment` rows with this computed required-arrival time alongside their per-order assignment view.

## Cron registration

`vendor-dispute-window-sweep` runs hourly, registered in `vercel.json` (unlike 4 of the 6 pre-existing marketplace crons, which still aren't registered — a pre-existing gap this work deliberately didn't repeat).
