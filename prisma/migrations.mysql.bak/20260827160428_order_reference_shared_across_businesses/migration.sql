-- DropIndex
DROP INDEX `Order_paystackReference_key` ON `Order`;

-- CreateIndex
CREATE INDEX `Order_paystackReference_idx` ON `Order`(`paystackReference`);
