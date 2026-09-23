# Decision: Service fee is a flat ₦0 constant for now

- **Date**: undocumented.
- **Context**: Checkout needs a `serviceFee` concept in its total-calculation shape, for the UI to have somewhere to eventually show a platform fee.
- **Problem**: No fee model (percentage, fixed, tiered) has been decided or built yet, but the checkout summary shape needed a field for it now rather than later.
- **Chosen option**: `SERVICE_FEE = 0`, exported as a named constant from `services/marketplace/checkout/checkout.service.ts` (not inlined at each call site) specifically so it's a single point of change once a real fee model is decided.
- **Reason**: Ships a working checkout flow today without blocking on an undecided business decision (what the fee should actually be), while keeping the code ready to plug in a real value later.
- **Consequences**: `Order.totalAmount` and everything downstream (payout math, once it exists) currently reflect zero platform fee. Do not assume the ₦0 is a permanent pricing decision — it's a placeholder. See [`../todo/phase-05-escrow-and-payments.md`](../todo/phase-05-escrow-and-payments.md) for where real fee logic would need to land, and [`../data/schema.md`](../data/schema.md) — there is no `serviceFee` column persisted anywhere; it's computed at request time only.
- **Alternatives rejected**: None recorded — this was a "ship the shape, defer the number" decision, not a considered trade-off between fee models.
