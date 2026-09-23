# System: Cart

## Purpose

Holds a signed-in user's in-progress product selections (across any number of businesses) prior to checkout.

## Responsibilities

- Add/update-quantity/remove cart lines.
- Prevent quantity from exceeding current product stock.
- Merge duplicate add-to-cart calls (same product + same selected variants) into one line's quantity instead of duplicate rows.
- Provide the single source of truth the navbar badge, `CartDrawer`, and checkout page all read.

## Actors

Buyer only.

## Data

`CartItem`: `userId`, `productId`, `quantity` (default 1), `selectedVariants` (JSON string, normalized by sorting keys before storage so equivalent variant selections compare equal), `variantId` (nullable FK to `ProductVariant` — present in the schema but **not populated** by the cart POST route, which only ever stores `selectedVariants` as a JSON string; consistent with variants being attribute-only today, see [`product-system.md`](product-system.md)).

## Inputs

`productId`, `quantity`, optional `selectedVariants` (add); `quantity` (update).

## Outputs

`CartLineItem[]` — flattened shape combining the cart row with the product's current name/price/stock/image/seller name (**live** product data, not a snapshot — a cart line always reflects the product's current price, unlike an `OrderItem` after checkout; see [`../data/price-snapshots.md`](../data/price-snapshots.md)).

## Database

`CartItem`, joined to `Product`/`Business` for display fields.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/cart` | GET | Current user's cart |
| `/api/marketplace/cart` | POST | Add a product (merges into an existing matching line) |
| `/api/marketplace/cart/[itemId]` | PATCH | Update quantity |
| `/api/marketplace/cart/[itemId]` | DELETE | Remove a line |

## Services

None external.

## Functions

- `services/marketplace/cart/cart.service.ts#getCartForUser` / `#toCartLineItem` — the single query+shape used by every cart route so they can never drift from each other.

## Components / Hooks

- `_components/useCart.ts` — the one hook every page that needs cart data uses (`marketplace/page.tsx`, `explore/page.tsx`, `checkout/page.tsx`); the navbar badge and `CartDrawer` read/mutate through it. `CartDrawer` itself takes items/handlers as props rather than fetching independently, specifically so the drawer and the page that opened it never show different data.

## Authentication

All routes require a session.

## Authorization

Every route scopes by `userId: session.user.id` — a user can only ever see/mutate their own cart items; `PATCH`/`DELETE` additionally re-check `findFirst({ id: itemId, userId })` before acting, so a stolen/guessed `itemId` belonging to another user 404s rather than leaking or mutating it.

## State transitions

None (no status field). A cart line's lifecycle ends either by explicit removal or implicitly at successful checkout (see below).

## Error handling

401 if not signed in, 404 if the product or cart item doesn't exist / isn't the caller's, 400 for a non-numeric or sub-1 quantity update.

## Edge cases

- Adding a product already in the cart with the *same* variant selection increments quantity (clamped to current stock) rather than creating a duplicate row; a *different* variant selection creates a new line.
- Quantity is always clamped to `Math.min(product.stock, quantity)` on both add and update — the cart can never hold more than current stock, but this is a soft clamp at cart-mutation time, not a hold/reservation (stock can still be sold out from under a cart line by another buyer's checkout before this one pays — see [`../security/gaps.md`](../security/gaps.md)).
- On successful payment, `confirmPaymentByReference` deletes **all** of the paying user's cart items (not just the ones that were checked out) — see [`checkout-and-payment-system.md`](checkout-and-payment-system.md) and the note in [`../decisions/cart-cleared-on-payment.md`](../decisions/cart-cleared-on-payment.md) about why that's safe given the current checkout flow.

## Notifications

None.

## Cron jobs

None (no cart-abandonment/expiry job exists).

## Dependencies

Depends on: [`product-system.md`](product-system.md) (price/stock/name/image come from `Product`).
Depended on by: [`checkout-and-payment-system.md`](checkout-and-payment-system.md) (checkout reads the cart, splits it into orders, then clears it).

## Usage

`CartDrawer` (opened from the navbar), the checkout page, and the cart-count badge.

## Relevant files

- `prisma/schema.prisma` — `CartItem`
- `services/marketplace/cart/cart.service.ts`, `src/types/cart.ts`
- `src/app/api/marketplace/cart/route.ts`, `cart/[itemId]/route.ts`
- `src/app/studashboard/marketplace/_components/useCart.ts`, `CartDrawer.tsx`
