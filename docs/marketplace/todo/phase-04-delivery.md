# Phase 4 — Delivery (drop-off, deliverer, OTP handoffs, delivery attempts)

## Status: ✅ Done, with a few real gaps

- [x] `Deliverer` model + relations (`User`, `Delivery`, `DeliveryItem`, `Delivery_x_businesses`).
- [x] Deliverer application flow ("Become a Deliverer" footer link, now real) + admin approval + `User`-side state via the `Deliverer` relation (not applied/pending/approved/rejected/suspended).
- [x] `Delivery`, `DeliveryItem`, `Delivery_x_businesses` models.
- [x] Central drop-off operational flow (seller → drop-off → coordinator → deliverer).
- [x] Delivery-days: structured (`BusinessDeliveryDay`, day-of-week, up to 4, 1-2 recommended). See [`../data/delivery-days.md`](../data/delivery-days.md).
- [x] Delivery-window concept + the reusable estimated-delivery calculation function. See [`../data/estimated-delivery-and-windows.md`](../data/estimated-delivery-and-windows.md). **Gap**: the window itself is still one fixed constant (5:00 PM–8:30 PM) for every business/order — not yet business-configurable.
- [x] Seller drop-off deadline (15h before start of new day) + late-delivery fine + delivery-restriction flag + Paystack fine payment flow.
- [x] Seller → deliverer OTP handoff (`Delivery_x_businesses.pickupOtp`).
- [x] Buyer delivery OTP (`OrderItem.deliveryOtp`).
- [x] Delivery attempt tracking (`deliveryAttempted`: PENDING/TRUE/FALSE), `failedDeliveryAttempts`, `retryDeliveryAt`, 24-hour retry, second-failure cancellation.
- [x] Deliverer dashboard (pending pickups, assigned items, status-appropriate actions).
- [x] Daily 12:00 AM deliverer crons (schedule + inventory-diagnostic).
- [ ] **Delivery restriction isn't enforced beyond the dashboard warning** — a restricted business isn't actually blocked from further order/drop-off/assignment flow anywhere else. See [`../systems/late-delivery-fine-system.md`](../systems/late-delivery-fine-system.md) and [`../security/gaps.md`](../security/gaps.md).
- [ ] **`pickupScheduledAt`** — reserved field on `Order`, never written; the delivery coordinator's assignment doesn't currently schedule a specific pickup time, only performs the assignment.
- [ ] **Delivery windows aren't business-configurable** — see above.
- [ ] Multi-drop-off-location support — the current model assumes exactly one central point (see [`../decisions/central-dropoff-location.md`](../decisions/central-dropoff-location.md)).

## Dependencies

Phase 3.

## Relevant systems

[`../systems/central-dropoff-system.md`](../systems/central-dropoff-system.md), [`../systems/delivery-coordinator-system.md`](../systems/delivery-coordinator-system.md), [`../systems/deliverer-system.md`](../systems/deliverer-system.md), [`../systems/delivery-system.md`](../systems/delivery-system.md), [`../systems/late-delivery-fine-system.md`](../systems/late-delivery-fine-system.md)
