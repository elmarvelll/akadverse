-- Re-adds Business.bankCode, previously dropped in
-- 20260827145403_remove_business_bank_code (back when nothing needed it —
-- see prisma/migrations/20260827145403_remove_business_bank_code/migration.sql).
-- The seller-payout system (src/lib/seller-payout.ts) now needs it: creating
-- a Paystack transfer recipient requires the bank *code*, not just the bank
-- name shown in the UI. See
-- docs/marketplace/decisions/business-bank-code-reintroduced.md for why
-- this reverses the earlier removal rather than working around it.
ALTER TABLE `Business` ADD COLUMN `bankCode` VARCHAR(191) NULL;
