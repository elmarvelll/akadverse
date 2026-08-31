# Decision: Payment confirmation clears the buyer's entire cart

- **Date**: undocumented.
- **Context**: `confirmPaymentByReference` needs to remove the items that were just paid for so they don't linger in the cart.
- **Problem**: The cart isn't linked back to the specific `Order`/`OrderItem` rows it produced (no `cartItemId` on `OrderItem`), so there's no direct way to delete "only the items that became this order."
- **Chosen option**: Delete **all** `CartItem` rows for the paying user (`prisma.cartItem.deleteMany({ where: { userId } })`), reasoned as safe because the cart was fully snapshotted into orders at `initialize` time — whatever's left in the cart at confirm time is exactly what was just paid for, under the assumption nothing was added in between.
- **Reason**: Simpler than tracking a cart→order-item link, and correct under the assumption that a buyer doesn't modify their cart between clicking "pay" and the payment actually confirming.
- **Consequences**: See the edge case documented in [`../systems/checkout-and-payment-system.md`](../systems/checkout-and-payment-system.md) — if a buyer adds something to their cart during the payment gap, it gets silently deleted too, without having been charged for. Low-severity but real; not currently guarded against.
- **Alternatives rejected**: None currently — this is flagged in [`../security/gaps.md`](../security/gaps.md) as a candidate fix (e.g. locking cart mutation during a pending checkout, or tracking which cart items produced which order) rather than a decision that was actively weighed and rejected.
