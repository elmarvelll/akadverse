# System: Product

## Purpose

Lets a business owner list, price, and stock products, with optional attribute-style variants (e.g. Color/Size), and lets any signed-in user browse/search them and view detail.

## Responsibilities

- Product creation under a business.
- Product listing for the owning dashboard.
- Public product detail lookup (any signed-in user, not owner-scoped).
- Cross-business search/filter by text query and up to 4 categories.
- Providing the `price`/`stock` values the cart and checkout read.

## Actors

- **Business owner** — creates products under their own business.
- **Buyer** — browses/searches/views product detail, adds to cart.

## Data

`Product`: `name`, `category` (free-text, reuses `services/marketplace/shared/categories.ts`'s display names — **not** a foreign key to the separate `Category` model, which exists in the schema but has no API and isn't used by product creation), `description`, `price` (Float), `cost` (Float, defaults to 0 — optional in the create form; profit equals revenue until a real cost is set), `image`/`public_id`/`secure_url`, `stock` (Int, default 0), `rating`/`ratingCount` (defaults 0/0 — **no code path writes these**; there is no review-submission flow found for products, see `Review` model's note in [`../data/schema.md`](../data/schema.md)), `businessId`.

Variants: `VariantField` (name, e.g. "Color") → `VariantValue` (e.g. "Red"/"Blue"), plus `ProductVariant`/`VariantValueOnProductVariant` tables that exist in the schema for per-combination pricing/stock but are **not populated by the create-product flow** — see [`../decisions/attribute-only-variants.md`](../decisions/attribute-only-variants.md).

## Inputs

- Create-product form: name, category, description, price, stock, optional cost, optional image, optional variant fields/values.
- Search/filter query params: `q`, `categories` (comma-separated category ids, max 4), `limit`.

## Outputs

`ProductSummary`/`ProductDetail` (owner dashboard), `ProductBrowseDetail` (buyer detail modal), `ProductSearchResult` (search/browse list).

## Database

`Product`, `VariantField`, `VariantValue`. Reads `Business` for ownership checks and `sellerName` display.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/businesses/[id]/products` | GET | Owner's product list |
| `/api/marketplace/businesses/[id]/products` | POST | Create a product |
| `/api/marketplace/businesses/[id]/products/[productId]` | GET/PATCH/DELETE | Owner-scoped single-product detail (edit form), update, and delete. Variants are replaced wholesale on PATCH (delete then recreate all `VariantField`/`VariantValue` rows) rather than diffed — deliberately simple, since a product typically has only a handful of attribute rows. |
| `/api/marketplace/products/[id]` | GET | Public product detail (any signed-in user) |
| `/api/marketplace/search/products` | GET | Cross-business search/filter, also powers the homepage's "Popular Products" (called with no `q`/`categories`, just a small `limit`) |

## Services

None external — pure Prisma reads/writes plus the shared `productCategories` list for resolving category ids to names.

## Functions

- `toProductSummary` (in `businesses/[id]/products/route.ts`) — maps a Prisma row (with nested `variantFields.values`) to the flat `ProductSummary` shape the dashboard expects.
- `requireOwnedBusiness` (shared with the business system) gates the owner-scoped routes.

## Components

- `business/_components/ProductForm.tsx`, `VariantOptionsEditor.tsx`, `DashboardProductCard.tsx` — owner-side creation/listing.
- `_components/ProductCard.tsx`, `ProductDetailModal.tsx` — buyer-side browse/detail.
- `_components/FilterDropdown.tsx`, `search-params.ts` — search/filter UI and URL-state handling.
- `business/[id]/products/page.tsx`, `products/create/page.tsx`, `products/[productId]/edit/page.tsx`.

## Hooks

None dedicated.

## Authentication

All routes require a session. `GET /products/[id]` is explicitly **not owner-scoped** (any signed-in student can view any listed product) — see the route's own comment.

## Authorization

Create/list under `businesses/[id]/products` is owner-scoped via `requireOwnedBusiness`. Public detail and search are not owner-scoped by design (buyer-facing).

## State transitions

None — a `Product` has no status/lifecycle field.

## Error handling

400 for missing/invalid required fields (`name`, `category`, `description`, `price`, `stock`; `cost` must parse as a number if provided), 401/404 from the ownership guard on owner-scoped routes, 404 if a looked-up product doesn't exist.

## Edge cases

- `stock` is clamped to `Math.max(0, Math.trunc(stock))` on create — negative/fractional stock is silently corrected, not rejected.
- Category filtering resolves URL-supplied category **ids** to display **names** server-side via `productCategories`, rather than trusting a client-sent string directly, specifically so a client can't search by an arbitrary/spoofed category string.
- Search matches `name` and `description` with SQL `contains` (no full-text index) — fine at current data volume, but has no explicit relevance ranking beyond `orderBy: createdAt desc`.

## Notifications

None triggered by this system.

## Cron jobs

None.

## Dependencies

Depends on: [`business-system.md`](business-system.md) (ownership), Cloudinary (image upload, shared route).
Depended on by: [`cart-system.md`](cart-system.md) (a cart line references a `Product`), [`checkout-and-payment-system.md`](checkout-and-payment-system.md) (order items snapshot `Product.price` at checkout time — see [`../data/price-snapshots.md`](../data/price-snapshots.md)).

## Usage

Product creation/management lives under `business/[id]/products/**`; browsing lives on the marketplace homepage and `explore/page.tsx`.

## Relevant files

- `prisma/schema.prisma` — `Product`, `VariantField`, `VariantValue`, `ProductVariant`, `VariantValueOnProductVariant`
- `src/types/product.ts`, `src/types/marketplace-browse.ts`, `src/types/search.ts`
- `src/app/api/marketplace/businesses/[id]/products/route.ts`, `products/[id]` (public), `search/products/route.ts`
- `services/marketplace/shared/categories.ts`
