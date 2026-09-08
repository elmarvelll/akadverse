# Data: School Vendor + Vendor Delivery schema

See [`../decisions/vendor-extends-business.md`](../decisions/vendor-extends-business.md) for why this extends `Business`/`Order`/`Delivery*` rather than introducing parallel tables, and for the money/delivery-fee/service-fee/slot sub-decisions referenced below.

## `Business` (extended)

New fields, all `SCHOOL_VENDOR`-only (null/false and unread by Business Marketplace code when `type = BUSINESS`):

- `type BusinessType` (`BUSINESS | SCHOOL_VENDOR`), default `BUSINESS`.
- `vendorCategory String?` — "Food" | "Drinks" | "Snacks" | "Other", free text (same convention as `industry`).
- `availabilityStart` / `availabilityEnd String?` — vendor's own operating window ("HH:MM"), spec default 5PM-8PM. Distinct from a deliverer's preferred availability and from the per-order `VendorDeliverySlot`.
- `paused Boolean` / `pausedAt DateTime?` / `pausedReason String?` — self-service temporary unavailability, distinct from `approvalStatus = SUSPENDED` and `blocked` (both admin-only enforcement).

## `Side` (new)

Universal, vendor-level add-on — never tied to one `Product`. `id, businessId, name, price, available, stock (nullable — null = not inventory-tracked), createdAt, updatedAt`. Relations: `business`, `cartItems`, `orderItems`.

## `CartItem` / `OrderItem` (extended)

`productId` is now nullable; `sideId String?` added to both, with the invariant "exactly one of `productId`/`sideId` is set" enforced at the service layer (not the DB — no CHECK-constraint convention exists in this schema). A cart/order line is either a Product(+variant) purchase or a Side purchase.

Every existing read path that joins through `item.product` was updated to fall back to `item.side` (see the code, not duplicated here) — the two are structurally interchangeable for "what business does this belong to" and "what's its display name."

## `VendorDeliverySlot` (new)

Admin-configurable delivery window — a real row, not a hardcoded array. `id, label, windowStart, windowEnd ("HH:MM"), bookingCutoffMins (default 90), vendorPrepDeadlineMins (default 30), delivererCapacity (default 1), active`. Seeded with the three default windows (5-6/6-7/7-8PM).

## `VendorDeliveryBooking` (new)

One row per checkout containing vendor items — see the decision doc for why the shared delivery fee lives here rather than on any one `Order`. `id, userId, slotId, paystackReference (not unique, same convention as Order.paystackReference), deliveryFee (snapshot), status (VendorBookingStatus: PENDING_PAYMENT | CONFIRMED | CANCELLED), bookedFor (the calendar date)`. Relations: `user`, `slot`, `orders` (the per-vendor `Order` rows from that checkout).

Slot capacity is enforced by counting `PENDING_PAYMENT` + `CONFIRMED` bookings for a `(slotId, bookedFor)` pair against `delivererCapacity`, recounted inside the booking transaction (see Phase 5).

## `Order` (extended)

`vendorDeliveryBookingId String?` — null for Business orders, links a vendor `Order` back to the one `VendorDeliveryBooking` covering its checkout.

## `Delivery_x_businesses` (extended)

Deliverer-payment fields, mirroring `OrderItem`'s existing seller-payout shape exactly: `delivererPayoutAmount, delivererPayoutStatus (DelivererPayoutStatus), delivererPayoutProcessingAt/SucceededAt/FailedAt, delivererPayoutFailureReason, delivererPayoutReference`.

`DelivererPayoutStatus` = `PAYOUT_PENDING | PAYOUT_PROCESSING | PAYOUT_SUCCESS | PAYOUT_FAILED | REJECTED`. `REJECTED` is set when a dispute resolves against the deliverer — a terminal "deliberately not paid" state, distinct from the retryable `PAYOUT_FAILED`.

## `OrderDeliveryOutcome` (extended)

New value `DELIVERED_PENDING_DISPUTE_WINDOW` — delivered but still within the buyer's 24-hour dispute window. Vendor-only; Business orders go straight `PENDING -> DELIVERED`.

## `OrderEventType` (extended, additive)

`VENDOR_APPLICATION_SUBMITTED/APPROVED/REJECTED`, `VENDOR_PAUSED/UNPAUSED`, `VENDOR_SLOT_BOOKED`, `DELIVERER_STUDENT_OTP_VERIFIED`, `DISPUTE_WINDOW_STARTED/ELAPSED`, `DELIVERER_PAYOUT_PENDING/PROCESSING/SUCCESS/FAILED/REJECTED`, `VENDOR_ITEM_REFUND_INITIATED/COMPLETED`.

## `MarketplaceSettings` (extended)

`dropoffLocationName String?`, `dropoffLocationInstructions String?`, `dropoffLocationActive Boolean`. The existing `dropoffLocation` address/room string is untouched; these are purely descriptive additions for the vendor flow's drop-off display.

## `User` (extended)

Deliverer student-email OTP: `studentEmailLocalPart, studentEmailVerifiedAt, studentEmailOtp, studentEmailOtpExpiry, studentEmailOtpAttempts, studentEmailOtpLastSentAt`. The applicant supplies only the local part — `<local>@stu.cu.edu.ng` is constructed server-side. `studentEmailVerifiedAt` proves OTP possession of that mailbox only, **not** university enrollment, and is kept separate from `Deliverer.status` (admin approval is a distinct, later gate).

## Migration

`prisma/migrations/20260903182006_vendor_school_delivery_foundation/` — fully additive (every new column nullable or defaulted), applied to the live DB with zero rows affected.
