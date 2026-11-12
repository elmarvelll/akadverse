# System: Vendor Delivery (Admin)

## Purpose

Gives an authorized marketplace admin (`User.isAdmin`, same gate as every other admin feature — see [`../security/authorization.md`](../security/authorization.md)) the operational tooling to run the School Vendor delivery process: this is an admin dashboard *tab*, not a new global role (per the product spec's explicit "do not create a `VENDOR_MANAGER` role" instruction). See [`../../marketplace/systems/vendor-delivery-system.md`](../../marketplace/systems/vendor-delivery-system.md) for the full operational lifecycle this tab surfaces.

## Location

`Admin → Vendor Delivery` (`src/app/studashboard/admin/marketplace/vendor-delivery/page.tsx`), a sibling tab under the existing `marketplace` admin domain — not a new top-level domain in `_components/domains.ts`.

## Responsibilities

- **Delivery slot capacity**: edit each `VendorDeliverySlot`'s `delivererCapacity`, `bookingCutoffMins`, `vendorPrepDeadlineMins`, and active/inactive state (`services/marketplace/admin/vendor-delivery/manage-vendor-slots.ts`). Every change is written to `AdminActionLog`.
- **Bookings**: filterable list (`status`, `date`, `slotId`) of every `VendorDeliveryBooking`, with each covered vendor `Order`'s status/fulfillment/delivery/payment/dispute state and item count (`services/marketplace/admin/vendor-delivery/list-vendor-bookings.ts`).
- **Deliverer assignment/reassignment**: reuses the existing `Deliverers → Assignments` page and `assign-delivery.ts` unchanged — vendor `OrderItem`s flow through the same ready-item/assignment machinery Business items use, since assignment is by delivery timeframe/handoff, never bound to one vendor.
- **Central drop-off + vendor fee configuration**: on the existing `Settings` tab (extended, not duplicated) — `dropoffLocationName`/`Instructions`/`Active`, `vendorDeliveryFee`, `vendorServiceFeeAmount`, `delivererPayoutAmount`.
- **Item-level refunds**: refund one unavailable item on a vendor order without affecting sibling items (`services/marketplace/admin/vendor-delivery/refund-vendor-item.ts` → `POST /api/marketplace/admin/vendor-delivery/orders/[orderId]/items/[itemId]/refund`).
- **Disputes**: the existing Disputes tab's resolve action gained an optional `responsibleParty` (`"VENDOR" | "DELIVERER" | "BUYER" | "REJECTED"`) — `"DELIVERER"` withholds that handoff's payout; everything else releases normally through the 24h-window cron.

## Not built as separate UI (deliberately reused)

Vendor no-show / late, deliverer no-show / late, and delivery-window-expiry alerting are all visible through the existing `Order`/`OrderEvent`/dispute machinery (an admin can see stalled fulfillment/delivery states in the bookings list and the existing Disputes/Events tabs) rather than a dedicated new alert feed — see the "Remaining" section of `docs/marketplace/todo/phase-vendor-00-overview.md` for what's explicitly deferred versus what's covered by existing generic tooling.
