# Approved production pricing migration

> **Latest rollout status:** Operator-supplied delivery fees are configured (₦500/₦650/₦800), with 12 active prices and the ₦150 service fee. The Production-target build and eight HTTP checks passed. Final promotion is held for existing delivery-code key compatibility and scoped diagnostic authorization; see [ROLLOUT_STATUS.md](ROLLOUT_STATUS.md). Earlier pending-price statements below describe the prior audit/migration stage.

Applied after explicit user approval on 2026-11-16. Database-confirmed completion: `2026-11-16T16:39:12.732Z`.

## Applied change

The existing guarded standalone Marketplace migrator applied only `20261112120000_business_pricing`. Preflight confirmed the same configured AkadVerse Core database, its production marker, six matching applied migration checksums, and exactly this one pending migration. The shared migration history remains in `marketplace._prisma_migrations`; no public migration history was rewritten.

Created in schema `marketplace`:

- `BusinessDeliveryPrice`
- `BusinessPricingSettings`
- `CheckoutFinancialSnapshot`

The singleton pricing setting has `serviceFeeKobo=15000` (₦150). No delivery prices or financial snapshots were fabricated. Existing business, product, order, payment, user and academic records were not modified by this change. No deployment, commit or push was performed.

## Required grant target

The first read-only preflight stopped before changes because `marketplace_app`, named in the migration's GRANT statements, did not exist. The standalone runs in its existing full-access mode. Created only the missing non-login grant target, with no password, elevated attributes or role memberships, so the exact approved SQL/checksum could be retained.

After migration the role has exactly eight explicit table grants: SELECT/INSERT/UPDATE on the two pricing configuration tables and SELECT/INSERT on snapshots. It has no explicit grants on existing public tables and cannot log in. Runtime connection/session configuration was not changed or switched to this role.

## Verification

- All three tables exist.
- Applied migration checksum matches the reviewed SQL; finished migration record exists.
- ₦150 service-fee default verified through the runtime Prisma client.
- Delivery-price count: **0**; financial-snapshot count: **0**.
- Expected primary/unique/foreign-key/check constraints exist.
- Grant-target login/privilege attributes and explicit table grants verified read-only.
- Existing `scripts/db-verify.ts` passed against production in the standalone's existing full-access configuration. That verifier intentionally skips restricted-role privilege-shape checks in full-access mode; the new role's grants were checked separately.

Structured evidence: [PRODUCTION_PRICING_MIGRATION_RESULT.json](PRODUCTION_PRICING_MIGRATION_RESULT.json).

## Remaining rollout work

Configure active delivery-range prices for intended Business/range pairs using Admin → Marketplace → Businesses → business profile → Delivery & Pricing. Business checkout intentionally stays unavailable until active prices are configured. No fee amounts were guessed. Deployment/environment alignment and test-mode cross-app payment/code acceptance remain separate pending rollout steps. A running development process may need restarting to load the regenerated Prisma client.
