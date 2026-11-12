-- Payment attempts (CheckoutPayment) + transactional email outbox (EmailDelivery).
-- Purely additive: two new tables, three enums, indexes, one FK. No existing table/column is altered, so it is safe
-- to apply before the code that uses it is deployed (old code simply never reads these tables).
-- Rollback: DROP TABLE "CheckoutPayment", "EmailDelivery"; DROP TYPE "CheckoutPaymentStatus", "CheckoutKind", "EmailDeliveryStatus";

-- CreateEnum
CREATE TYPE "CheckoutPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'ABANDONED', 'EXPIRED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CheckoutKind" AS ENUM ('BUSINESS', 'VENDOR');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "CheckoutPayment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CheckoutKind" NOT NULL,
    "status" "CheckoutPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "cartItemIds" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stockReleasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "providerStatus" TEXT,
    "providerCheckedAt" TIMESTAMP(3),
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutPayment_reference_key" ON "CheckoutPayment"("reference");

-- CreateIndex
CREATE INDEX "CheckoutPayment_status_expiresAt_idx" ON "CheckoutPayment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CheckoutPayment_userId_status_idx" ON "CheckoutPayment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_dedupeKey_key" ON "EmailDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "CheckoutPayment" ADD CONSTRAINT "CheckoutPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
