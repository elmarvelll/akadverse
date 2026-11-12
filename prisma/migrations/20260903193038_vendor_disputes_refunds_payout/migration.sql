-- AlterTable
ALTER TABLE "Deliverer" ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "paystackRecipientCode" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredPendingDisputeAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "refundFailureReason" TEXT,
ADD COLUMN     "refundInitiatedBy" TEXT,
ADD COLUMN     "refundReason" TEXT;
