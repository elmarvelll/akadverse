# System: Business

## Purpose

Lets a signed-in student create and manage a "Business" — a seller storefront that owns products and (eventually) orders. This is the seller-side entry point to the whole Marketplace.

## Responsibilities

- Business creation (onboarding form).
- Business profile read + edit.
- Listing a user's own businesses (for the navbar's "My Businesses" switcher).
- Surfacing "top"/featured businesses on the marketplace homepage.
- Deriving basic dashboard stats (revenue, profit, order count, product count) from real `Order`/`OrderItem` data.

## Actors

- **Business owner** (any `User`) — creates/edits their own business(es).
- **Buyer** (any `User`) — sees other users' businesses only via the featured list and via a product's `sellerName`; there is no public single-business storefront page for buyers to browse (confirm before assuming one exists — none was found under `studashboard/marketplace/`).

## Data

`Business` (see `prisma/schema.prisma`): `name`, `industry` (free-text, same convention as `Product.category`), `description`, optional `contactInfo`, `paymentMethod`/`bankName`/`accountNumber`/`accountHolderName`/`paystackRecipientCode` (banking — nullable, filled in later from the dashboard, not the onboarding form), `location`, `serviceDays`/`serviceTimes` (free-text strings — **not** used as structured "delivery days"; not collected by the onboarding form at all today, see [`../decisions/business-onboarding-fields.md`](../decisions/business-onboarding-fields.md)), `instagram`/`linkedin`/`website`, `public_id`/`secure_url` (Cloudinary logo), `visitors` (counter, default 0 — no code increments it; **Undocumented / requires clarification** whether view tracking is planned or dead).

## Inputs

- Onboarding form (`business/create/page.tsx`): name, industry, description, contact info, optional logo upload.
- Dashboard edit form: same fields plus bank details (via the Paystack bank dropdown + account-resolution flow).

## Outputs

- `BusinessSummary` (id/name/industry/logo) for listings.
- `BusinessDetail` (full profile + `BusinessStats`) for the dashboard.

## Database

`Business`, plus reads into `Product` (count) and `Order`/`OrderItem` (for stats).

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/businesses` | GET | Current user's own businesses |
| `/api/marketplace/businesses` | POST | Create a business |
| `/api/marketplace/businesses/featured` | GET | Top businesses (by product count) for the homepage, across all users |
| `/api/marketplace/businesses/[id]` | GET | One business's profile + stats — owner-only |
| `/api/marketplace/businesses/[id]` | PATCH | Edit a business's profile — owner-only |
| `/api/marketplace/uploads` | POST | Cloudinary logo upload (shared with product images) |
| `/api/marketplace/paystack/banks` | GET | Bank list for the bank-details dropdown |
| `/api/marketplace/paystack/resolve-account` | GET | Resolves account number → account holder name |

## Services

- `services/marketplace/business/business-ownership.service.ts#requireOwnedBusiness` — the shared "does this business belong to the signed-in user" guard, used by every owner-scoped business/product/order route.
- `src/lib/external/cloudinary.ts#uploadImage`
- `src/lib/external/paystack.ts#listBanks`, `#resolveAccountNumber`

## Functions

- `requireOwnedBusiness(businessId)` — returns either `{ session, businessId }` or a ready-to-return 401/404 `NextResponse`. Used verbatim by the products and orders routes so ownership is enforced identically everywhere.
- `loadOwnedBusiness` (inline in `businesses/[id]/route.ts`) — loads a business plus enough of `products`/`orders`/`items` to compute stats in one query.

## Components

- `business/create/page.tsx` — onboarding form.
- `business/[id]/page.tsx` — dashboard home (profile + stats).
- `business/[id]/layout.tsx`, `business/_components/BusinessSidebar.tsx` — dashboard shell/nav.
- `business/_components/BankDetailsFields.tsx` — bank dropdown + account resolution UI (bank *code* stays in this component's local state only — it is never persisted; see the comment on `BusinessFormValues` in `src/types/business.ts`).
- `business/_components/ImageUploadField.tsx` — shared logo/product-image uploader.
- `_components/MarketplaceNavbar.tsx` (My Businesses dropdown), `_components/Hero.tsx`/homepage sections (featured businesses).

## Hooks

None dedicated — the dashboard pages fetch directly via `src/lib/axios.ts`.

## Authentication

All routes require a valid NextAuth session (`getServerSession`); `/api/marketplace/businesses/featured` also requires sign-in even though the data itself isn't owner-scoped (see [`../security/authentication-and-authorization.md`](../security/authentication-and-authorization.md) for why this is arguably too strict for a "browse" endpoint).

## Authorization

Only the business's `userId` can GET (profile detail)/PATCH it, or list/create its products/orders — enforced via `requireOwnedBusiness` / a direct `userId` match in `loadOwnedBusiness`. `GET /businesses` (list) is implicitly scoped by filtering `where: { userId: session.user.id }`. `GET /businesses/featured` is intentionally cross-user (shows everyone's businesses).

## State transitions

None — a `Business` has no status field/lifecycle beyond existing.

## Error handling

401 if not signed in, 404 if the business doesn't exist or isn't owned by the caller, 400 for missing required fields (`name`/`industry`/`description`) on create/edit.

## Edge cases

- A business with banking fields left blank can still be created and list products — banking is only actually required once payouts exist (not implemented yet).
- `paystackRecipientCode` is stored on the schema but **no route sets it** — the recipient-code creation call to Paystack (needed to eventually pay a seller out) is not implemented. See [`../todo/phase-05-escrow-and-payments.md`](../todo/phase-05-escrow-and-payments.md).

## Notifications

None triggered by this system.

## Cron jobs

None.

## Dependencies

Depends on: authentication (NextAuth), Cloudinary, Paystack (bank list/resolution only, not payments here).
Depended on by: [`product-system.md`](product-system.md) (products belong to a business), [`order-system.md`](order-system.md) (orders are scoped to a business), the checkout/cart systems (a cart item's `businessId` is used to split checkout into one order per business).

## Usage

Business creation/edit/listing happens entirely inside `studashboard/marketplace/business/**`. The `businessId` a product/order is scoped to flows from here into every other Marketplace system.

## Relevant files

- `prisma/schema.prisma` — `Business` model
- `services/marketplace/business/business-ownership.service.ts`
- `src/types/business.ts`
- `src/app/api/marketplace/businesses/route.ts`, `businesses/[id]/route.ts`, `businesses/featured/route.ts`
- `src/app/studashboard/marketplace/business/**`
