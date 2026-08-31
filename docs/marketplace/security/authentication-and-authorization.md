# Security: Authentication & Authorization

## Authentication

- **Provider**: NextAuth (`src/lib/auth.ts`), two methods:
  - **Credentials**: email + bcrypt-hashed password, checked against `User.password`.
  - **Google OAuth**: auto-creates a `User` row on first sign-in (empty `password`, meaning that account can only sign in via Google unless a password is set some other way — no such "set a password" flow was found for Google-created accounts; **Undocumented / requires clarification**).
- **Session strategy**: JWT (no `Session` table), 30-day `maxAge`. The `jwt` callback re-reads the user's current `id`/`email`/`name`/`firstName`/`role` from the database **only on the initial sign-in call**, not on every request — so a role change made directly in the database doesn't affect an already-issued session until it's re-issued. This is a documented, intentional trade-off (see the comment in `src/lib/auth.ts`), not an oversight — but it means role changes for Marketplace purposes (were a Marketplace-specific role ever added) wouldn't take effect immediately either.
- **Edge gate**: `src/proxy.ts` runs on every request (Edge runtime, can't use Prisma). It decodes the session JWT via `getToken()` and either lets the request through, 401s an unauthenticated `/api/*` call, or redirects an unauthenticated page request to `/login` with a `callbackUrl`.
- **Why every Marketplace route re-checks `getServerSession()` itself**: `proxy.ts` only verifies the JWT is present and valid — it doesn't (can't, on the Edge runtime) look anything up in the database. Every Marketplace route handler calls `getServerSession(authOptions)` again, in the Node runtime, to actually get `session.user.id` for scoping queries. This is deliberate, not redundant: proxy is the gate, routes are where the actual per-user data scoping happens.

## Authorization model

There is **no Marketplace-specific role**. Authorization is entirely **ownership-based**:

- **Business/product/order management** — a request can only read/write a business (and everything under it: products, orders) if `Business.userId === session.user.id`. Enforced centrally by `services/marketplace/business/business-ownership.service.ts#requireOwnedBusiness`, reused verbatim by every owner-scoped route (`businesses/[id]`, `businesses/[id]/products`, `businesses/[id]/orders`). This is the single most important security primitive in the Marketplace — any new owner-scoped route should reuse this function rather than reimplementing the check.
- **Cart** — every route scopes by `userId: session.user.id`; mutation routes (`PATCH`/`DELETE` on `/cart/[itemId]`) additionally re-verify `findFirst({ id, userId })` before acting, so an `itemId` belonging to another user 404s instead of leaking existence or being mutable.
- **Checkout/orders** — `createOrdersForCheckout`/`confirmPaymentByReference` operate on `session.user.id`'s own cart; nothing here is cross-user by design.
- **Public browse endpoints** (`GET /products/[id]`, `GET /search/products`, `GET /businesses/featured`) still require *sign-in* (a session must exist) but are deliberately **not** owner-scoped, since they're meant to show any user any listed product/business.

**Now used across the whole admin surface**: `src/lib/admin.ts#requireAdmin` gates deliverer-application approval/rejection/suspension, delivery-coordinator assignment, and the full Admin Dashboard (user promotion, business verification/blocking, dispute resolution, report review) — requiring `session.user.role` to be `"super_admin"` specifically; `role: "admin"` alone is **not** sufficient (narrowed from accepting either role — see [`../../admin/decisions/admin-access-level.md`](../../admin/decisions/admin-access-level.md)). Outside `requireAdmin`'s callers, the platform's `Role` enum still plays no role in Marketplace authorization — there is no "admin can see all businesses' orders" or similar broad override. Full admin authorization documentation: [`docs/admin/security/authorization.md`](../../admin/security/authorization.md).

**Deliverer authorization**: `services/marketplace/deliverer/deliverer.service.ts#requireApprovedDeliverer` gates every deliverer-only action route (pickup OTP confirmation, out-for-delivery, delivery confirmation, failed-attempt reporting), requiring the signed-in user's `Deliverer` row to exist with `status = APPROVED`. `PENDING`/`REJECTED`/`SUSPENDED` are all refused identically (403) — there's no partial access for a not-yet-approved applicant.

**Cron authorization**: `/api/cron/*` routes have no session at all — Vercel Cron calls them directly. `src/lib/cron-auth.ts#requireCronSecret` checks `Authorization: Bearer $CRON_SECRET` against the `CRON_SECRET` env var, and — importantly — **fails closed**: if `CRON_SECRET` isn't configured, the route 500s rather than allowing the request through unauthenticated. `/api/cron` is in `proxy.ts`'s `PUBLIC_API_PREFIXES` so these requests reach the route handler at all (no session cookie to check at the edge).

## Input validation

Every route parses `request.json()` inside a `try/catch` and returns 400 on invalid JSON before touching any field. Required-field checks (`name`/`industry`/`description`/`price`/`stock`/etc.) are explicit `if (!x) return 400` checks per route rather than a shared schema-validation library (no Zod/Yup usage found in the Marketplace routes) — meaning validation logic can drift between routes if not kept consistent by convention. Numeric fields are validated with `Number.isFinite` after `Number()`/`Math.trunc()` coercion.

## Database-level validation

Prisma foreign keys (`onDelete: Cascade` on `Business.orders`, `Product.orderItems`, etc.) — no additional database-level constraints (e.g. CHECK constraints) beyond what Prisma/MySQL provide by default.

## Payment security

- **Paystack webhook verification**: `src/app/api/webhooks/paystack/route.ts` computes an HMAC-SHA512 of the raw request body using the Paystack secret key and compares it to the `x-paystack-signature` header with `crypto.timingSafeEqual` (constant-time comparison, guarding against timing attacks) — a request with a missing or mismatched signature is rejected with 401 before the body is ever parsed as JSON for business logic. Buffer-length mismatch (a garbage/wrong-length header) is checked before calling `timingSafeEqual`, since that function throws on differing lengths rather than returning false.
- **Never trust the client-side popup alone**: the checkout page's own `verify` call re-verifies the transaction against Paystack's own `/transaction/verify/:reference` API server-side (`src/lib/external/paystack.ts#verifyTransaction`) rather than trusting whatever the Paystack Inline JS popup reports client-side.
- **Idempotency**: `confirmPaymentByReference` only updates orders still `paymentStatus: "pending"` for a given reference — re-running it (webhook + client verify both firing, or a retried webhook) is a safe no-op the second time. This is the Marketplace's only implemented idempotency mechanism; there is no idempotency key mechanism for any other write route (e.g. nothing stops two rapid double-clicks of "add to cart" from being handled as two independent requests — though the merge-on-same-product-and-variants logic happens to make that outcome harmless here).
- **Secret key separation**: `getPaystackSecretKey()` uses the *test* key everywhere except `NODE_ENV === "production"`, specifically so local development can never accidentally call Paystack's live API. Only `NEXT_PUBLIC_PAYSTACK_KEY` (the publishable key) is exposed to the browser; nothing server-secret leaks client-side.

## OTP security

Both OTP flows (seller→deliverer pickup, buyer delivery confirmation) are now implemented — see [`otp-security.md`](otp-security.md) for the dedicated write-up.

## Ownership checks summary

| Resource | Ownership check |
|---|---|
| Business (read/edit) | `Business.userId === session.user.id`, via `requireOwnedBusiness` or direct query |
| Product (create/list under a business) | via the parent business's `requireOwnedBusiness` |
| Order (list under a business) | via the parent business's `requireOwnedBusiness` |
| Cart item | `CartItem.userId === session.user.id` |
| Product/business browse | none — intentionally public to any signed-in user |

## Admin approval / deliverer authorization

Implemented — see [`../systems/deliverer-system.md`](../systems/deliverer-system.md) and [`../systems/admin-system.md`](../systems/admin-system.md).

## Rate limiting

None implemented anywhere in the Marketplace (or, as far as this pass found, anywhere in the app). Worth noting particularly for `checkout/verify` (calls out to Paystack per request), `paystack/resolve-account` (external API call, user-triggerable), and the OTP-verification routes (bounded per-OTP by attempt count, but not rate-limited at the route level). See [`gaps.md`](gaps.md).

## Sensitive data handling

- Paystack secret keys and the Cloudinary API secret are read from `process.env` server-side only; never imported into a client component (enforced by convention/comments, not by a build-time guard).
- Passwords are bcrypt-hashed (`bcryptjs`) before storage; never returned in any API response payload (routes explicitly `select` only the fields they need).
- Bank account details (`bankName`, `accountNumber`, `accountHolderName`) are stored in plaintext on `Business` — no field-level encryption. Given `accountNumber` alone is not sufficient to move money without also controlling the matching bank login, this is a lower-severity concern than it would be for a full card/PAN, but is still worth flagging — see [`gaps.md`](gaps.md).
