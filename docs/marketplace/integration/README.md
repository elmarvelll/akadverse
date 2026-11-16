# Marketplace synchronization engineering reports

Read the [final assessment](MARKETPLACE_FINAL_PARITY_REPORT.md) first. Code integration, migration, approved delivery pricing, Production configuration and staged build/HTTP checks are complete. Final domain promotion is paused for existing delivery-code key compatibility. Read [current rollout status](ROLLOUT_STATUS.md) first.

1. [Architecture and project discovery](MARKETPLACE_ARCHITECTURE_AUDIT.md)
2. [Feature parity matrix](MARKETPLACE_PARITY_MATRIX.md)
3. [Implementation and rollout report](MARKETPLACE_IMPLEMENTATION_REPORT.md)
4. [Tests, failures resolved and acceptance limits](MARKETPLACE_TEST_REPORT.md)
5. [Final parity assessment](MARKETPLACE_FINAL_PARITY_REPORT.md)
6. [Configured database readiness](DATABASE_READINESS.md)
7. [Approved production migration and verification](PRODUCTION_PRICING_MIGRATION.md)

Supporting evidence: [initial/final file inventory](SOURCE_INVENTORY.json), [changed files](CHANGED_FILES.txt), [browser assertions](BROWSER_RESULTS.json).

Focused commands:

```sh
npm run db:core:generate
# Set TEST_DATABASE_URL to an existing isolated localhost database ending in _test.
npm run test:marketplace:setup
npm run test:marketplace
npm run test:marketplace:browser
```

Never migrate or db-push `prisma/marketplace-runtime/schema.prisma`; it is generated for the runtime client. Public migrations remain public-owned and extension migrations retain their existing shared history. Production SQL requires approval.
