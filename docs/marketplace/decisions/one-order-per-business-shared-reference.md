# Decision: One Order per business, sharing one Paystack reference

- **Date**: undocumented (present since the checkout flow's initial implementation; no dated commit history beyond a single squashed "initial commit" was found for this file).
- **Context**: A single checkout can contain products from multiple businesses.
- **Problem**: Paystack processes one payment per reference. An `Order` also naturally belongs to one business (for the owner dashboard's order list to make sense). These two constraints conflict if you want "one checkout, one payment" *and* "one order per business."
- **Options considered**:
  1. One `Order` per checkout, spanning multiple businesses (would need `OrderItem` to carry its own `businessId` instead of inheriting `Order.businessId`).
  2. One `Order` per business, each with its own separate Paystack payment.
  3. One `Order` per business, all sharing a single Paystack reference for one combined payment.
- **Chosen option**: 3.
- **Reason**: Keeps `Order.businessId` simple (one order = one business, straightforward for the owner dashboard) while still letting a buyer pay once for a multi-business cart. Documented directly in the schema: `Order.paystackReference` is deliberately **not** `@unique`, specifically because "several Order rows legitimately share one reference."
- **Consequences**: `confirmPaymentByReference` must update *all* orders matching a reference, not assume one order per reference — it does (`updateMany`). Any future code that looks up "the order for this Paystack reference" must account for it potentially being several orders, not one.
- **Alternatives rejected**: Option 1 was rejected implicitly by the current schema shape (`OrderItem` has no `businessId` of its own — it only reaches a business through `Order.businessId`). Revisiting this would be a real schema change, not just new code.
