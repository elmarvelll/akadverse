# System: School Vendor (seller side)

## Purpose

A School Vendor is a structurally independent seller experience — its own dashboard route tree, its own API route tree, its own service layer — that shares the underlying `Product`/`ProductVariant`/`Order`/`OrderItem` data models and genuinely generic helpers with the Business Marketplace, but is never implemented as a conditional state inside Business's pages or APIs. See [`../decisions/vendor-independent-architecture.md`](../decisions/vendor-independent-architecture.md) for the correction from the earlier "extend Business, share dashboard" build, and [`../data/vendor-schema.md`](../data/vendor-schema.md) for the full schema shape. Vendors sell food/drinks/snacks, operate a fixed 5-8PM window, offer universal `Side` add-ons alongside Products/variants, and are delivered through the Vendor Delivery operation (see [`vendor-delivery-system.md`](./vendor-delivery-system.md)) rather than handling their own delivery — but the vendor's own location is where a deliverer collects the order from; there is no central vendor drop-off point.

## Application → approval

```text
Footer "Become a Vendor" -> /studashboard/marketplace/vendor/apply
  -> POST /api/marketplace/vendor/apply
     (services/marketplace/vendor/create-vendor-application.ts)
  -> Business row created, type=SCHOOL_VENDOR, approvalStatus=PENDING_APPROVAL
     bank account holder name resolved server-side via the existing
     Paystack resolve-account flow — never trusted from the client
  -> Admin reviews on the existing Businesses tab (type filter added,
     approval action reused unchanged — services/marketplace/admin/{approve,reject}-business.ts)
  -> Approved: storefront becomes publicly visible, owner lands on
     /studashboard/marketplace/vendor-dashboard/[id] — never business/[id]
```

## Independent dashboard and API surface

- Owner dashboard: `src/app/studashboard/marketplace/vendor-dashboard/[id]/{page.tsx (profile+capacity), products/, sides/, orders/}` — its own `layout.tsx`, approval-gate, and sidebar, structurally mirroring Business's shape but never sharing component instances with it.
- Owner API: `src/app/api/marketplace/vendor/[id]/{profile,capacity,products,orders}/*`, backed by `services/marketplace/vendor/*` — every route resolves ownership via `requireOwnedVendor` (Business + `type === "SCHOOL_VENDOR"`, never a frontend-supplied id taken on trust). Business's own `businesses/[id]/products/*` routes/controllers are untouched and carry no vendor branching.
- Where functionality is genuinely generic — product/variant/image field parsing (`services/marketplace/product/shared/*`), `ProductForm`/`ImageUploadField`/variant UI — the Vendor service layer calls it directly rather than duplicating it. Multi-image upload is unchanged for vendor products.
- `MyTradeDropdown` and the vendor-approval success path route an approved vendor to `vendor-dashboard/[id]`; an approved Business still routes to `business/[id]`. `list-user-businesses.ts`/`get-business-detail.ts` filter by `type` so a vendor can never reach the Business dashboard/API (or vice versa) by an id alone.

## Self-service pause vs admin suspension

- `Business.paused` (+ `pausedAt`/`pausedReason`) — the vendor's own toggle, reversible by the vendor at any time (`services/marketplace/vendor/pause-vendor.ts`).
- `Business.approvalStatus = SUSPENDED` / `Business.blocked` — admin-only enforcement, unchanged from the existing Business machinery. Only an admin can lift these.

A paused OR suspended/blocked vendor cannot receive new bookings — enforced server-side at every write path that creates a vendor `Order`/`OrderItem`/cart line (`add-to-vendor-cart.ts`, `create-vendor-orders-for-checkout.ts`), never only in the UI.

## Vendor order-fulfillment capacity ("Set Product Deliveries Per Time Range")

A vendor configures, per `VendorDeliverySlot`, the maximum number of customer orders it can fulfil in that timeframe — `VendorTimeframeCapacity` (`businessId, slotId, capacity`), managed at `services/marketplace/vendor/capacity/manage-vendor-capacity.ts` and shown on the vendor's own dashboard (never on the Business profile — Business has no delivery-capacity setting at all). This is a completely separate system from the admin's deliverer-roster capacity (`VendorDeliverySlot.delivererCapacity` / `DelivererRosterAssignment`, see [`vendor-delivery-system.md`](./vendor-delivery-system.md)) — one controls how many customer orders a vendor accepts, the other controls how many deliverer positions exist for a timeframe, and neither ever gates the other. Enforcement is transactional, inside the checkout booking transaction only — see that doc's "Booking → payment → transactional commit" section. Capacity is never reserved just by adding to cart; only a successful payment/order-creation consumes it.

## Vendor does not accept or reject orders

Flow: Customer checks out → payment confirmed → order auto-accepted (`PENDING_SELLER → ACCEPTED` at payment confirmation, not at booking) → vendor's Orders page shows it. There is no manual accept/reject control anywhere in the Vendor dashboard — the vendor's only action is marking an order `READY_FOR_PICKUP` once prepared (`services/marketplace/vendor/order/mark-vendor-order-ready.ts`). Business's own accept/reject flow is untouched and is not shared with Vendor.

## Storefront, products, sides

- Public storefront: `GET /api/marketplace/vendor/[id]` (`services/marketplace/vendor/get-vendor-storefront.ts`) — 404s for a non-approved/non-vendor business, same "not found, not forbidden" convention as Business products.
- Products/variants: `services/marketplace/vendor/product/vendor-product.service.ts` — a thin, vendor-owned wrapper (`requireOwnedVendor` then delegate) around the existing generic product services, reached only via `/api/marketplace/vendor/[id]/products/*`, never Business's product routes.
- Sides: `services/marketplace/vendor/side/side.service.ts`, `/api/marketplace/vendor/[id]/sides/*`, universal per vendor, never tied to one product. `Side.serviceFeeExempt` defaults `true`. Lives at `vendor-dashboard/[id]/sides` — it was always vendor-only and never belongs on a Business page.
- Homepage + Explore both show "Popular Vendor Items" (`get-popular-vendor-items.ts`) and "School Vendors" (`get-featured-vendors.ts`) — the exact same two queries/components in both places, not divergent implementations.
- The shared `ProductDetailModal` renders a vendor product with independent quantity steppers per variant (and per side) — not a single-select radio, satisfying "Small×2, Large×1" — and swaps its CTA to "Add to Vendor Cart".

## Data-driven service-fee exemption

`Product.serviceFeeExempt` / `Side.serviceFeeExempt` — never a hardcoded product-name check. See [`vendor-delivery-system.md`](./vendor-delivery-system.md) for the fee calculation itself.

## Cart: one drawer, Business | Vendors tabs — never merged

`MarketplaceCartDrawer.tsx` is the single cart drawer rendered on Homepage, Explore, and every vendor storefront page — an animated underline tab bar (`Business` | `Vendors`, framer-motion `layoutId`) switches between the two cart bodies, each still backed by its own hook (`useCart.ts` / `useVendorCart.ts`) and its own checkout destination ("Checkout" vs "Book an Order"). The navbar's cart badge shows the combined count across both, but the carts and their backing data never merge: a Vendor cart may span multiple vendors, and the backend keeps each vendor's resulting `Order`/`OrderItems`/inventory/capacity changes logically separate per business (see [`vendor-delivery-system.md`](./vendor-delivery-system.md)). Opening the drawer defaults to whichever cart actually has items (computed once per mount of the inner panel component, not via a ref/effect, since this project's `react-hooks/refs` lint rule disallows reading/writing a ref during render).

## Boundary: a vendor's items never reach the Business cart/checkout

`services/marketplace/cart/add-to-cart.ts` and `create-orders-for-checkout.ts` both explicitly reject a `SCHOOL_VENDOR` product, and `get-cart-for-user.ts` filters vendor items out of the Business cart read — defense in depth even though the only client-reachable path to a vendor product currently goes through the Vendor cart UI.
