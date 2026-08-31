# Data: Historical Price Snapshot

## The mechanism, as implemented

`OrderItem.price` is set once, at checkout (`createOrdersForCheckout` in `services/marketplace/checkout/checkout.service.ts`), from the **cart line's price at that moment** — which itself was read from `Product.price` when the item was added to the cart or last touched. It is never re-read from `Product.price` after order creation.

```ts
items: {
  create: items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    price: item.price,           // ← snapshotted here, permanently
    selectedVariants: ...,
  })),
},
```

Concretely: if a business owner changes `Product.price` after a buyer has already checked out with that product, the existing `OrderItem.price` for that buyer's order **does not change** — it keeps the price that was in effect at checkout time. This matches the required behavior (product price ₦7,000 today, an existing order item correctly stays at ₦5,000 if that's what it was purchased at).

## One caveat worth knowing

The snapshot actually happens **at cart-add/update time**, not literally at the `checkout/initialize` call — `CartItem` itself has no stored price; `getCartForUser`/`toCartLineItem` always reads the **current** `Product.price` live when building `CartLineItem[]`. So a cart line's displayed price tracks the product's current price right up until the moment `createOrdersForCheckout` runs and copies that live value into `OrderItem.price`. After that instant, it is a true, permanent snapshot. In other words: **the cart never has stale prices; the order always does (correctly, by design) once created.**

## Where it's used

- **Order display**: `BusinessOrderSummary.totalAmount` and any per-item order display would read `OrderItem.price`, not `Product.price` (no order-detail UI exists yet to demonstrate this beyond the total, but the field is there).
- **Checkout total**: `Order.totalAmount` is computed once from the snapshot prices at creation and never recalculated.
- **Escrow / refunds / seller payouts**: not implemented yet, but per [`../todo/phase-05-escrow-and-payments.md`](../todo/phase-05-escrow-and-payments.md), any future escrow/payout calculation **must** use `OrderItem.price`, never `Product.price`, for exactly this reason — this is called out explicitly so a future implementer doesn't accidentally join back to the live product price.

## Relevant files

- `services/marketplace/checkout/checkout.service.ts#createOrdersForCheckout`
- `services/marketplace/cart/cart.service.ts#toCartLineItem` (where the *live* price is read, for contrast)
- `prisma/schema.prisma` — `OrderItem.price`
