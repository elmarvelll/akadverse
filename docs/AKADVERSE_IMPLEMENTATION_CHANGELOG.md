# AkadVerse — Implementation Changelog (Marketplace reliability, payments, delivery, email, navigation, E-Learning)

> Status: **implementation complete in the working tree; nothing committed, pushed, or applied to any remote
> database.** Written during the work (audit first, then phase by phase) and reconciled against the final code on
> 2026-10-13.

Branch: `staging` (working tree was clean at start, HEAD `b9e7e15`).

How to read this: section B is the audit as it stood before any change; C–G describe what was built; H is what was
actually run and what it showed; I and J are what you still have to do and what is not proven; K maps every
requirement to its status.

---

## A. Executive summary

The work fixes how the Marketplace takes money and manages stock, and adds the delivery, navigation, and E-Learning
features requested.

- **Payments and inventory (both checkouts).** A checkout is now an explicit *payment attempt* (`CheckoutPayment`,
  one row per Paystack reference). Stock and vendor delivery capacity are *reserved* at initialize and released
  exactly once if the payment is cancelled, fails, or expires. An order only becomes a real, visible order after the
  server has verified the payment with Paystack and the reference, amount, and currency match. One shared code path
  serves the Business and the School Vendor checkout, the browser callback, the webhook, and a reconciler; repeated
  or concurrent calls cannot create a second order, a second stock deduction, or a second notification.
- **The verify 502.** Every upstream problem used to be reported as 502. The likely production cause — the server
  verifying with the live key while the browser paid with the test key — is removed structurally: the server now
  chooses one mode and hands the matching publishable key to the browser. Verification has timeouts, typed errors,
  and specific status codes, and never changes payment state when the outcome is unknown.
- **Email and notifications.** A small outbox table gives the paid-order email and the new business-blocked email
  exactly-once sending with retry. Approval notifications now link School Vendors to the vendor dashboard instead of
  a page that says the business doesn't exist. A business block is now enforced on the server, not only shown in the
  admin UI.
- **Delivery.** Vendors can set recurring delivery weekdays, close or add individual dates, and see paid vs.
  awaiting-payment bookings per date; customers are only offered dates that can actually be booked. Sellers get a
  prominent drop-off panel. Vendor orders list newest first. The navbar no longer covers "Back to Marketplace".
- **E-Learning.** Weeks with several documents get a dropdown in the Study Zone, and the lecturer upload form no
  longer nudges every upload back to Week 1. Stewart, previously a canned mock, now has a real backend: a student can
  attach a PDF/Word/PowerPoint/text file and ask about it, including follow-up questions.

Systems touched: Marketplace checkout, orders, vendor delivery, admin, notifications/email, Marketplace page layout;
E-Learning course materials UI, Study Zone, a new Stewart API; two additive database migrations; a new automated test
suite (the repository had none).

What this does **not** establish is listed in section J — most importantly: no real Paystack transaction, real email,
real Supabase upload, or real AI call was made, and no migration has been applied anywhere but a local test database.

---

## B. Initial audit findings

Audit date: 2026-10-13. Every finding below was checked against the code at `b9e7e15`. "Confirmed" means the
defect is visible in the code itself; "Hypothesis" means it is consistent with the code but needs production data
(logs, Paystack dashboard, DB rows) that was not available.

### Stack (as found)

| Concern | What the repo actually uses |
|---|---|
| Framework | Next.js 16.3.3 (App Router, route handlers + `route.controller.ts` + `services/**` layering), React 19 |
| Marketplace DB | PostgreSQL (Supabase pooler) via Prisma 6.19 (`prisma/schema.prisma`, migrations in `prisma/migrations`) |
| E-Learning DB | Separate Postgres, separate Prisma schema `prisma/elearning/schema.prisma`, deployed with `db push` (no migrations folder) |
| Auth | NextAuth v4 JWT sessions (`src/lib/auth.ts`), `requireAdmin` (`User.isAdmin`), ownership helpers per domain |
| Payments | Paystack Inline popup (browser) + server verify (`src/lib/external/paystack.ts`) + signed webhook |
| Email | Resend (`services/marketplace/notifications/email.service.ts`), fire-and-forget, no persistence/retry |
| In-app notifications | `Notification` table + SSE (`notification.service.ts`) |
| Files | Cloudinary (marketplace images); Supabase Storage private bucket (course materials) |
| AI | **None.** Study Zone's "Stewart" is an explicit mock (`stewart.ts`): no provider, no key in `.env`, no extraction/RAG |
| Tests | **No test framework or test files exist.** `package.json` has no `test` script |
| Crons | Vercel Cron; `vercel.json` registers only two **daily** jobs (history shows the hourly ones were removed in `1f34fa1`, consistent with a Hobby-plan limit) |

### Baseline checks (before any change)

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit -p .` | Pass (0 errors) |
| Lint | `npx eslint .` | Pass — 0 errors, 7 pre-existing warnings (`scripts/verify-student-pages.ts` ×6, `services/marketplace/escrow/mark-item-eligible-for-payout.ts` ×1) |
| Build | `npx next build` | Pass (143 static pages) |
| Migration drift | `prisma migrate diff --from-url <local> --to-schema-datamodel prisma/schema.prisma` against a fresh local DB with all migrations applied | No drift ("empty migration") |
| Unit/integration tests | — | None exist |

### Issue-by-issue findings

#### 1. Paystack cancellation changes inventory / abandoned orders stay pending (both checkouts)

- **Confirmed root cause — stock is deducted at initialize, never released.** `services/marketplace/checkout/create-orders-for-checkout.ts` (Business) and `services/marketplace/vendor-checkout/create-vendor-orders-for-checkout.ts` (Vendor) decrement `Product.stock` / `ProductVariant.stock` / `Side.stock` inside the *initialize* transaction, before the Paystack popup is even opened. No code path anywhere restores that stock when the popup is closed, the payment fails, or the attempt is abandoned.
- **Confirmed — the popup's `onClose` only resets the UI.** `checkout/page.tsx` and `vendor-checkout/page.tsx` call `setStatus("ready")` on close; the server is never told. Every "Proceed to payment" click creates a *new* set of `Order` rows and a *new* stock deduction.
- **Confirmed — unpaid orders are visible as real orders.** No order listing filters on `paymentStatus`: `list-seller-orders.ts`, `list-vendor-orders.ts`, `list-buyer-orders.ts`, business stats (`get-business-detail.ts` revenue/order count) all include `paymentStatus: "pending"` rows. A seller could even *accept* an unpaid order (`accept-order.ts` has no payment check).
- **Confirmed — unpaid orders get "refunded".** `run-seller-response-sweep.ts` auto-rejects every `PENDING_SELLER` order older than 24h — including never-paid ones — calls `refundOrderItem`, and emails the buyer "A refund is being processed" for money that was never taken.
- **Confirmed — abandoned vendor checkouts permanently consume vendor capacity.** `countVendorBookingsForSlot` counts every `Order` with a booking for the slot/date regardless of payment.
- **Confirmed — no server-side amount/currency/owner validation.** `checkout/verify` checks only `status === "success"`; it never compares the paid amount with what the checkout charged (nothing even stores the charged amount), and any signed-in user can verify any reference.
- **Confirmed — confirmation is racy.** `confirmPaymentByReference` reads `paymentStatus: "pending"` orders, then updates them by id **without** re-checking status. The webhook and the browser's verify call arriving together can both pass the read and both send the "new order" email + notification (duplicate notifications).
- **Confirmed — cart clearing over-reaches.** On success the whole Business (or Vendor) cart is deleted, including lines added after the checkout started.

#### 2. `checkout/verify` returns 502

- **Confirmed (code):** the controller converts *every* exception from `verifyTransaction` into `502 Couldn't verify this payment with Paystack.` — that includes Paystack's HTTP 400 `Transaction reference not found`, a missing secret key, a non-JSON upstream body (`res.json()` throws), and network errors. There is no request timeout on the outbound fetch.
- **Strong hypothesis (needs production logs to confirm):** until `b9e7e15` ("fixed paystack test checkout"), `getPaystackSecretKey()` used the **live** secret when `NODE_ENV === "production"` while the browser always opened the popup with the **test** publishable key (`NEXT_PUBLIC_PAYSTACK_KEY`). A test-mode transaction verified with a live key returns `Transaction reference not found` → 502 on every production checkout. The same mismatch would make every production webhook fail signature verification (401), so payments could never be confirmed by either path. The hotfix hardcodes the test key in all environments, which removes the mismatch but makes live payments impossible without a code change.
- Not confirmable without production access: whether pool exhaustion or Vercel function timeouts also contributed. The verify path does little DB work, so it is unlikely to be the main cause; but `confirmPaymentByReference` awaits notification writes sequentially per order, which lengthens the request.

#### 3. Account block email

- **Confirmed:** the only "block" action in the admin interface is **business blocking** (`services/marketplace/admin/block-business.ts`, admin UI `studashboard/admin/marketplace/businesses/[businessId]`). There is no user-level block field or action (`User` has no blocked/status column). **Assumption (not confirmed with the requester — see section J):** the block that sends the email is the existing business block, emailed to the business owner's account address. No user-level block system was invented.
- **Confirmed:** no email or notification is sent on block (documented as such in `docs/admin/systems/business-oversight.md`).
- **Confirmed gap:** `Business.blocked` is not enforced anywhere outside the admin UI: blocked businesses still appear in search/storefronts and can receive orders through either checkout (documented as a known gap in the same doc).

#### 4. Approved-business notification opens "This business doesn't exist, or isn't yours."

- **Confirmed root cause:** `approve-business.ts` (and `reject-business.ts`, `verify-business.ts`, `reject-verification-request.ts`) always link to `/studashboard/marketplace/business/{id}`. School Vendors are `Business` rows with `type = SCHOOL_VENDOR` whose dashboard is `/studashboard/marketplace/vendor-dashboard/{id}`; the Business API (`get-business-detail.ts`) deliberately filters `type: "BUSINESS"` and 404s, which `BusinessApprovalGate.tsx` renders as exactly "This business doesn't exist, or isn't yours." That is why it happens "sometimes" — only for vendor applications. `confirm-pickup.ts` (used by vendor handoffs too) has the same hardcoded Business link.
- Ownership checks are correct and are kept: the 404 comes from the type filter, not ownership.

#### 5. Business-owner "new order" emails

- **Confirmed:** `newOrderEmail` is sent from `confirmPaymentByReference` for both checkouts, fire-and-forget. It has no link to the order page, no item quantities beyond a summary string, no delivery info, and is subject to the duplicate-confirmation race above. Failures are only logged (`console.error`) — no persistence, no retry, no dedupe.
- **Not confirmable here:** Resend dashboard delivery status, sender-domain DNS (SPF/DKIM/DMARC) for `MARKETPLACE_EMAIL_FROM`. If the sender domain is not verified in Resend, sends are rejected — this is visible only in production logs/Resend dashboard.

#### 6. Delivery schedules / per-date capacity

- **Found (existing):** School Vendors already have per-timeframe default capacity (`VendorTimeframeCapacity`) and per-date overrides (`VendorTimeframeCapacityOverride`), enforced inside a SERIALIZABLE booking transaction, and customers already pick a date. Missing: recurring delivery weekdays, a way to make a date unavailable (or add a custom date), and visibility of paid vs. reserved bookings. Capacity counting includes unpaid orders (see 1).
- Business (non-vendor) sellers have recurring delivery weekdays (`BusinessDeliveryDay`) but customers do not choose a date (an estimate is computed), so per-date capacity is a vendor-checkout concern in this architecture.

#### 7. Pickup-point drop-off visibility

- **Found:** vendors have no drop-off point (deliverers collect at the vendor's own location — `docs/marketplace/decisions/vendor-independent-architecture.md`). The drop-off-at-a-designated-point flow is the **Business** seller flow (`READY_FOR_PICKUP` → seller drop-off OTP → coordinator confirmation). The "Ready for Pickup" tab shows a small grey line with window/location and a plain button; `MarketplaceSettings.dropoffLocationName` / `dropoffLocationInstructions` / `dropoffLocationActive` exist but are never shown to sellers.

#### 8. Vendor-delivery orders sort order

- **Confirmed:** `services/marketplace/vendor/order/list-vendor-orders.ts` sorts `createdAt: "asc"` on purpose (an earlier spec "§9"), and the page groups by delivery date ascending. This request (newest first) supersedes that earlier decision.

#### 9. Navbar covering "Back to Marketplace"

- **Confirmed root cause (from the compiled CSS):** `DashboardNavbar` is `fixed` and `h-16` (64px). Marketplace pages put `pt-16` **and** `py-N` / `sm:py-N` on the same element. In the generated stylesheet `.pt-16` beats the base `.py-10`, but the `@media (width>=40rem)` `sm:py-14` / `sm:py-12` rules come later and override `padding-top` to 56px / 48px. From the `sm` breakpoint up, page content (whose first child is the "Back to Marketplace" link) starts 8–16px **under** the fixed navbar. Affects checkout, vendor checkout, business create, vendor apply, deliverer apply, and both owner dashboard layouts.
- **Confirmed:** buyer Orders, Deliverer, and vendor storefront pages have no back/breadcrumb control at all.

#### 10. Multiple notes per course week

- **Could not reproduce in code.** At HEAD the E-Learning schema has no per-week uniqueness on `CourseMaterial` (only `storagePath @unique`, and history shows there never was one), uploads use `x-upsert: false` with a UUID-prefixed path, `confirmUpload` always `create`s, and both the lecturer page and Study Zone already list every document in a week. Because the E-Learning DB is deployed with `db push`, the deployed DB's constraints cannot be confirmed from the repo — a check query is given in section D.
- **Found:** the Study Zone shows several documents in a week as small pill buttons only when there is more than one, and the week tab's subtitle shows only the first document's title — easy to read as "one note per week". The requested dropdown does not exist.

#### 11. AI Study Zone document upload

- **Confirmed:** Stewart is a mock — there is no AI provider, API key, extraction pipeline, RAG, or vector store. A real model integration is therefore a new dependency, not an extension (decision recorded in section G).
- **Found:** the browser already has zero-dependency DOCX/PPTX readers (`study-zone/_components/office/*`) built on a small ZIP reader that only needs `DecompressionStream`, which Node 24 also provides.

---

---

## C. Change register

Paths are repository-relative. "New" = created in this work.

### C.1 Payments, checkout, inventory

| File | Change | Why / what it addresses |
|---|---|---|
| `prisma/schema.prisma` | New `CheckoutPayment` (+ enums `CheckoutPaymentStatus`, `CheckoutKind`), new `EmailDelivery` (+ `EmailDeliveryStatus`), new `VendorDeliveryDateOverride`, relations on `User`/`Business` | See section D |
| `prisma/migrations/20261013091929_checkout_payments_and_email_outbox/migration.sql` (new) | Creates the two tables, three enums, indexes, one FK | Additive only |
| `prisma/migrations/20261013123945_vendor_delivery_date_override/migration.sql` (new) | Creates `VendorDeliveryDateOverride` | Additive only |
| `src/lib/external/paystack.ts` | `getPaystackMode()` (`PAYSTACK_MODE`, default `test`) selects both the secret key and `getPaystackPublicKey()`; `paystackFetch` gets a 10s `AbortSignal.timeout`, safe JSON parsing, and typed `PaystackError` (`timeout`/`network`/`http`/`malformed`/`rejected`) / `PaystackConfigError`; `verifyTransaction` returns `{ outcome: success \| failed \| abandoned \| pending \| not_found, amountKobo, currency, … }` and only throws when the outcome is unknown | Root of the 502: unclassified throws and test/live key mismatch |
| `services/marketplace/checkout/shared/stock-reservation.ts` (new) | `reserveLine` (conditional decrement, `stock >= qty` in the `WHERE`) and `releaseLine` | One rule for which stock column a line uses; prevents overselling at any isolation level |
| `services/marketplace/checkout/shared/checkout-payment-config.ts` (new) | `RESERVATION_TTL_MINUTES = 30`, `PENDING_PROVIDER_MAX_HOURS = 24`, `toKobo`, `CHECKOUT_CURRENCY` | Single place for reservation timing |
| `services/marketplace/checkout/shared/payment-log.ts` (new) | `logPayment` — one JSON log line per lifecycle step (reference, ids, statuses, error class; never keys/emails) | Diagnosability requirement |
| `services/marketplace/checkout/shared/checkout-background.ts` (new), `src/lib/schedule-checkout-background.ts` (new) | Post-response work: deliver queued emails, sweep 5 expired reservations, retry 5 failed emails | Self-healing without a frequent cron |
| `services/marketplace/order/shared/paid-order.ts` (new) | `PAID_ORDER` / `ORDER_PAYMENT_STATUS` | The one definition of "a real order" |
| `services/marketplace/checkout/create-orders-for-checkout.ts` | Reserves stock through `reserveLine`; rejects blocked businesses and invalid quantities; creates the `CheckoutPayment` row (amount in kobo, cart line ids, expiry) in the same transaction; returns `amountKobo` | Business checkout initialize |
| `services/marketplace/vendor-checkout/create-vendor-orders-for-checkout.ts` | Same, inside the existing SERIALIZABLE booking transaction; rejects blocked vendors | Vendor checkout initialize |
| `services/marketplace/checkout/ensure-checkout-payment.ts` (new) | Loads the attempt for a reference, or *adopts* a pre-existing pending order set into a `CheckoutPayment` | Legacy orders go through the same code path |
| `services/marketplace/checkout/confirm-payment-by-reference.ts` | Rewritten. `describeMismatch` (reference/amount/currency); `finalizePending` (conditional `PENDING→PAID` claim elects one winner); `finalizeAfterRelease` (re-reserve stock + re-check vendor capacity for a late success); `flagForReview`; cart clearing limited to the checkout's own lines | Finalization, idempotency, reconciliation |
| `services/marketplace/checkout/release-checkout-reservation.ts` (new) | Conditional `PENDING→FAILED/ABANDONED/EXPIRED` + restock + cancel booking, one transaction | Exactly-once release |
| `services/marketplace/checkout/reconcile-checkout-payment.ts` (new) | The single entry point for verify / cancel / webhook / sweep / retry | One set of rules for every trigger |
| `services/marketplace/checkout/reconcile-user-pending-checkouts.ts` (new) | Settles the buyer's earlier unpaid attempt before a new initialize (4s verify timeout, never throws) | A retry isn't blocked by, or doubled with, the buyer's own reservation |
| `services/marketplace/checkout/run-checkout-reconcile-sweep.ts` (new) | Reconciles expired attempts and legacy pending orders, bounded per run | Reservation expiry |
| `services/marketplace/checkout/load-owned-checkout-payment.ts` (new) | 404 unless the reference belongs to the caller | Verify/cancel ownership |
| `services/marketplace/checkout/notify-order-paid.ts` (new) | `enqueueOrderPaidEmails` (inside the finalize transaction) and `createOrderPaidNotifications` | Owner notification from the order-paid event |
| `services/marketplace/payment/handle-paystack-event.ts` | Verifies server-side instead of trusting the event body; returns `{ handled, retry, emailIds }` | Webhook correctness |
| `services/marketplace/fines/verify-fine-payment.ts` (new), `services/marketplace/fines/initialize-fine-payment.ts` | Fine payments use the same verify outcomes, amount/currency check, and server-chosen public key | Keeps the second Paystack flow consistent with the new client |
| `src/app/api/marketplace/checkout/initialize/route.controller.ts`, `src/app/api/marketplace/vendor-checkout/initialize/route.controller.ts` | Reconcile prior attempt, return `currency` + `publicKey`, schedule background work | |
| `src/app/api/marketplace/checkout/verify/route.controller.ts` | Ownership check; maps results to 200/202/402/404/409/410/503 (`paymentResultResponse`) | Replaces the blanket 502 |
| `src/app/api/marketplace/checkout/cancel/route.ts`, `route.controller.ts` (new) | `POST { reference }` when the popup is closed | Cancellation |
| `src/app/api/webhooks/paystack/route.controller.ts` | 401 bad signature, 400 malformed body, 503 when verification is unavailable, 500 on our failure | Controlled errors; lets Paystack retry |
| `src/app/api/marketplace/businesses/[id]/fines/[fineId]/verify/route.controller.ts` | Uses `verifyFinePaymentByReference`, scoped to the business | |
| `src/app/api/cron/checkout-reconcile/route.ts`, `src/app/api/cron/email-retry/route.ts` (new) | `CRON_SECRET`-guarded sweeps | Not registered in `vercel.json` — see section I |
| `src/app/studashboard/marketplace/checkout/_components/paystackCheckout.ts` (new) | `openPaystackCheckout`, `confirmPayment` (bounded retries on 202/503), `reportCancelled` | Shared by both checkout pages |
| `src/app/studashboard/marketplace/checkout/page.tsx`, `vendor-checkout/page.tsx` | Use the helper; tell the server on popup close; neutral "payment cancelled, cart unchanged" notice | |
| `src/types/checkout.ts` | `InitializeCheckoutResponse` gains optional `currency`, `publicKey` | Backward compatible |
| Order visibility: `services/marketplace/order/{list-seller-orders,list-buyer-orders,accept-order,reject-order,reject-order-item,mark-order-ready,initiate-order-dropoff,dispute-order,run-seller-response-sweep}.ts`, `services/marketplace/vendor/order/{list-vendor-orders,mark-vendor-order-failed}.ts`, `services/marketplace/business/get-business-detail.ts`, `services/marketplace/admin/{get-user-detail,get-business-detail-for-admin}.ts` | Filter on `PAID_ORDER` | Unpaid attempts are not orders: not listed, not counted as revenue, not acceptable, not auto-rejected/"refunded" |
| `services/marketplace/vendor/capacity/manage-vendor-capacity.ts` | `countVendorBookingsForSlot` counts paid orders + unpaid orders whose reservation is still live; `countVendorBookingsBreakdown` | Abandoned checkouts no longer consume capacity forever |

### C.2 Approval links, block email, block enforcement

| File | Change | Why |
|---|---|---|
| `services/marketplace/business/owner-dashboard-path.ts` (new) | `ownerDashboardPath(business, tab?)` — Business → `/business/[id]`, School Vendor → `/vendor-dashboard/[id]` | The one place that knows the owner route |
| `services/marketplace/admin/{approve-business,reject-business,verify-business,reject-verification-request}.ts`, `services/marketplace/delivery/confirm-pickup.ts` | Links come from the helper. `approveBusiness` commits a conditional status change first and only the request that changed it notifies | Fixes the "doesn't exist, or isn't yours" page; no duplicate notifications |
| `services/marketplace/admin/block-business.ts` | Conditional `blocked: false→true`; queues `businessBlockedEmail` in the same transaction through the outbox; in-app notification; returns `{ blocked, emailId }` | Block email, exactly once, never undoing the block |
| `services/marketplace/notifications/email.service.ts` | `sendEmailWithResult`, `escapeHtml`, `appUrl`; new `businessBlockedEmail`; `businessApprovedEmail` gains a dashboard link; `newOrderEmail` rewritten | See section F |
| `services/marketplace/notifications/email-outbox.ts` (new) | `enqueueEmail`, `deliverEmail`, `deliverEmails`, `runEmailRetrySweep` | See section F |
| `services/marketplace/{business/get-featured-businesses,product/search-products,product/get-public-product-detail,vendor/get-featured-vendors,vendor/get-popular-vendor-items,vendor/get-vendor-storefront,cart/add-to-cart,vendor-cart/add-to-vendor-cart}.ts` | Exclude / 404 blocked businesses; `add-to-cart` now also requires an approved business | A block can't be bypassed by calling the API directly |
| `services/marketplace/business/get-business-detail.ts`, `services/marketplace/vendor/get-vendor-profile.ts`, `src/types/business.ts` | Owner DTOs include `blocked`, `blockedReason` | Owner-facing banner |
| `src/app/studashboard/marketplace/business/_components/BusinessApprovalGate.tsx`, `vendor-dashboard/_components/VendorApprovalGate.tsx` | On 404, check the *other* owner-scoped endpoint and redirect to the right dashboard; blocked banner | Repairs notifications already stored with the wrong link; ownership still enforced by the API |

### C.3 Delivery schedule, capacity, drop-off, sorting

| File | Change |
|---|---|
| `services/marketplace/vendor/capacity/vendor-delivery-schedule.ts` (new) | `decideDateAvailability` (pure), `isVendorDeliveryDate`, `loadVendorScheduleWindow` (batched), `getVendorDeliverySchedule`, `setVendorDeliveryWeekdays`, `setVendorDateAvailability`, `clearVendorDateAvailability` — all owner-scoped |
| `services/marketplace/vendor/capacity/resolve-vendor-capacity.ts` | Returns 0 when the vendor doesn't deliver that date |
| `services/marketplace/vendor/capacity/manage-vendor-capacity.ts` | Rows carry `paid`, `reserved`, `dateAvailable`; `clearVendorCapacityOverride`; config dates up to 90 days ahead |
| `services/marketplace/vendor-delivery/validate-delivery-date.ts` | Optional `maxDaysAhead`; `MAX_SCHEDULE_CONFIG_DAYS = 90` (customer booking window stays 7) |
| `services/marketplace/vendor-checkout/calculate-vendor-checkout-summary.ts` | Response gains `dates: [{ date, selectable, reason }]` |
| `src/app/api/marketplace/vendor/[id]/schedule/{route,route.controller}.ts`, `…/schedule/dates/{route,route.controller}.ts` (new); `…/capacity/{route,route.controller}.ts` (DELETE added) | See section E |
| `src/app/studashboard/marketplace/vendor-dashboard/_components/DeliveryScheduleSection.tsx` (new), `vendor-dashboard/[id]/page.tsx` | Schedule UI; capacity rows show paid / awaiting payment, over-capacity and "use default" |
| `src/app/studashboard/marketplace/vendor-checkout/_components/DeliveryDatePicker.tsx`, `vendor-checkout/page.tsx` | Date chips from the server's availability; auto-moves off an unbookable date |
| `services/marketplace/vendor/order/list-vendor-orders.ts`, `services/marketplace/order/list-seller-orders.ts` | `orderBy: [{ createdAt: "desc" }, { id: "desc" }]` |
| `src/app/studashboard/marketplace/vendor-dashboard/[id]/orders/page.tsx` | Default "All orders · newest first" view; delivery-date tabs remain as filters |
| `src/app/studashboard/marketplace/business/_components/DropoffActionPanel.tsx` (new), `business/[id]/orders/page.tsx` | Drop-off panel (replaces the small inline text + button) |

### C.4 Navigation

| File | Change |
|---|---|
| `src/app/studashboard/marketplace/_components/MarketplacePageShell.tsx` (new) | Shell (`<main className="pt-16">` + inner padded container) and shared `BackLink` |
| `checkout/page.tsx`, `vendor-checkout/page.tsx`, `orders/page.tsx`, `deliverer/page.tsx`, `deliverer/apply/page.tsx`, `business/create/page.tsx`, `vendor/apply/page.tsx`, `business/[id]/layout.tsx`, `vendor-dashboard/[id]/layout.tsx` (all under `src/app/studashboard/marketplace/`) | Use the shell; hand-rolled back links removed. Orders, Deliverer and the three forms previously had no back control on their main view |
| `explore/page.tsx`, `vendor/[id]/page.tsx` | Use `BackLink` (the storefront had none) |

### C.5 E-Learning

| File | Change |
|---|---|
| `src/app/e-learning/student/study-zone/_components/study-selection.ts` (new) | `initialWeek`, `resolveSelection`, `documentOptionLabels` |
| `…/study-zone/_components/StudyWorkspace.tsx` | Document `<select>` per week (replaces pill buttons), refresh control, "no longer available" notice, passes ids to Stewart |
| `…/study-zone/_components/WeekTabs.tsx` | "+N more" on a week with several documents |
| `src/app/e-learning/faculty/my-subjects/[offeringId]/UploadMaterial.tsx`, `page.tsx` | Week is kept between uploads; shows how many documents the week has; per-week "Add (another) document" link (`?week=N`) |
| `src/lib/stewart/config.ts` (new) | Supported types and limits, shared client/server |
| `services/e-learning/student/stewart/{client,extract-text,attachment-token,upload-attachment,chat,rate-limit}.ts` (new) | See section G |
| `src/app/api/e-learning/stewart/{shared.ts,attachments/route.ts,chat/route.ts}` (new) | See section E |
| `…/study-zone/_components/stewart.ts`, `StewartPanel.tsx` | Mock replaced by a real client; upload control, attachment chip, states |
| `package.json`, `package-lock.json` | Dependency `@anthropic-ai/sdk` `^0.133.0` |

### C.6 Tests and tooling

| File | Purpose |
|---|---|
| `package.json` | Scripts `test`, `test:db:setup` |
| `tests/helpers/env.ts` | Forces local DB URLs and dummy provider keys; refuses a non-local host |
| `tests/helpers/setup-test-db.mjs` | Applies migrations / pushes the E-Learning schema to the local test DBs only |
| `tests/helpers/fake-providers.ts` | In-memory Paystack, Resend, Supabase Storage (replaces `fetch`; any other URL throws) |
| `tests/helpers/{fixtures,elearning-fixtures,office-files,session}.ts` | Data builders, real docx/pptx builders, NextAuth session mock |
| `tests/marketplace/*.test.ts(x)`, `tests/elearning/*.test.ts` | 126 tests — section H |
| `scripts/verify-marketplace-ui.ts` (new) | Real-browser check, in the style of the existing `scripts/verify-*.ts` |

### C.7 Documentation

`docs/AKADVERSE_IMPLEMENTATION_CHANGELOG.md` (this file). Pointers to it were added at the top of the existing
documents whose descriptions are now out of date: `docs/marketplace/systems/{checkout-and-payment-system,email-system,vendor-delivery-system,cron-system}.md`,
`docs/marketplace/security/gaps.md`, `docs/admin/systems/business-oversight.md`,
`docs/elearning/systems/{study-zone-system,course-materials-system}.md`.

No file was deleted.

---

## D. Database and migration record

**Application status: applied only to the local Docker test database (`127.0.0.1:5433`). Not applied to staging or
production. No production data was read or modified.**

### D.1 `20261013091929_checkout_payments_and_email_outbox` (Marketplace DB)

| Object | Detail |
|---|---|
| `CheckoutPayment` (new) | `reference` **unique**; `userId` (FK → `User`, cascade); `kind` (`BUSINESS`/`VENDOR`); `status` (`PENDING`/`PAID`/`FAILED`/`ABANDONED`/`EXPIRED`/`NEEDS_REVIEW`); `amountKobo` Int; `currency`; `cartItemIds` Json; `expiresAt`; `stockReleasedAt`; `paidAt`; `providerStatus`; `providerCheckedAt`; `verifyAttempts`; `lastError`; `reviewReason`. Indexes `(status, expiresAt)`, `(userId, status)` |
| `EmailDelivery` (new) | `dedupeKey` **unique**; `type`, `to`, `subject`, `html`; `status` (`PENDING`/`SENT`/`FAILED`); `attempts`; `lastError`; `providerMessageId`; `nextAttemptAt`; `sentAt`. Index `(status, nextAttemptAt)` |

- Previous behaviour: nothing recorded what a checkout charged or which cart lines it covered; "payment state" was
  only the free-text `Order.paymentStatus`.
- `Order.paymentStatus` is unchanged in type (free text). New values written by the application: `failed`,
  `abandoned`, `expired`, `needs_review` (alongside existing `pending`, `paid`).
- No backfill. Existing `paid` orders need nothing. Existing `pending` orders are adopted lazily by the reconciler
  (section E.4).

### D.2 `20261013123945_vendor_delivery_date_override` (Marketplace DB)

`VendorDeliveryDateOverride`: `businessId` (FK → `Business`, cascade), `date`, `available`, `note`; unique
`(businessId, date)`. Recurring weekdays reuse the existing `BusinessDeliveryDay` table — no change to it. A vendor
with no weekday rows keeps delivering every day, so no existing vendor's behaviour changes. (The migration also
creates a plain index on the same two columns as the unique one; it is redundant but harmless.)

### D.3 E-Learning database

**No schema change.** `CourseMaterial` already allows any number of rows per week. To confirm the *deployed*
database matches (it is deployed with `db push`, so the repo can't prove it), run:

```sql
SELECT indexdef FROM pg_indexes WHERE tablename = 'CourseMaterial' AND indexdef ILIKE '%UNIQUE%';
```

Expected: only the primary key and `storagePath`. Anything mentioning `startWeek` would be drift and the real cause
of a one-note-per-week limit.

### D.4 How to apply, ordering, rollback

```bash
npx prisma migrate deploy      # uses DIRECT_URL; applies both migrations
```

- **Order: migrate first, then deploy the code.** Both migrations only add tables, so the currently deployed code is
  unaffected by them. The new code fails at checkout if the tables are missing.
- Generated client: `npm run build` / `postinstall` already run `prisma generate`.
- Rollback (after rolling the code back): `DROP TABLE "CheckoutPayment", "EmailDelivery", "VendorDeliveryDateOverride"; DROP TYPE "CheckoutPaymentStatus", "CheckoutKind", "EmailDeliveryStatus";`
  Orders marked `abandoned`/`expired`/`failed` by the new code would then read as non-`pending`, non-`paid` to the
  old code, which lists every order regardless — they would reappear in seller lists as cancelled orders.
- Verified locally: `prisma validate` passes for both schemas; `prisma migrate diff` between the migrated local
  database and `schema.prisma` is empty.

---

## E. API and workflow changes

### E.1 Endpoints

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /api/marketplace/checkout/initialize` `{ location }` | session | Reserves stock, creates pending orders + `CheckoutPayment`. Response `{ reference, amountKobo, email, currency, publicKey }` (last two are new, additive). 400 empty cart, 409 stock/blocked/unapproved |
| `POST /api/marketplace/vendor-checkout/initialize` `{ slotId, location, date }` | session | Same, plus slot/date/capacity validation. 409 when the date isn't a delivery date or is full |
| `POST /api/marketplace/checkout/verify` `{ reference }` | session, must own the checkout | 200 `{ status: "success", confirmedOrderIds }` (unchanged shape) · 202 `pending` · 402 `failed` · 404 `not_found` · 409 `needs_review` · 410 `cancelled`/`expired` · 503 `unknown` (+`Retry-After`) · 500. Non-200 bodies keep `{ error }`. **Compatibility:** an older client treats any non-2xx as "couldn't confirm", as before; 202 is new and is only produced when Paystack says the payment isn't complete |
| `POST /api/marketplace/checkout/cancel` `{ reference }` (new) | session, must own the checkout | 200 `{ status: "cancelled" }`, or 200 `{ status: "success" }` if the payment had actually succeeded, or 202/503 when it can't be settled yet |
| `POST /api/webhooks/paystack` | HMAC signature | 401 · 400 · 200 · 503 (verify unavailable) · 500 |
| `GET /api/cron/checkout-reconcile`, `GET /api/cron/email-retry` (new) | `Authorization: Bearer $CRON_SECRET` | JSON counts |
| `GET/PUT /api/marketplace/vendor/[id]/schedule` (new) | owner of that vendor | Read schedule; `PUT { weekdays: DayOfWeek[] }` (`[]` = every day) |
| `PUT/DELETE /api/marketplace/vendor/[id]/schedule/dates` (new) | owner | `PUT { date, available, note? }`; `DELETE ?date=` |
| `DELETE /api/marketplace/vendor/[id]/capacity?slotId=&date=` (new) | owner | Remove one date's capacity override |
| `GET /api/marketplace/vendor/[id]/capacity` | owner | Rows gain `paid`, `reserved`, `dateAvailable` (additive) |
| `GET /api/marketplace/vendor-checkout/summary` | session | Gains `dates` (additive) |
| `GET /api/marketplace/vendor/[id]/orders`, `GET /api/marketplace/businesses/[id]/orders` | owner | Paid orders only; newest first |
| `POST /api/e-learning/stewart/attachments` (multipart `file`), `DELETE` `{ token }` (new) | student with profile | Section G |
| `POST /api/e-learning/stewart/chat` (new) | student with profile + approved registration for `courseId` | Section G |

### E.2 Payment lifecycle

```text
initialize ── reserve stock (+ vendor capacity) ── CheckoutPayment PENDING (amount, cart lines, expiresAt = +30 min)
   │            orders exist with paymentStatus "pending": hidden everywhere, cannot be accepted
   ▼
Paystack popup
   ├─ success callback ─▶ POST verify ─┐
   ├─ closed ───────────▶ POST cancel ─┤
   └─ (tab closed) ······ webhook ─────┼─▶ reconcileCheckoutPayment(reference, trigger)
                          sweep/retry ─┘        │  always: server-side Paystack verify
                                                ▼
   success + reference/amount/currency match ─▶ PAID   orders "paid" (vendor: ACCEPTED), booking CONFIRMED,
                                                       owner email queued, cart lines of THIS checkout cleared
   success but mismatch ──────────────────────▶ NEEDS_REVIEW (admins notified; nothing finalized)
   failed / reversed ─────────────────────────▶ FAILED     stock + capacity released
   abandoned / not found, on cancel or retry ─▶ ABANDONED  released
   abandoned / not found, sweep after expiry ─▶ EXPIRED    released
   abandoned / not found, on verify ──────────▶ unchanged (202 / 404)
   still pending at Paystack ─────────────────▶ unchanged (released by the sweep after 24h)
   no answer (timeout, 5xx, bad body) ────────▶ unchanged, error recorded, caller told to retry
```

- **Exactly once.** `PENDING→PAID` and `PENDING→released` are conditional updates inside the same transaction as
  their side effects. Of any number of concurrent callers one wins; the others read the final state.
- **Inventory.** One deduction at initialize. Success leaves it. Release adds it back once. Stock that was never
  reserved is never "restored".
- **Late success.** If Paystack reports success for a checkout that was already released (browser said cancelled; a
  bank transfer settled late), stock is re-reserved and vendor capacity re-checked in a transaction. If that fails,
  the checkout is `NEEDS_REVIEW` — the buyer paid, so it is flagged, never dropped.
- **Cart.** Untouched until payment succeeds; then only the lines that checkout covered are removed.
- **Legacy pending orders** (created before this change): hidden immediately by the paid-only filter; the sweep
  adopts those older than 30 minutes, verifies each with Paystack, and finalizes or releases them. Release restores
  the stock the old code deducted at initialize.

### E.3 Order state changes

| Before | After |
|---|---|
| Unpaid order listed as "Pending" to the seller/vendor and buyer | Not listed anywhere; `accept`/`reject`/`ready`/`drop-off`/`dispute` return 404 for it |
| Released attempt: n/a | `Order.status = CANCELLED`, `paymentStatus = abandoned\|failed\|expired`, booking `CANCELLED` (internal record) |
| Vendor orders oldest first (earlier spec "§9") | Newest first — **this supersedes that decision at the requester's instruction** |

### E.4 Delivery rules (what was decided)

- Capacity unit: one per vendor order, per timeframe, per date — unchanged.
- Counts toward capacity: paid orders, and unpaid orders created less than 30 minutes ago whose booking isn't cancelled.
- Timezone: calendar dates in `Africa/Lagos`, stored as UTC midnight (the existing convention); weekday read with `getUTCDay()`.
- Closing a date or reducing capacity below what is booked: existing orders are kept and still fulfilled; only new
  bookings stop; the dashboard flags the date as over capacity. Changing weekdays never moves an existing order.
- Business (non-vendor) sellers are not given per-date capacity: their customers don't choose a date (an estimate is
  computed from `BusinessDeliveryDay`), so there is nothing to cap per date in that flow.

---

## F. Email and notification changes

| Event | Recipient | Template | Delivery |
|---|---|---|---|
| Checkout finalized (paid) — both checkouts | Owner of each order's business/vendor (`Business.user.email`) | `newOrderEmail` | Outbox, key `order-paid:<orderId>`, queued inside the finalize transaction |
| Admin blocks a business | Owner's account email | `businessBlockedEmail` (new) | Outbox, key `business-blocked:<businessId>:<blockedAt>`, queued inside the block transaction |
| Admin approves a business | Owner | `businessApprovedEmail` (now with a dashboard link) | Direct `sendEmail` (unchanged mechanism), sent only on the actual status change |
| Payment needs review | All admins | in-app only (`PAYMENT_NEEDS_REVIEW`) | `notifyAdmins` |

- **`newOrderEmail` content:** short order id + full id, payment reference, business name, itemized lines with
  quantities and line totals, total with currency, delivery information (vendor: date + timeframe; business:
  estimated delivery), the next step, and a link to the correct orders page. It contains no buyer name, email, phone,
  or address. User-entered text is HTML-escaped.
- **`businessBlockedEmail` content:** that the account is blocked, the reason the admin entered, what it means, and a
  support contact (`SUPPORT_CONTACT`, else `ADMIN_EMAIL`, else a generic line). No admin identity or internal notes.
  No appeal process is described because none exists.
- **Outbox behaviour:** `deliverEmail` claims a row with a conditional update (a 5-minute lease), sends, and records
  `SENT` + provider message id, or `FAILED` + error with exponential backoff (2, 4, 8 … minutes, max 6h, 8 attempts).
  A failed send never reverses the block or the order. Retries run from `/api/cron/email-retry` and after checkout
  requests. A missing `RESEND_API_KEY` is a recorded failure, not a silent skip.
- **`SENT` means Resend accepted the message.** It does not mean it reached an inbox.
- **Not sent for:** cancelled, failed, expired, or mismatched payments (tested).
- **Unchanged:** all other templates and their fire-and-forget sending; buyers still receive no email at payment time.
- **Notification destinations:** `BUSINESS_APPROVED`, `BUSINESS_REJECTED`, `BUSINESS_VERIFIED`,
  `BUSINESS_VERIFICATION_REJECTED`, `PICKUP_CONFIRMED`, `NEW_ORDER`, `BUSINESS_BLOCKED` all use `ownerDashboardPath`.
  Notifications stored before this change with the wrong link are handled by the gate redirect (C.2).

**Outside the codebase (not verified here):** the sender domain in `MARKETPLACE_EMAIL_FROM` must be verified in
Resend with its SPF/DKIM records (and ideally DMARC) published in DNS. If it is not, Resend rejects sends — which
will now show up as `EmailDelivery.status = FAILED` with the provider's reason in `lastError`.

---

## G. E-learning document changes

### G.1 Multiple notes per week

- **Representation:** one `CourseMaterial` row per document (`courseOfferingId`, `startWeek`/`endWeek`, `title`,
  `type`, `fileName`, `mimeType`, `fileSize`, `uploadedByFacultyUserId`) with its own `storagePath`
  (`{session}/{semester}/{offeringId}/{uuid}-{name}`), so identical file names never collide. This was already the
  case; nothing in the schema, upload service, or Storage limited a week to one document.
- **What changed:** the lecturer form kept resetting to Week 1 after every upload and never said a week can hold
  several documents — it now keeps the week, states how many documents the week has and that nothing is replaced, and
  each week has an "Add (another) document" link. Delete remains per document.
- **Query:** `getStudyWorkspace` returns every document whose week range covers the week, notes first, in upload order.
- **Selection:** identity is the document id. Opening a week selects its first document; the dropdown's value is the
  id of the document mounted in the viewer; each week remembers its own pick; a pick that no longer exists falls back
  to the first document with a notice; the refresh button re-reads the list without resetting the week or the chat.
  The existing PDF/PowerPoint/Word viewers are reused unchanged, including their loading and error-with-retry states.

### G.2 Stewart document upload

Stewart had no backend, so one was added. Provider: the Claude API through `@anthropic-ai/sdk`, model
`claude-opus-5-5` by default (configurable).

```text
paperclip ─▶ POST /stewart/attachments
              auth: student + profile · size ≤ 4 MB · type by extension AND file signature
              pdf  → kept as PDF (the model reads PDFs natively)
              docx/pptx/txt/md → text extracted on the server (bounded unzip; 300,000-char cap, flagged if cut)
              stored with the provider's Files API, expiring after 6 hours
              ◀─ { token, name, kind, truncated, expiresAt }   token = HMAC-signed, bound to the user + expiry

question ──▶ POST /stewart/chat { courseId, weekNumber, documentId, messages, attachment: token }
              auth: student + profile · course in the student's APPROVED registration · token is theirs and unexpired
              model request: system prompt + course context (looked up on the server)
                             + the document as a `document` block on the first user message, on every turn
              ◀─ { reply, truncated }
```

- **Supported formats:** `.pdf`, `.docx`, `.pptx`, `.txt`, `.md`. Not supported: `.doc`, `.ppt`, images, spreadsheets, ZIP.
- **Context handling:** the document is attached to every request at the same position with a cache breakpoint, so
  follow-up questions keep full access and reuse the provider's prompt cache. History is capped at 24 messages and
  4,000 characters per student message; answers at 4,096 output tokens.
- **Access control:** students only; the course is re-checked on every request; another student's token is rejected;
  the browser never receives a file id, storage URL, or key; the Supabase service-role key is not involved.
- **Untrusted content:** the system prompt states attached text is study material, not instructions. Stewart has no
  tools and no other data in context, so injected text has nothing to act on.
- **Failure handling:** each of unsupported type, too large, wrong contents, no readable text, damaged archive,
  provider error, rate limit, expired attachment, and "not configured" returns a specific message; nothing is stored
  when validation or extraction fails.
- **Limits and limitations:** 4 MB (the upload passes through a serverless function); one attachment per chat
  session; extraction skips images, charts, headers/footers, footnotes; a scanned-image Word/PowerPoint file is
  reported as unreadable; Stewart does **not** read the course document open in the viewer unless the student
  attaches it; conversations are not persisted; replies are not streamed; rate limiting is in-memory per instance.
- **Data handling to be aware of:** attached documents are sent to and stored by the AI provider for up to 6 hours
  (deleted earlier when the student removes them or leaves the page, best-effort).

---

## H. Testing report

No tests existed before. The suite uses Node's built-in test runner with the already-installed `tsx` — no test
framework was added. Database tests run against a real local Postgres (Docker, `127.0.0.1:5433`); **Paystack, Resend,
Supabase Storage, and the Claude API are fakes** in every automated test.

| Check | Command | Run | Result |
|---|---|---|---|
| Type check | `npx tsc --noEmit -p .` | yes | Pass |
| Lint | `npx eslint .` | yes | 0 errors, 7 warnings — the same 7 as the baseline |
| Schema validation | `npx prisma validate` (both schemas) | yes | Pass |
| Migration drift | `prisma migrate diff` (local DB vs `schema.prisma`) | yes | Empty |
| Build | `npm run build` | yes | Pass, 148 pages |
| Automated tests | `npm test` | yes | **126 passed, 0 failed** |
| Real-browser check | `scripts/verify-marketplace-ui.ts` (headless Chrome, built app, local DBs) | yes | **86 passed, 0 failed** |
| End-to-end / CI | — | no | None configured in the repo |

| Test file | Tests | Covers |
|---|---|---|
| `tests/marketplace/business-checkout-payment.test.ts` | 27 | Initialize reserves without creating a visible order; two buyers racing for the last unit; success; duplicate/concurrent verify + webhook; cancel; cancel-but-paid; failure; unknown reference; ownership; wrong amount/currency/reference; provider timeout/500/HTML/garbage and recovery; reservation expiry; late success with and without stock; legacy orders; seller-response sweep ignoring unpaid orders |
| `tests/marketplace/vendor-checkout-payment.test.ts` | 10 | The same lifecycle for the vendor checkout; full capacity; 5 concurrent buyers vs capacity 2; lapsed reservation frees capacity; late success when the slot refilled |
| `tests/marketplace/payment-http.test.ts` | 18 | Webhook signature, malformed body, forged "success" body, duplicates, 503-then-retry, database failure rollback; status mapping; key mode; verify classification |
| `tests/marketplace/email-outbox.test.ts` | 5 | Dedupe, concurrent delivery sends once, failure + backoff + retry, attempt limit |
| `tests/marketplace/business-approval-and-block.test.ts` | 10 | Creation → approval → notification destination → owner access for Business and Vendor; double approval; unauthorized access; block status + email content; duplicate block; provider failure doesn't undo the block; block can't be bypassed |
| `tests/marketplace/vendor-delivery-schedule.test.ts` | 6 | Recurring rule, overrides, per-date capacity, existing orders kept, selectable dates |
| `tests/marketplace/vendor-owner-access.test.ts` | 5 | Owner-only schedule/capacity/orders; input validation; newest-first with tie-break; unpaid order can't be accepted |
| `tests/marketplace/navigation-and-dropoff.test.tsx` | 10 | No element mixes the navbar offset with vertical padding; pages use the shell; drop-off panel stages, visibility, disabled state, missing location |
| `tests/elearning/course-week-documents.test.ts` | 11 | No per-week uniqueness in the DB; four documents in one week; identical names; access control; per-document delete; no orphans on failure; selection rules |
| `tests/elearning/stewart-document-chat.test.ts` | 24 | Validation; extraction; zip bomb; token forgery/expiry; what is stored for the model; document block in the request; follow-ups; truncation disclosed; history validation; refusals and provider errors; rate limits; not-configured |

What the real-browser run measured, at 375 / 768 / 1280 px on 12 Marketplace pages: the "Back to Marketplace" link is
entirely below the navbar and is the topmost element at its own position, and the page has no horizontal overflow
(72 checks); plus the drop-off panel, vendor schedule, newest-first order list, date chips, document dropdown and
switching, and the Stewart upload control (14 checks). It found one defect in new code — a 2px overflow from the
drop-off button on a phone — which was fixed and re-verified.

One harmless log line appears during `npm test` (`[email-outbox] delivery of … threw … Response from the Engine was
empty`): a detached background email send racing that test file's database disconnect. The row stays queued; no
assertion depends on it.

**Not tested:** a real Paystack payment or webhook; real email delivery; a real Supabase upload; a real model answer;
the Paystack popup itself in a browser; behaviour on Vercel (function limits, `after()`), which is why the 502's
production cause remains a hypothesis.

To run: `npm run db:local:up && npm run test:db:setup && npm test`.

---

## I. Environment variables and deployment instructions

Names only. No value from `.env` was read into this document or changed.

| Variable | Status | Purpose |
|---|---|---|
| `PAYSTACK_MODE` | **New, optional.** `test` (default) or `live` | Selects secret + publishable key together. Default preserves today's behaviour (test keys everywhere) |
| `PAYSTACK_TEST_SECRET_KEY`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_KEY`, `NEXT_PUBLIC_PAYSTACK_LIVE_KEY` | Existing | The key pair for the chosen mode must both be set |
| `CRON_SECRET` | Existing | Also guards the two new cron routes |
| `RESEND_API_KEY`, `MARKETPLACE_EMAIL_FROM`, `ADMIN_EMAIL` | Existing | Unchanged |
| `SUPPORT_CONTACT` | **New, optional** | Email or https URL shown in the blocked email; falls back to `ADMIN_EMAIL` |
| `APP_BASE_URL` | **New, optional** | Origin for links in emails; falls back to `NEXTAUTH_URL` |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Existing | Also signs Stewart attachment handles / builds email links |
| `ANTHROPIC_API_KEY` | **New, required for Stewart** | Without it Stewart answers "isn't set up yet" (503); everything else works |
| `STEWART_MODEL`, `STEWART_EFFORT`, `STEWART_REFUSAL_FALLBACK` | New, optional | Model id (default `claude-opus-5-5`), `low`/`medium`/`high` (default `low`), `off` to disable the refusal fallback |
| `AI_SERVICE_URL`, `AI_SERVICE_API_KEY` | **New (2026-10-16), optional** | The AI ingestion microservice. When both are set, course materials are sent for chunking and embedding on upload and removed on delete. When unset, nothing is sent. See [`docs/elearning/systems/ai-ingestion-contract.md`](elearning/systems/ai-ingestion-contract.md). Requires `npm run db:elearning:push` (new `CourseMaterial.aiIngest*` columns). |
| `AI_SERVICE_CALLBACK_SECRET` | **New (2026-10-16)**, required with the above | Bearer secret the microservice sends to `POST /api/webhooks/ai-ingest` |

**Deployment sequence**

1. Back up the Marketplace database.
2. `npx prisma migrate deploy` (required, before the code).
3. Set `ANTHROPIC_API_KEY` if Stewart should work; optionally `SUPPORT_CONTACT`.
4. Deploy. `npm install` picks up `@anthropic-ai/sdk`.
5. In the Paystack dashboard confirm the webhook URL is `https://<domain>/api/webhooks/paystack` for the mode in use.
6. Optional but recommended: schedule `GET /api/cron/checkout-reconcile` and `GET /api/cron/email-retry` every
   10–15 minutes with `Authorization: Bearer $CRON_SECRET`. They were **not** added to `vercel.json`: the file only
   carries daily jobs and its history shows the frequent ones were removed, which matches a plan limit. Without a
   schedule, both sweeps still run after every checkout initialize, but an idle site won't expire reservations
   until the next checkout.
7. Going live later: set `PAYSTACK_MODE=live` with both live keys. No code change.

---

## J. Outstanding issues and risks

**Not verified**

- The production 502. The code paths that produced it are fixed and tested, and the key-mode mismatch is a strong
  explanation, but there were no production logs to confirm it.
- Every external integration: Paystack, Resend, Supabase Storage, and the Claude API were faked in tests. In
  particular the Stewart request (model id, `fallbacks: "default"` with its beta header, Files API upload with
  expiry) type-checks against SDK 0.133.0 but has never been sent to the real API. If the API rejects the fallback
  parameter, set `STEWART_REFUSAL_FALLBACK=off`.
- Migrations are unapplied outside the local test database.
- Sender-domain DNS for email.

**Assumptions made instead of asking**

- "Block a user's account" was implemented as the existing **business block**, because no user-level block exists.
  If you meant blocking a person's login, that is a separate feature (a field on `User`, an admin action, a check in
  auth) and is not built.
- A blocked business is hidden and cannot take new orders, but its owner keeps dashboard access (to fulfil paid
  orders) and can still edit products.
- Legacy pending orders are assumed to have had stock deducted at initialize (true for all code since the Postgres
  migration), so releasing them restores stock.
- Stewart uses the Claude API. There was no existing provider to reuse.

**Incomplete or limited**

- `NEEDS_REVIEW` payments only raise an admin notification. There is no admin screen to resolve them, and the
  codebase still has no real Paystack refund call (pre-existing gap) — a paid-but-unfulfillable checkout must be
  refunded manually in the Paystack dashboard.
- Reservation expiry and email retry depend on traffic unless the cron routes are scheduled.
- Stewart's rate limit is per server instance; it does not cap total spend. Attached documents are stored with the
  provider for up to 6 hours — check this against your data-handling policy before enabling.
- Stewart cannot read the course document open in the viewer; the student must attach it.
- Per-date capacity is a vendor feature only (section E.4).
- The admin Vendor Delivery bookings list still shows `PENDING_PAYMENT`/`CANCELLED` bookings (labelled with their
  status, and filterable) — kept as the reconciliation view.
- Buyers get no email on successful payment (unchanged).
- The browser check is a script, not part of `npm test`; the Paystack popup flow has no browser test.
- The multiple-notes limitation could not be reproduced in code; if it persists after deployment, run the query in D.3.

**Housekeeping on this machine**

- Docker Desktop was started and the local `akadverse-local` Postgres container is running; it now holds test data.
  `npm run db:local:down` stops it.
- `npm install` hit a permissions problem in `~/.npm` (root-owned files); the SDK was installed using a private
  cache directory. npm's suggested fix is `sudo chown -R 501:20 ~/.npm` — not run.

---

## K. Final acceptance checklist

Status key: **T** implemented and tested · **V** implemented, not fully verified · **P** partial · **N** not implemented.

| # | Requirement | Status | Note |
|---|---|---|---|
| 2.1 | Initializing does not mark a purchase paid | T | |
| 2.2 | Browser/popup result never sufficient | T | Forged webhook body also tested |
| 2.3–2.4 | Server-side verify; amount, currency, reference, owner validated | T | Against a fake Paystack |
| 2.5 | No finalization / permanent deduction before verification | T | Stock is a reservation until then |
| 2.6 | Temporary reservation with expiry and release | T | Expiry runs on traffic or the cron route (J) |
| 2.7 | Cancelled/failed/expired attempts not shown as orders | T | |
| 2.8 | Cart usable and intact after cancel/failure | T | |
| 2.9 | No restore of undeducted stock, no double restore | T | |
| 2.10–2.11 | One order, one deduction; duplicates/retries harmless | T | |
| 2.12 | Cancelled in browser but paid → reconciled | T | |
| 2.13 | Verify timeout keeps state retryable | T | |
| 3 | Transactions, conditional stock updates, server-side prices, shared finalization service | T | |
| 4 | Verify 502: timeouts, explicit handling, status codes, logging, retry-safe, callers updated | V | Code tested; production cause unconfirmed |
| 5 | Email on admin block: once, reason, support contact, failure doesn't undo, retry, no internals | T | For **business** block (J) |
| 5 | Blocking can't be bypassed via the backend | T | Buyer-side; owner retains dashboard (J) |
| 6 | Approval notification opens the right page; ownership preserved; loading/error states | T | Gate redirect itself is browser logic, not unit-tested |
| 7 | Paid-order owner email: content, both checkouts, no duplicates, none for failed payments, retry | T | Real delivery unverified |
| 7 | Sender/DNS/provider configuration documented | V | Cannot be checked from the repo |
| 8 | Recurring weekdays, per-date capacity, custom/closed dates, see consumption | T | Vendors only |
| 8 | Server-enforced, concurrency-safe, released on cancel, owner-only, timezone-consistent | T | |
| 8 | Customers offered only valid dates; server re-validates | T | |
| 9 | Prominent drop-off panel using the existing state machine | T | Rendered in a real browser |
| 10 | Vendor-delivery orders newest first, DB-sorted, deterministic tie-break | T | No pagination existed to preserve |
| 11 | Back to Marketplace unobstructed; shared layout fix; mobile + desktop | T | Measured at 3 widths on 12 pages |
| 12 | Multiple documents per week; no overwrite; paths don't collide; no orphans; per-document delete | T | Already supported; UX fixed; deployed DB unconfirmed |
| 12 | Upload progress/success/error states | V | Existing states kept; form changes not browser-tested |
| 13 | Per-week document dropdown; first note default; switching; week change; removed document; viewers reused | T | |
| 14 | Upload control beside the chat input; states; remove/replace; duplicate prevention; text-only chat intact | V | Control verified in a browser; upload states exercised only through the service tests |
| 14 | Server validation; extraction; content in the model request; follow-ups; auth; no exposed keys/URLs; limits; untrusted-content handling | V | Tested against a fake model client; never run against the real API |
| 15 | Migrations additive, documented, not applied to production | T | |
| 16 | API contracts and authorization reviewed | T | Additive response fields; new 202 on verify noted in E.1 |
| 17 | Baseline recorded | T | Section B |
| 18 | Automated tests added and run; lint, types, build | T | |
| 19–20 | This document | T | |

---

## Final implementation summary

- `git diff --shortstat`: 83 tracked files changed, 2,059 insertions, 711 deletions; plus 61 new files (about 6,000
  lines: services, routes, components, two migrations, tests, one verification script, this document). None
  deleted. Nothing committed.
- Root causes confirmed in code: stock deducted at initialize and never released; no server notification on popup
  close; no paid-only filter on any order list; a racy confirmation step; every verify error mapped to 502; vendor
  approval notifications linking to the Business route; navbar offset and content padding on the same element.
- Verified by: 126 automated tests against a real local Postgres with faked providers, an 86-check real-browser run,
  a clean type check, lint at the baseline, and a passing production build.
- Before this is live you need to: apply the two migrations, set `ANTHROPIC_API_KEY` if Stewart should answer,
  confirm the Paystack webhook URL, and make one real test-mode payment and one cancelled payment to confirm the
  behaviour against Paystack itself.
