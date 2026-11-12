# Decision: School Vendor extends Business, doesn't duplicate it

- **Date**: 2026-09-03.
- **Context**: A new "School Vendor" ecosystem (food/drink/snack sellers, operating a fixed 5-8PM window, delivered in three timed slots by student deliverers) was requested alongside the existing Business Marketplace. Roughly 90% of the required machinery — application/approval lifecycle, escrow, seller payout, OTP-gated chain-of-custody delivery, disputes-on-order, admin dashboard pattern, notifications, cron infra — already exists for `Business`/`Order`/`Delivery*`.
- **Options considered**:
  1. Parallel `Vendor`, `VendorApplication`, `VendorOrder`, `VendorOrderItem` etc. tables, reusing only cross-cutting infra (payment client, cron auth, admin auth, notification/email writers).
  2. Extend `Business` with a `type` discriminator (`BUSINESS | SCHOOL_VENDOR`) and reuse `Order`/`OrderItem`/`Delivery`/`Deliverer`/escrow/payout as-is, adding new models only where nothing already exists (`Side`, `VendorDeliverySlot`, `VendorDeliveryBooking`, deliverer-payout fields).
- **Chosen option**: 2.
- **Reason**: A School Vendor is structurally a seller with an approval lifecycle, products, orders, and a delivery chain-of-custody — exactly what `Business`/`Order`/`Delivery*` already model. Extending means the existing seller-payout cron pays vendor `OrderItem`s for free (no code change needed at all), the existing OTP handoff/dispute-on-order/admin-approval machinery all apply unchanged, and only genuinely new concepts (universal Sides, admin-configurable delivery slots with capacity, a shared-per-checkout delivery fee, deliverer payout) get new schema.
- **Consequences**:
  - Every shared file that must stay safe for Business either branches additively (e.g. `confirmPaymentByReference` gains an additive `VendorDeliveryBooking` confirmation block) or is left untouched entirely with vendor logic living in a sibling file (e.g. `create-vendor-orders-for-checkout.ts` next to `create-orders-for-checkout.ts`, never modifying it).
  - `CartItem`/`OrderItem.productId` had to become nullable to let a cart/order line be a `Side` instead of a `Product` — this touched several existing Business-flow read paths (admin dispute list, order history, delivery assignment/listing), all fixed with `product?.name ?? side?.name` style fallbacks so they render vendor Side lines correctly too, not just silence the type checker.
  - Two further conflicts between the spec's literal wording and this "extend" decision were resolved explicitly rather than picked silently — see below.

## Sub-decision: money stays `Float`

The entire schema uses `Float` for every monetary field; there is no `Int`/`Decimal` precedent anywhere. The spec calls for no float arithmetic for money. Migrating the whole schema to a different monetary representation would be a platform-wide breaking change far outside this feature's scope, touching every existing Business Marketplace consumer (checkout math, payout math, admin dashboards, emails).

**Decision**: new vendor money fields (`Side.price`, `VendorDeliveryBooking.deliveryFee`, deliverer payout amounts, the flat vendor service fee) stay `Float`, for consistency with the existing codebase. Precision is protected the same way the existing payout code already protects it — round only at the Paystack kobo boundary (`Math.round(net * 100)`), never mid-calculation. This is a deliberate, scoped deviation from the spec's literal wording, not an oversight.

## Sub-decision: one delivery fee per multi-vendor checkout

"One Order per business, sharing one Paystack reference" (see `one-order-per-business-shared-reference.md`) makes `Order.totalAmount` mean "what this business is owed for its items." A single flat delivery fee, charged once per checkout even when the cart spans multiple vendors, doesn't fit that meaning — adding it to every vendor `Order.totalAmount` in a 3-vendor checkout would triple-charge it.

**Decision**: the delivery fee (and the checkout's delivery-slot booking itself) is held on a new `VendorDeliveryBooking` row, one per checkout that contains vendor items, keyed by the same shared `paystackReference` the resulting `Order` rows carry. `Order.totalAmount` keeps its existing meaning unchanged, so the existing seller-payout code needs zero changes. The alternative — flagging the fee onto one arbitrarily-chosen `Order` in the checkout — was rejected because it makes "which order has the fee" an implicit convention every future reader (payout, refund, admin display) would have to special-case.

## Sub-decision: service fee is a separate flat function, not `SERVICE_FEE_RATE`

`services/marketplace/checkout/shared/service-fee.ts`'s `SERVICE_FEE_RATE` is a percentage-of-gross constant governing Business checkout only (see `flat-zero-service-fee.md`), currently `0`. The vendor spec wants a flat ₦100-per-distinct-chargeable-main-item fee with a data-driven `serviceFeeExempt` flag (never a hardcoded product-name check). These are structurally different fee shapes.

**Decision**: vendor checkout gets its own flat-fee constant/function (`vendorServiceFeeAmount`, admin-configurable), computed by a new `calculateVendorServiceFee` in the vendor-checkout service tree. `checkout/shared/service-fee.ts` is never touched — Business checkout's fee model is completely unaffected.

## Sub-decision: `VendorDeliverySlot` is a new model, not a `MarketplaceSettings` extension

`MarketplaceSettings` is a global singleton with two named `"HH:MM"` window pairs. It cannot represent three independently admin-configurable delivery windows, each with its own booking cutoff, vendor prep deadline, and deliverer capacity.

**Decision**: new `VendorDeliverySlot` model, seeded with the three default windows (5-6/6-7/7-8PM) via a one-off seed script — never a hardcoded array in application code. `MarketplaceSettings` itself is untouched beyond additive central-drop-off-location detail fields (`dropoffLocationName`/`Instructions`/`Active`), which don't affect its two existing window fields.
