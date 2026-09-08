-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "serviceFeeExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Side" ADD COLUMN     "serviceFeeExempt" BOOLEAN NOT NULL DEFAULT true;
