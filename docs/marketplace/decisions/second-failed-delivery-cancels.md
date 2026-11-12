# Decision: A second failed delivery attempt cancels the item, not the whole order

- **Date**: 2026-08-28.
- **Context**: The spec requires a 24-hour retry after a first failed delivery, and cancellation after a second failure.
- **Problem**: "Cancel the order" could mean the whole `Order` or just the affected item.
- **Chosen option**: Item-level cancellation — `OrderItem.cancelledAt`/`cancellationReason` set on the specific item; sibling items in the same order are unaffected and continue through their own delivery lifecycle independently.
- **Reason**: Consistent with the broader item-level design this whole system uses (escrow, delivery status, rejection are all item-scoped — see [`separate-status-fields.md`](separate-status-fields.md)). Cancelling an entire order because one item failed twice would contradict the explicit partial-delivery requirement.
- **Consequences**: `Order.deliveryOutcome` can end up `CANCELLED` only when *every* item is cancelled; otherwise a cancelled item alongside delivered ones surfaces as `PARTIALLY_DELIVERED`. `Order.status` itself is never set to `CANCELLED` by this flow (that enum value is reserved, currently unset by any route — see [`../data/order-states.md`](../data/order-states.md)).
- **Alternatives rejected**: Whole-order cancellation on any single item's second failure — rejected as inconsistent with item-level escrow and partial delivery.
