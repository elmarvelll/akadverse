# Configured database readiness

> **Latest rollout status:** Operator-supplied delivery fees are configured (₦500/₦650/₦800), with 12 active prices and the ₦150 service fee. The Production-target build and eight HTTP checks passed. Final promotion is held for existing delivery-code key compatibility and scoped diagnostic authorization; see [ROLLOUT_STATUS.md](ROLLOUT_STATUS.md). Earlier pending-price statements below describe the prior audit/migration stage.

Initial read-only inspection on 2026-11-16 was followed by the user-approved pricing migration. All seven reviewed migrations are now applied; see [the production migration report](PRODUCTION_PRICING_MIGRATION.md).

| Migration | Status |
|---|---|
| 20261015120000_marketplace_schema_init | APPLIED_MATCHING_CHECKSUM |
| 20261017120000_delivery_rosters | APPLIED_MATCHING_CHECKSUM |
| 20261020120000_vendor_delivery_handover | APPLIED_MATCHING_CHECKSUM |
| 20261021120000_delivery_shift_check_in | APPLIED_MATCHING_CHECKSUM |
| 20261023120000_delivery_confirmation_overdue | APPLIED_MATCHING_CHECKSUM |
| 20261028120000_delivery_overflow | APPLIED_MATCHING_CHECKSUM |
| 20261112120000_business_pricing | APPLIED_MATCHING_CHECKSUM |

The approved and applied pricing migration created BusinessDeliveryPrice, BusinessPricingSettings and CheckoutFinancialSnapshot in the existing marketplace schema. It initialized a flat Business checkout service fee of 15000 kobo (₦150). There is no delivery-price backfill: intended business/range combinations need active prices before checkout can proceed. Explicit user approval was received before application. All seven migrations are now applied; do not replay them or alter their checksums. No active delivery prices have been configured yet.
