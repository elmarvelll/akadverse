# System: Checkout & Payment

## Purpose

Turns a paid-for cart into real, per-business `Order`/`OrderItem` rows, and confirms payment with Paystack in a way that's correct regardless of which of two possible confirmation paths actually fires first.

## Responsibilities

- Present a checkout summary (items, buyer's saved location, subtotal, flat service fee, total).
- Create `Order`/`OrderItem` rows split one-order-per-business, sharing a single Paystack payment reference.
- Open Paystack's Inline popup with the right amount/reference/email.
- Confirm payment server-side (never trust the popup's own client-side success callback alone).
- Be idempotent: whichever of the webhook or the client-side verify call reaches the server first "wins"; the other is a safe no-op.
- Clear the buyer's cart once payment is confirmed.

## Actors

Buyer (initiates and pays); Paystack (calls back via webhook — the only non-human actor in the Marketplace).

## Data

Reads: `CartItem` rows, `User.location`, `User.email`.
Writes: `Order` (+ `OrderItem` per line) on initialize; `Order.paymentStatus`/`Order.status` on confirm; deletes `CartItem` rows on confirm.

## Inputs

- `POST /checkout/initialize { location }` — buyer-editable delivery location string.
- `POST /checkout/verify { reference }` — the Paystack reference returned by initialize.
- Paystack webhook body (`event`, `data.reference`) + `x-paystack-signature` header.

## Outputs

- `CheckoutSummary` (GET summary).
- `{ reference, amountKobo, email }` (POST initialize) — `amountKobo` is the total converted to Paystack's base unit (`Math.round(totalAmount * 100)`).
- `{ status: "success", confirmedOrderIds }` (POST verify).
- `{ received: true }` (webhook — Paystack only needs a 200).

## Database

`Order`, `OrderItem`, `CartItem` (read then bulk-deleted), `User` (location/email only).

## API

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/marketplace/checkout/summary` | GET | session | Read-only cart preview; creates nothing |
| `/api/marketplace/checkout/initialize` | POST | session | Creates the real `Order`/`OrderItem` rows |
| `/api/marketplace/checkout/verify` | POST | session | Buyer-triggered payment confirmation |
| `/api/webhooks/paystack` | POST | Paystack HMAC signature (no session — deliberately under `/api/webhooks/`, not `/api/marketplace/`, so it matches `src/proxy.ts`'s `PUBLIC_API_PREFIXES` as a clean prefix) | Paystack-triggered payment confirmation |

## Services

- `src/lib/external/paystack.ts#verifyTransaction` — calls Paystack's `/transaction/verify/:reference`.
- `src/src/lib/external/cloudinary.ts` — not involved here.

## Functions

All in `services/marketplace/checkout/checkout.service.ts`:

- **`getCheckoutSummary(userId)`** — builds the read-only preview. Business rule: `serviceFee` is currently a flat constant `SERVICE_FEE = 0`, kept as a named export specifically because it's expected to change (see [`../decisions/flat-zero-service-fee.md`](../decisions/flat-zero-service-fee.md)).
- **`createOrdersForCheckout(userId, location)`** — groups the cart by `businessId` and creates one `Order` per business inside a single `prisma.$transaction`, all sharing one generated reference (`AKD-${timestamp}-${8 random hex chars}`). Why one reference across multiple orders: a checkout can span several businesses' products but pays for all of them in a single Paystack transaction, so `Order.paystackReference` is deliberately **not** `@unique` (see the schema comment). Throws `EmptyCartError` if the cart is empty — the initialize route catches this specifically and returns 400 rather than a generic 500.
- **`confirmPaymentByReference(reference)`** — the shared confirmation path called by both `checkout/verify` and the webhook. Looks up all orders with that reference still `paymentStatus: "pending"`; if none, returns `{ confirmedOrderIds: [] }` (this is what makes it idempotent — a second call after an order is already `paid` finds nothing to update). Otherwise bulk-updates them to `paymentStatus: "paid"`, `status: "processing"`, then deletes **all** of the paying user's cart items (safe because the cart was fully snapshotted into these orders at initialize time, so what's left in the cart at confirm time is exactly what was just paid for — assuming no additions to the cart happened in the payment gap; see edge cases).

## Components

- `checkout/page.tsx` — the checkout page itself.
- `checkout/_components/loadPaystackScript.ts` — loads Paystack's Inline JS.

## Hooks

Reuses `_components/useCart.ts` for the pre-checkout cart view.

## Authentication

`summary`/`initialize`/`verify` all require a NextAuth session. The webhook explicitly has **no session** — it authenticates itself via HMAC-SHA512 signature verification against the raw request body, using the same secret key selection (`getPaystackSecretKey()`) the rest of the Paystack integration uses.

## Authorization

Implicit: a buyer can only checkout/verify against their own session's cart/user id. The webhook isn't user-scoped by session — it trusts whatever `reference` Paystack reports, which is safe because `confirmPaymentByReference` only ever touches orders matching that exact reference.

## State transitions

```text
Order.status:        "pending" ──(payment confirmed)──> "processing"
Order.paymentStatus: "pending" ──(payment confirmed)──> "paid"
```

No further status transitions exist anywhere in the codebase — see [`order-system.md`](order-system.md) for what a full seller-accept/fulfillment/delivery flow would need to add.

## Error handling

- `initialize`: 401 unauthenticated, 400 empty cart (`EmptyCartError`), otherwise the error propagates (uncaught → framework 500).
- `verify`: 401 unauthenticated, 400 invalid JSON body, 400 missing `reference`, 502 if Paystack's verify call itself fails/throws, 402 if Paystack reports a non-`success` status.
- webhook: 401 on an invalid/missing signature. Any other error inside the handler is uncaught (propagates to a 500 — Paystack will retry on non-2xx per its own retry policy, which is what makes not silently swallowing errors here safe).

## Edge cases

- **Webhook unreachable in local dev**: documented directly in the webhook route's own header comment — Paystack cannot reach `localhost` without a tunnel (e.g. ngrok), so in local development the client-triggered `verify` call is what actually confirms payment; the webhook only becomes load-bearing once the app has a public URL.
- **Double-confirmation race**: if both the client verify call and the webhook fire close together, whichever's `prisma.order.findMany({ paymentStatus: "pending" })` runs first updates the rows; the second sees nothing pending and safely no-ops. There is no explicit row locking beyond relying on this pending-status check — acceptable at current scale, worth revisiting if checkout volume grows (see [`../security/gaps.md`](../security/gaps.md)).
- **Cart added-to during payment gap**: if a buyer adds something new to their cart *after* clicking "pay" but *before* payment confirms, `confirmPaymentByReference` will delete that newly-added item too, since it clears the entire cart rather than only the items that were part of this checkout. Not currently guarded against.
- **Stock isn't decremented on order creation or payment confirmation** — `Product.stock` is never written to by any code path in this system. A sold-out product can still be checked out. See [`../security/gaps.md`](../security/gaps.md) and [`../todo/phase-03-orders.md`](../todo/phase-03-orders.md).

## Notifications

None — no email/in-app notification is sent to the buyer or any business owner when an order is created or paid.

## Cron jobs

None.

## Dependencies

Depends on: [`cart-system.md`](cart-system.md), [`product-system.md`](product-system.md) (price snapshot at order-item creation time — see [`../data/price-snapshots.md`](../data/price-snapshots.md)), Paystack.
Depended on by: [`order-system.md`](order-system.md) (this is where an `Order` first comes into existence).

## Usage

The only place `Order`/`OrderItem` rows are ever created in the entire codebase.

## Relevant files

- `services/marketplace/checkout/checkout.service.ts`
- `src/app/api/marketplace/checkout/{summary,initialize,verify}/route.ts`
- `src/app/api/webhooks/paystack/route.ts`
- `src/lib/external/paystack.ts`
- `src/types/checkout.ts`
