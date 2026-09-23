# Decision: "Estimated delivery," never "expected delivery"

- **Date**: 2026-08-28.
- **Context**: The order/delivery spec explicitly requires the term "estimated time/date of delivery" throughout UI and code, and explicitly says not to use "expected time of delivery."
- **Problem**: The pre-existing (unused) schema column was named `Order.expectedDeliveryDate`, and any new code needed a consistent name to build on top of.
- **Chosen option**: Renamed the column to `Order.estimatedDeliveryAt`, and used "estimated" consistently in every new function name (`calculateEstimatedDelivery`, `getEstimatedDeliveryForBusiness`, `formatEstimatedDelivery`), UI copy, and code comment.
- **Reason**: Direct requirement, and it also better reflects reality — a delivery date computed from a business's declared days-of-week is genuinely an estimate, not a guarantee.
- **Consequences**: Anyone extending this system should keep using "estimated," not "expected," for consistency. The rename was safe because the old column was confirmed unused before this pass began (see `docs/marketplace/data/schema.md`'s original audit).
- **Alternatives rejected**: Keeping the old `expectedDeliveryDate` name and just changing display copy — rejected because the requirement was explicit about code/API naming too, not just UI text.
