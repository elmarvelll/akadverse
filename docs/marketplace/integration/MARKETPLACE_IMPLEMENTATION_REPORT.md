# Marketplace implementation report

> **Latest rollout status:** Operator-supplied delivery fees are configured (₦500/₦650/₦800), with 12 active prices and the ₦150 service fee. The Production-target build and eight HTTP checks passed. Final promotion is held for existing delivery-code key compatibility and scoped diagnostic authorization; see [ROLLOUT_STATUS.md](ROLLOUT_STATUS.md). Earlier pending-price statements below describe the prior audit/migration stage.

> **Production follow-up:** The user subsequently approved the pricing migration. It was applied and verified on 2026-11-16; all seven migration checksums match. Three pricing tables and the ₦150 default now exist. Active delivery prices are still unconfigured. See [the approved migration report](PRODUCTION_PRICING_MIGRATION.md). Statements below about the initial pending migration or no production writes describe the pre-approval audit stage.

## Scope

Implemented the gaps in MARKETPLACE_PARITY_MATRIX.md using the reference domain logic, adapted routes/authentication and preserved main-platform boundaries. `CHANGED_FILES.txt` lists the concrete changed/new files. Source inventory includes initial classifications and hashes of the reference working tree. No source changes, commits, pushes or deployments were made in the standalone repository.

## Main implementation groups

- `services/marketplace/delivery-roster/`: slot/weekly/date resolution, capacity and locks, plans, changes/impact, overview, dispatch suggestions and overflow notifications.
- `services/marketplace/vendor-delivery/handover/` and `slot-briefing.ts`: booking codes, assigned manifest, server verification, admin fallback, overdue flags, check-in and handover acknowledgements.
- `services/marketplace/pricing/business-pricing.ts` and Business checkout: priced selections, integer-kobo totals, reviewed fingerprints, immutable snapshots, atomic stock/slot/payment records. The expected payment amount remains authoritative.
- Existing Marketplace checkout/payment/order/delivery/deliverer/admin services extended in place. Public product/cart/variant/vendor capacity/escrow/payout utilities reused wherever equivalent.
- `src/app/api/marketplace/`: new roster/operations/overview/planning, manifest/schedule/payout-account, booking-code, user block and pricing/financial routes. Existing ownership guards and business/vendor separation retained.
- `src/app/studashboard/marketplace/`: retryable grids, mobile/touch navigation, grouped Vendor sides, product modal confirmation/errors, Business quote selector, buyer handover codes and deliverer panels/cards/offline queue/payout account. The original dashboard navigation and Skills placeholder remain.
- `src/app/studashboard/admin/marketplace/`: delivery overview with separate Business/Vendor views, recurring/date roster editor, impact choices, operations/code exceptions and delivery pricing/financials. Main admin layout/sidebar and unrelated modules unchanged.
- Scoped `src/lib/marketplace-{session,admin,controller-helpers}.ts`: main NextAuth retained; account state rechecked only for Marketplace; database admin grants re-read while preserving configured admin identity and faculty admins. Shared core auth/helpers/proxy were not replaced.
- `src/lib/delivery-code.ts`, `delivery-schedule.ts`, `account-state.ts`: compatible shared extension helpers. Account-block email wording is adapted to main-platform access instead of falsely claiming global sign-out.
- Checkout request shapes now reject malformed typed fields before any payment work; blocked notification SSE maps ServiceError to 403.

## Database ownership and deployment

No existing public model, field, enum, relation or public migration was changed. `prisma/schema.prisma` is identical to the starting version. `scripts/generate-core-prisma.mjs` composes one runtime client from public models and shared extension models. `predev`, `build`, and `postinstall` now generate this union before the independent E-Learning client. Use `npm run db:core:generate` instead of a bare default-schema `prisma generate`. Generated union is ignored. Never use migrate/db push on it.

Seven exact reference extension migrations are staged under `prisma/marketplace-schema/migrations`. They create/extend the existing shared marketplace schema/history rather than new public copies. They were applied only to an isolated local test database. Production may already have some/all migrations: inspect its existing history first, preserve checksums, and apply only pending migration files through the established standalone guarded migrator. Do not insert a second copy into public._prisma_migrations or baseline existing tables blindly. Missing restricted-role provisioning, migration history drift or deployed-schema drift must be reviewed before applying.

The modeled extension tables are: AccountState, AuthThrottle, MarketplaceInstance, DeliveryRosterSettings, CentralDeliverySlot, RosterSlotDay, RosterAssignment, RosterException, ScheduledDelivery, DeliveryHandoverCode, DeliveryCodeSubmission, SlotBriefingNotice, DeliveryCardHandover, DeliveryShiftCheckIn, DeliveryConfirmationOverdue, BusinessDeliveryPrice, BusinessPricingSettings, CheckoutFinancialSnapshot. These are shared schema-qualified records, not a second source of truth. AuthThrottle/MarketplaceInstance remain standalone infrastructure and are not used to replace main auth.

Migration consequences: additive tables/types/indexes/checks, isOverflow default false, and Business price references that RESTRICT deletion of a priced business/slot. No existing order/plan is moved or deleted. Default flat Business service fee is ₦150. Missing active delivery prices disable new Business checkout. Existing initialized payments must continue verification against their saved amount. Root app code treats snapshots as append-only and the restricted standalone role cannot update/delete them; a privileged database owner can still alter them. This is not a claim of owner-proof immutability.

## Environment and operations

No existing local/deployed secret was overwritten. A missing local DELIVERY_CODE_SECRET was added to ignored `.env.local`, using the standalone's existing effective key; its login secret and files remain unchanged. This resolves the observed local fallback-key mismatch. Deployed keys were not changed. `.env.example` documents `DELIVERY_CODE_SECRET` and `MARKETPLACE_VENDOR_BRIEFING_ENABLED=false`. Both apps MUST use the same existing delivery-code key. Because their NextAuth secrets are intentionally different, fallback to each app's NEXTAUTH_SECRET is not a valid cross-app rollout strategy. If existing codes used the standalone fallback, preserve that key in DELIVERY_CODE_SECRET or deliberately reissue outstanding codes after a reviewed rotation. Never expose it as NEXT_PUBLIC_. Production key compatibility has not been inspected.

Keep existing DATABASE_URL/DIRECT_URL, Paystack mode/secret/public keys, Cloudinary, Resend, NextAuth, CRON_SECRET and configured admin identities. Public support contact is NEXT_PUBLIC_SUPPORT_EMAIL. Keep the pooled/direct distinction. No E-Learning environment changes.

Vendor briefing is OFF in AkadVerse unless MARKETPLACE_VENDOR_BRIEFING_ENABLED=true. Keep it off while the standalone owns its scheduler. Other existing main scheduled routes and Vercel academic/AI jobs remain unchanged. If ownership moves, disable the old scheduled invocation before enabling the target and configure a 5–10-minute authenticated external scheduler. No duplicate Vercel schedule was introduced.

## Rollout and rollback

Before production: obtain approval for the concrete pending SQL, inspect/apply the shared extension history with its guard, align delivery-code key, configure active Business/range prices and service fee, run test-mode cross-app checkout/code verification, select one job owner, regenerate both clients through their own build process and deploy coordinated code. No live DB writes or production deployment were performed here.

Rollback must retain financial/payment/code/plan records. Stop new initialization before reverting fee logic; keep already initialized payment verification available. Do not drop the marketplace schema, reset public data, reconstruct historical fees speculatively, or invalidate outstanding codes by changing keys silently.

## Verification tools

`npm run test:marketplace` is the focused Marketplace suite. `TEST_DATABASE_URL=<existing localhost *_test DB> npm run test:marketplace:setup` applies both histories only to that isolated test database. The browser runner now generates its own Tailwind stylesheet and can be run with `npm run test:marketplace:browser`. The setup script refuses non-loopback/non-test URLs and never loads deployment environment files. Fake Paystack account/transfer support was added to the shared test helper while preserving its existing AI/Storage fakes.
