# Data: Estimated Delivery & Delivery Windows

## Terminology

Always **"estimated delivery,"** never "expected delivery" — in UI copy, API field names (`estimatedDeliveryAt`, not `expectedDeliveryDate` — the old, unused `Order.expectedDeliveryDate` column was renamed for this reason), and code comments. See [`../decisions/estimated-not-expected-delivery.md`](../decisions/estimated-not-expected-delivery.md).

## The reusable calculation

`services/marketplace/delivery/estimated-delivery.service.ts#calculateEstimatedDelivery(deliveryDays, from)` — pure, synchronous, no DB access:

1. Reads the business's configured delivery days (`DayOfWeek[]`; if none are configured, every day is treated as a candidate so checkout still works).
2. Starting from `MIN_LEAD_DAYS + 1` days after `from` (`MIN_LEAD_DAYS = 4`), walks forward day by day.
3. Returns the first date whose day-of-week is in the business's delivery days — i.e. it **never** picks a day 4 or fewer days out, always the next appropriate alternative past that cutoff.
4. Applies the fixed delivery window (see below) to produce `{ estimatedDeliveryAt, deliveryWindowStart, deliveryWindowEnd }`.

`services/marketplace/delivery/estimated-delivery.service.ts#getEstimatedDeliveryForBusiness(businessId, from)` is the DB-backed wrapper every route actually calls — it loads `BusinessDeliveryDay` rows and delegates to the pure function above.

## Where it's used

- **Product profile** (`GET /api/marketplace/products/[id]`) — shown in the product detail modal before a buyer adds to cart.
- **Checkout** (`getCheckoutSummary` in `services/marketplace/checkout/checkout.service.ts`) — one estimate per business represented in the cart, shown per line item on the checkout page.
- **Order creation** (`createOrdersForCheckout`) — computed once at checkout time and **persisted** onto `Order.{estimatedDeliveryAt, deliveryWindowStart, deliveryWindowEnd}`, never recalculated afterward. This is why the estimate a buyer saw at checkout is guaranteed to match what "Mark ready" later emails them — both read the same stored value.

## Delivery windows

A fixed constant today, not yet business-configurable: `DELIVERY_WINDOW = { startHour: 17, startMinute: 0, endHour: 20, endMinute: 30 }` (5:00 PM – 8:30 PM), in `services/marketplace/delivery/estimated-delivery.service.ts`. Every order gets the same window on its estimated delivery date. Making this per-business (or per-delivery-day) configurable is listed in [`../todo/phase-04-delivery.md`](../todo/phase-04-delivery.md) — not built yet.

## Display format

`services/marketplace/delivery/estimated-delivery.service.ts#formatEstimatedDelivery` — the single formatting function every screen uses, producing e.g. `{ date: "Wednesday, September 2", window: "5:00 PM - 8:30 PM" }`.

## Relevant files

`services/marketplace/delivery/estimated-delivery.service.ts`, `services/marketplace/checkout/checkout.service.ts`, `src/app/api/marketplace/products/[id]/route.ts`, `src/app/studashboard/marketplace/checkout/page.tsx`, `src/app/studashboard/marketplace/_components/ProductDetailModal.tsx`.
