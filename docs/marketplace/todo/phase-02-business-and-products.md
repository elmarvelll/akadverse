# Phase 2 — Business & Products

## Objective

Let a student create a storefront and list products on it, and let other students browse them.

## Status: ✅ Mostly done, some scaffolding fields unused

- [x] Business onboarding (create/edit) — `business/create/page.tsx`, `/api/marketplace/businesses`
- [x] Business dashboard: profile, stats (revenue/profit derived from real orders) — `businesses/[id]/route.ts`
- [x] Featured/top businesses on homepage — `/api/marketplace/businesses/featured`
- [x] Product creation with attribute-only variants — `businesses/[id]/products/route.ts`
- [x] Product browse/search/filter across businesses — `/api/marketplace/search/products`
- [x] Public product detail — `/api/marketplace/products/[id]`
- [x] Business banking fields fully wired to a real payout path — `paystackRecipientCode` is now set lazily on first payout (see [`phase-05-escrow-and-payments.md`](phase-05-escrow-and-payments.md)); required reintroducing `Business.bankCode` (see [`../decisions/business-bank-code-reintroduced.md`](../decisions/business-bank-code-reintroduced.md)).
- [x] Delivery days — built as a **new**, separate, structured field (`BusinessDeliveryDay`), exactly as this file previously recommended rather than repurposing `serviceDays`/`serviceTimes`. Those two columns remain free-text, uncollected, and still conceptually distinct — see [`../data/delivery-days.md`](../data/delivery-days.md).
- [ ] Product-level reviews/ratings (`Product.rating`/`ratingCount`, `Review` model) — schema exists, nothing writes to it, no relation back to `User`/`Order` even exists on `Review` yet.
- [ ] `Business.visitors` counter — schema exists, nothing increments it.
- [ ] Per-combination variant pricing/stock (`ProductVariant`/`VariantValueOnProductVariant`) — deliberately deferred, see [`../decisions/attribute-only-variants.md`](../decisions/attribute-only-variants.md); revisit if sellers need it.

## Dependencies

Phase 1.

## Relevant systems

[`../systems/business-system.md`](../systems/business-system.md), [`../systems/product-system.md`](../systems/product-system.md)
