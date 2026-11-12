# Data: Marketplace Schema

Source of truth: `prisma/schema.prisma`. Always cross-check against the live schema file; this doc can drift, that file cannot.

## Business

Owned by a `User` (`userId`, cascade delete). Core profile: `name`, `industry`, `description`, `contactInfo`, optional logo (`public_id`/`secure_url`). Banking: `paymentMethod`, `bankName`, `bankCode` (re-added — see [`../decisions/business-bank-code-reintroduced.md`](../decisions/business-bank-code-reintroduced.md)), `accountNumber`, `accountHolderName`, `paystackRecipientCode` (set lazily on first payout — see [`../systems/seller-payout-system.md`](../systems/seller-payout-system.md)). Delivery: `deliveryDays` (relation to `BusinessDeliveryDay`), `deliveryRestricted`/`deliveryRestrictedAt`/`lateDeliveryCount` (see [`../systems/late-delivery-fine-system.md`](../systems/late-delivery-fine-system.md)). `serviceDays`/`serviceTimes` remain free-text, uncollected-by-any-form columns — **not** the same concept as `deliveryDays`; do not conflate them. `visitors` (Int, default 0) — still nothing increments it.

## Product / VariantField / VariantValue / ProductVariant / VariantValueOnProductVariant

Unchanged by this pass — see the earlier notes: `category` is free text, variants are attribute-only (no per-combination `ProductVariant` generation), `rating`/`ratingCount` are still unused.

## CartItem

Unchanged.

## Order

| Field | Type | Notes |
|---|---|---|
| `status` | `OrderStatus` | Was a free-text string; now an enum, default `PENDING_SELLER` |
| `rejectionReason` | `String?` | |
| `autoRejected` | `Boolean` | True only when the seller-response cron rejected it |
| `acceptedAt`/`rejectedAt`/`cancelledAt` | `DateTime?` | |
| `fulfillmentStatus` | `FulfillmentStatus?` | Null until accepted |
| `sellerMarkedReadyAt`/`pickupScheduledAt`/`sellerDroppedOffAt`/`delivererConfirmedPickupAt` | `DateTime?` | `pickupScheduledAt` is reserved, not yet written by any route |
| `deliveryOutcome` | `OrderDeliveryOutcome` | Rollup of item delivery states, default `PENDING` |
| `estimatedDeliveryAt`/`deliveryWindowStart`/`deliveryWindowEnd` | `DateTime?` | Replaces the old, unused `expectedDeliveryDate` column — set once at checkout, never recalculated |
| `totalAmount`, `userId`, `businessId` | unchanged | |
| `isDisputed`/`disputeReason`/... | unchanged, still unused | No dispute flow exists |
| `deliveryLocation` | unchanged | Snapshotted at checkout |
| `paystackReference` | unchanged | Shared across sibling orders from one checkout |
| `paymentStatus` | `String` (`"pending"`/`"paid"`) | Unchanged — a different concern from `OrderItem.escrowStatus`, see [`order-states.md`](order-states.md) |

**Removed in this pass** (dead columns dropped, not just left unused): `shipOtp`, `shipOtpExpiry`, `deliveryOtp`, `deliveryOtpExpiry`, `deliveryOtpAttempts`, `escrowReleaseAt`, `escrowReleased`, `escrowReleasedAt`, `escrowTransferReference`, `escrowTransferCode`, `escrowReleaseStatus`, `escrowFailureReason` — all superseded by item-level equivalents on `OrderItem` (see below), since escrow/OTP genuinely need to operate per item, not per order. See [`order-data-flow.md`](order-data-flow.md).

## OrderItem

| Field | Type | Notes |
|---|---|---|
| `price` | `Float` | Historical snapshot — see [`price-snapshots.md`](price-snapshots.md) |
| `rejectedAt`/`rejectionReason` | | Item-level rejection, independent of `Order.rejectionReason` |
| `cancelledAt`/`cancellationReason` | | Set on second-failed-delivery cancellation |
| `deliveryStatus` | `DeliveryStatus?` | See [`order-states.md`](order-states.md) |
| `deliveryAttempted` | `DeliveryAttempted` | Tri-state, default `PENDING` |
| `failedDeliveryAttempts` | `Int` | |
| `retryDeliveryAt` | `DateTime?` | |
| `deliveryConfirmedAt` | `DateTime?` | |
| `deliveryOtp`/`deliveryOtpExpiry`/`deliveryOtpAttempts` | | Buyer delivery OTP, per item |
| `escrowStatus` | `EscrowPaymentStatus` | Default `HELD` |
| `refundedAt`/`refundReference` | | |
| `payoutStatus`/`payoutAttempts`/`payoutProcessingAt`/`payoutSucceededAt`/`payoutFailedAt`/`payoutFailureReason`/`payoutReference` | | See [`../systems/seller-payout-system.md`](../systems/seller-payout-system.md) |
| `deliveryItem` | relation | 1:1 with `DeliveryItem` |
| `events` | relation | `OrderEvent[]` scoped to this item |

## Deliverer

One row per applicant. `userId` `@unique` (one application per user — see [`../decisions/rejected-deliverer-can-reapply.md`](../decisions/rejected-deliverer-can-reapply.md) for how reapplication works within that constraint). `status: DelivererStatus`, application/approval/rejection/suspension audit fields.

## Delivery

One deliverer's assigned run: `deliverymanId` (naming per the product spec), `expectedDeliveryAt`, `status: DeliveryStatus`.

## DeliveryItem

One `OrderItem`, as tracked through a `Delivery`. `orderItemId` `@unique` — a deliverer never invents new items; every row here started life as an existing `OrderItem` a business marked ready. Reused (upserted), not recreated, across a delivery-retry reassignment.

## Delivery_x_businesses

The pickup handoff record between one deliverer and one business: `deliverymanId`, `businessId`, `deliveryStatus`, `expectedDeliveryAt`, `pickupOtp`/`pickupOtpExpiry`/`pickupOtpAttempts`, `delivererConfirmedPickupAt`.

## OrderEvent

Append-only history — see [`../systems/order-history-system.md`](../systems/order-history-system.md).

## BusinessDeliveryDay

Join table, one row per selected day-of-week — see [`delivery-days.md`](delivery-days.md).

## LateDeliveryFine

One row per fine incurred — see [`../systems/late-delivery-fine-system.md`](../systems/late-delivery-fine-system.md).

## Notification, Review

Unchanged — still schema-only, no writer anywhere in the Marketplace.

## Skill / SkillOffer / SkillCounterOffer / SkillReview / SkillNotification / SkillType / Category

Unchanged — see [`../systems/skills-marketplace-mock.md`](../systems/skills-marketplace-mock.md).

## Models this documentation intentionally does not cover

`User` (platform-wide), `EmailConnection`, `Suggestion`, `Schedule`, `Task`, `student_playlists`.
