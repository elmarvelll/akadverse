# Security: OTP

Two independent OTP flows now exist — both implemented, both using the shared helper `src/lib/otp.ts`.

## Shared mechanics

- **Generation**: `generateOtp()` — 6 digits, zero-padded, via `crypto.randomInt` (cryptographically strong, not `Math.random`).
- **Expiry**: `buildOtpExpiry()` — 30 minutes from issuance (`OTP_TTL_MS`). No exact TTL is specified anywhere in the product requirements; 30 minutes is a reasonable default for a physical handoff/delivery interaction, chosen and documented as such rather than invented silently.
- **Attempt limiting**: `MAX_OTP_ATTEMPTS = 5` — `verifyOtp()` refuses verification once the stored attempt counter reaches this, even if the correct code is later supplied. Guards against brute-forcing a 6-digit code (1,000,000 possibilities — 5 attempts is a meaningful limit against online guessing).
- **Verification is pure**: `verifyOtp()` takes the supplied code, stored code/expiry/attempt-count and returns a typed result (`ok: true` or `ok: false` with a `reason`) — no side effects. Every call site is responsible for persisting the incremented attempt count itself (both on success and failure), which every OTP route in the codebase does explicitly, before checking the result.

## Seller → deliverer pickup OTP

Lives on `Delivery_x_businesses.pickupOtp` (not per item — one OTP covers the whole handoff of one business's ready items to one deliverer, since they're physically handed over together). Issued at delivery-coordinator assignment time (`POST /api/marketplace/admin/deliveries`). Verified by `POST /api/marketplace/deliverer/handoffs/[handoffId]/confirm-pickup`. Every verification attempt (success or failure) is logged as a `DELIVERER_PICKUP_OTP_VERIFIED` `OrderEvent` with `metadata: { success }`.

## Buyer delivery OTP

Lives on `OrderItem.deliveryOtp` (per item — the deliverer confirms delivery one selected item at a time). Issued the moment a deliverer marks an item `OUT_FOR_DELIVERY`, emailed immediately with the explicit instruction **"Only share this code after you have received and checked your order."** Verified by `POST /api/marketplace/deliverer/deliveries/[deliveryItemId]/deliver`. Every attempt is logged as `BUYER_OTP_VERIFICATION_ATTEMPTED`.

Also surfaced on the buyer's own order-tracking page (`GET /api/marketplace/orders`), but **only** while the item's `deliveryStatus = OUT_FOR_DELIVERY` — never before issuance, never after delivery/expiry — so a buyer who missed the email can still retrieve it, without leaking a stale/used code once it's no longer relevant.

## What's not covered

- No rate limiting on the OTP-verification *routes themselves* beyond the per-OTP attempt counter — a deliverer account (already authenticated, already scoped to their own assigned items) could still hammer the route with many different OTPs across many delivery items in quick succession. Low real-world risk given deliverer accounts are individually admin-approved, but worth noting per [`gaps.md`](gaps.md).
- No SMS delivery of OTPs — email only, via `services/marketplace/notifications/email.service.ts`. If a school context needs SMS instead/also, that's a new integration, not present today.
