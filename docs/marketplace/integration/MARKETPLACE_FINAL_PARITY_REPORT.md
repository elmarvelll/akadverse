# Final Marketplace parity assessment

> **Latest rollout status:** Operator-supplied delivery fees are configured (₦500/₦650/₦800), with 12 active prices and the ₦150 service fee. The Production-target build and eight HTTP checks passed. Final promotion is held for existing delivery-code key compatibility and scoped diagnostic authorization; see [ROLLOUT_STATUS.md](ROLLOUT_STATUS.md). Earlier pending-price statements below describe the prior audit/migration stage.

> **Production follow-up:** The user subsequently approved the pricing migration. It was applied and verified on 2026-11-16; all seven migration checksums match. Three pricing tables and the ₦150 default now exist. Active delivery prices are still unconfigured. See [the approved migration report](PRODUCTION_PRICING_MIGRATION.md). Statements below about the initial pending migration or no production writes describe the pre-approval audit stage.

## Outcome

**Marketplace implementation, focused automated integration, and the approved production pricing migration are complete; pricing configuration and full production rollout/acceptance remain pending.** The 54-domain matrix and 544-file discovery inventory account for the compared reference functionality and target integration boundaries. The final Marketplace suite passed 230/230, selected main-platform boundary regressions passed 57/57, the Chromium workflow passed ten assertions, Prisma/TypeScript/lint checks passed, and the isolated normal production build passed. See MARKETPLACE_TEST_REPORT.md for exact scope and build timing caveat.

## Initial discrepancies and final resolution

| Feature group | Initial gap | Implementation | Verification |
|---|---|---|---|
| Catalog/grid/modal/cart/mobile interactions | Partial/older states and interactions | Explicit errors/retry, accessible product controls, side grouping, touch flyouts | Rendered tests and Chromium passed |
| Business delivery scheduling | Fixed estimates, no central plan/limits/overflow | Shared recurring roster, Lagos two-day lead, balanced regular/overflow plans | Database/concurrency/time-boundary tests passed |
| Business delivery pricing | Missing | Active business/range prices, flat checkout fee, quote review, financial snapshots, admin editor | Pricing/admin/payment tests passed; production schema applied; active delivery prices pending |
| Vendor operation capacity and cutoff | Partial/older cutoff | Roster limit/closures, strict minimum two-hour cutoff, independent vendor capacity | Capacity/schedule/date/checkout tests passed |
| Vendor delivery lifecycle | Older readiness/pickup flow | Assignment to processing, booking student code, no unnecessary pickup/check-in gate | Delivery and handover tests passed |
| Codes/offline/admin exceptions/overdue | Missing | Shared encrypted/HMAC codes, masked manifest, queue, replay protection, audited fallback and server-time deadline | Crypto/service/DB/rendered tests passed; physical offline-device acceptance pending |
| Deliverer account/payout management | Partial/missing | Server-resolved bank details, safe editing, held incomplete-account payouts | Payout/account/cron tests passed |
| Recurring admin roster and delivery overview | Missing | Business/Vendor separation, weekly/date editor, impact preview, explicit plan decisions | Roster/overview/admin UI tests passed |
| Cross-app payment settlement | Partial | Saved amount verification, capacity recheck, no duplicate settlement notices | Webhook/verify/race/expiry tests passed with fake provider |
| Marketplace user block | Missing | Shared AccountState checks scoped to Marketplace, main session retained | New access-boundary tests passed |
| Existing Business/Vendor ownership and seller operations | Already equivalent with target routing | Reused, extended only where necessary | Marketplace lifecycle/owner-access tests passed |
| Shared notification/outbox/jobs | Missing new triggers and reference-only briefing | Existing writers reused, transactional notices, mapped deep links, target briefing off by default | Fake email/notification/cron tests passed |
| Public schema/client ownership | Architectural conflict | Public source unchanged; generated transaction-capable runtime union | Prisma validation, local migrations and standalone schema-sync passed |

## Intentional architectural differences

- Root reference storefront/admin routes become `/studashboard/marketplace` and `/studashboard/admin/marketplace`. API paths retain their existing namespaces.
- Main NextAuth, academic roles, configured admin identity, DashboardNavbar and multi-domain admin shell remain. The standalone keeps its independent cookies/session version/throttle/startup safeguards. A main Marketplace block denies Marketplace access without signing out academics.
- Main retains the existing Skills placeholder; standalone hides it. No unsupported Skills purchase/backend was invented.
- One generated runtime client can transact across existing public and marketplace tables. Public migrations and the standalone schema-sync input are unchanged; extension migration history remains marketplace-owned.
- Existing main scheduled jobs and Vercel academic/AI schedules remain. Vendor briefing is not automatically duplicated: the target route is off until ownership is explicitly transferred.
- The target rejects malformed checkout field types with 400, maps blocked notification streams to 403, retains configured-admin block protection, and displays the quote-review notice alongside the stale-price error. These are deliberate validation/integration fixes, not removed reference business functionality.

## Production readiness constraints

Read-only inspection found six Marketplace migrations already applied and the pricing migration pending. DATABASE_READINESS.md records checksum comparisons. Pending SQL: `prisma/marketplace-schema/migrations/20261112120000_business_pricing/migration.sql`.

That migration creates three tables and initializes the default flat Business checkout fee to ₦150. There are no invented default delivery prices. New Business checkout needs active prices for each intended business/range. Approval is required before applying production SQL; no production changes were made.

Local delivery-code configuration was missing and the two apps' fallback login secrets differed. The target's ignored `.env.local` now has a new DELIVERY_CODE_SECRET matching the standalone's existing effective key. No existing variable or standalone file was changed. This preserves existing local shared codes and keeps login secrets independent. Deployed configuration still needs alignment and cross-app confirmation; rotating keys without a plan can invalidate outstanding codes.

Real external-provider operations, production cron ownership, deployment and physical-device acceptance remain unverified. Main academic/E-Learning/AI/productivity/auth source and schemas were not replaced, but only focused boundary regressions ran, per the user's testing constraint. No full regression-suite claim is made.

## Completion boundary

All identified code-level feature gaps in the matrix have an implementation or a documented intentional architecture boundary. Automated checks passed within the stated scope. **Do not call production functional parity verified until the pending migration/configuration and test-mode cross-app acceptance are completed.** No commits, pushes, deployment, destructive migrations or production record modifications were performed.

## Fresh file comparison

After implementation, the reference mapping was compared again with route/import normalization and TypeScript token comparison. Byte-identical files were accepted directly. All remaining non-boundary differences were individually reviewed below; there are no unexplained missing mapped files. Token equality is static evidence, not a substitute for the workflow tests.

| Target file | Intentional remaining difference |
|---|---|
| `services/marketplace/admin/block-user.ts` | Preserve configured admin-identity protection in addition to isAdmin. |
| `services/marketplace/admin/get-user-detail.ts` | Retain academic role in the user-detail contract alongside Marketplace account state. |
| `services/marketplace/admin/search-users.ts` | Retain academic role in user-search responses. |
| `services/marketplace/notifications/email.service.ts` | Marketplace block wording preserves main-platform sign-in; internal routes are mapped. |
| `src/app/api/marketplace/checkout/initialize/route.controller.ts` | Reject malformed typed input with 400 before any payment work. |
| `src/app/api/marketplace/notifications/stream/route.ts` | Return mapped 403 for blocked Marketplace sessions. |
| `src/app/api/marketplace/vendor-checkout/initialize/route.controller.ts` | Reject malformed typed input with 400 before any payment work. |
| `src/app/studashboard/marketplace/_components/MarketplaceNavbar.tsx` | Secondary sticky navbar below existing main DashboardNavbar. |
| `src/app/studashboard/admin/marketplace/users/[userId]/page.tsx` | Preserve academic role display alongside block controls. |
| `src/app/studashboard/admin/marketplace/users/page.tsx` | Preserve academic role in user-list contract. |
| `src/app/studashboard/marketplace/checkout/page.tsx` | Show review/reconfirm instruction alongside stale-quote error; Chromium verified. |
| `src/app/studashboard/marketplace/explore/page.tsx` | Retain main DashboardNavbar above Marketplace navigation. |
| `src/app/studashboard/marketplace/page.tsx` | Retain main DashboardNavbar above Marketplace navigation. |
| `src/app/studashboard/marketplace/vendor/[id]/page.tsx` | Retain main DashboardNavbar above Marketplace navigation. |
