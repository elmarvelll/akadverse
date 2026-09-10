-- CreateEnum
CREATE TYPE "DelivererPayoutStatus" AS ENUM ('PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAYOUT_SUCCESS', 'PAYOUT_FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('BUSINESS', 'SCHOOL_VENDOR');

-- CreateEnum
CREATE TYPE "VendorBookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "OrderDeliveryOutcome" ADD VALUE 'DELIVERED_PENDING_DISPUTE_WINDOW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_APPLICATION_SUBMITTED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_APPLICATION_APPROVED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_APPLICATION_REJECTED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_PAUSED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_UNPAUSED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_SLOT_BOOKED';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERER_STUDENT_OTP_VERIFIED';
ALTER TYPE "OrderEventType" ADD VALUE 'DISPUTE_WINDOW_STARTED';
ALTER TYPE "OrderEventType" ADD VALUE 'DISPUTE_WINDOW_ELAPSED';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERER_PAYOUT_PENDING';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERER_PAYOUT_PROCESSING';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERER_PAYOUT_SUCCESS';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERER_PAYOUT_FAILED';
ALTER TYPE "OrderEventType" ADD VALUE 'DELIVERER_PAYOUT_REJECTED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_ITEM_REFUND_INITIATED';
ALTER TYPE "OrderEventType" ADD VALUE 'VENDOR_ITEM_REFUND_COMPLETED';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "availabilityEnd" TEXT,
ADD COLUMN     "availabilityStart" TEXT,
ADD COLUMN     "paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedReason" TEXT,
ADD COLUMN     "type" "BusinessType" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "vendorCategory" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "sideId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Delivery_x_businesses" ADD COLUMN     "delivererPayoutAmount" DOUBLE PRECISION,
ADD COLUMN     "delivererPayoutFailedAt" TIMESTAMP(3),
ADD COLUMN     "delivererPayoutFailureReason" TEXT,
ADD COLUMN     "delivererPayoutProcessingAt" TIMESTAMP(3),
ADD COLUMN     "delivererPayoutReference" TEXT,
ADD COLUMN     "delivererPayoutStatus" "DelivererPayoutStatus",
ADD COLUMN     "delivererPayoutSucceededAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketplaceSettings" ADD COLUMN     "dropoffLocationActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dropoffLocationInstructions" TEXT,
ADD COLUMN     "dropoffLocationName" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "vendorDeliveryBookingId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sideId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "studentEmailLocalPart" TEXT,
ADD COLUMN     "studentEmailOtp" TEXT,
ADD COLUMN     "studentEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studentEmailOtpExpiry" TIMESTAMP(3),
ADD COLUMN     "studentEmailOtpLastSentAt" TIMESTAMP(3),
ADD COLUMN     "studentEmailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Side" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Side_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDeliveryBooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "paystackReference" TEXT NOT NULL,
    "deliveryFee" DOUBLE PRECISION NOT NULL,
    "status" "VendorBookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "bookedFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorDeliveryBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDeliverySlot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "windowStart" TEXT NOT NULL,
    "windowEnd" TEXT NOT NULL,
    "bookingCutoffMins" INTEGER NOT NULL DEFAULT 90,
    "vendorPrepDeadlineMins" INTEGER NOT NULL DEFAULT 30,
    "delivererCapacity" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorDeliverySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Side_businessId_idx" ON "Side"("businessId");

-- CreateIndex
CREATE INDEX "Side_available_idx" ON "Side"("available");

-- CreateIndex
CREATE INDEX "VendorDeliveryBooking_slotId_bookedFor_idx" ON "VendorDeliveryBooking"("slotId", "bookedFor");

-- CreateIndex
CREATE INDEX "VendorDeliveryBooking_paystackReference_idx" ON "VendorDeliveryBooking"("paystackReference");

-- CreateIndex
CREATE INDEX "VendorDeliveryBooking_status_idx" ON "VendorDeliveryBooking"("status");

-- CreateIndex
CREATE INDEX "VendorDeliveryBooking_userId_idx" ON "VendorDeliveryBooking"("userId");

-- CreateIndex
CREATE INDEX "VendorDeliverySlot_active_idx" ON "VendorDeliverySlot"("active");

-- CreateIndex
CREATE INDEX "Business_type_idx" ON "Business"("type");

-- CreateIndex
CREATE INDEX "CartItem_sideId_idx" ON "CartItem"("sideId");

-- CreateIndex
CREATE INDEX "Delivery_x_businesses_delivererPayoutStatus_idx" ON "Delivery_x_businesses"("delivererPayoutStatus");

-- CreateIndex
CREATE INDEX "Order_vendorDeliveryBookingId_idx" ON "Order"("vendorDeliveryBookingId");

-- CreateIndex
CREATE INDEX "OrderItem_sideId_idx" ON "OrderItem"("sideId");

-- AddForeignKey
ALTER TABLE "Side" ADD CONSTRAINT "Side_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorDeliveryBookingId_fkey" FOREIGN KEY ("vendorDeliveryBookingId") REFERENCES "VendorDeliveryBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDeliveryBooking" ADD CONSTRAINT "VendorDeliveryBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDeliveryBooking" ADD CONSTRAINT "VendorDeliveryBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "VendorDeliverySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sideId_fkey" FOREIGN KEY ("sideId") REFERENCES "Side"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_sideId_fkey" FOREIGN KEY ("sideId") REFERENCES "Side"("id") ON DELETE CASCADE ON UPDATE CASCADE;
