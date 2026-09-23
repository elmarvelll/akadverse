# Decision: Product variants are attribute-only (no per-combination pricing/stock)

- **Date**: undocumented.
- **Context**: The schema supports full per-combination variant pricing/stock (`ProductVariant` + `VariantValueOnProductVariant`), but the product-creation flow only needed to support something simpler at launch.
- **Problem**: Building full per-combination pricing/stock generation (e.g. a "Red / Large" combination costing differently and having its own stock count from "Blue / Small") is meaningfully more UI and data-modeling work than just letting a buyer pick attribute values for display/preference purposes.
- **Chosen option**: The create-product form only writes `VariantField` + `VariantValue` rows (the attribute definitions themselves); no `ProductVariant` rows are generated from them. Every variant combination shares the base `Product.price`/`Product.stock`.
- **Reason**: Ships variant *selection* (useful for buyers specifying "which color/size did you mean") without the added complexity of per-combination inventory, which the schema anticipates but doesn't yet require.
- **Consequences**: A cart line's `selectedVariants` is purely informational — it does not affect the price charged or the stock decremented (and as noted in [`../security/gaps.md`](../security/gaps.md), stock isn't decremented at all yet regardless). `CartItem.variantId` (a real FK to `ProductVariant`) is consequently never set by the cart POST route.
- **Alternatives rejected**: Full per-combination `ProductVariant` generation at product-creation time — deferred, not rejected outright; the schema is already shaped to support it later.
