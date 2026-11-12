-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'faculty', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_SELLER', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PROCESSING', 'READY_FOR_PICKUP', 'HANDED_TO_DELIVERER');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "OrderDeliveryOutcome" AS ENUM ('PENDING', 'DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryAttempted" AS ENUM ('PENDING', 'TRUE', 'FALSE');

-- CreateEnum
CREATE TYPE "EscrowPaymentStatus" AS ENUM ('HELD', 'REFUND_PENDING', 'REFUNDED', 'PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAID_OUT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAYOUT_SUCCESS', 'PAYOUT_FAILED');

-- CreateEnum
CREATE TYPE "DelivererStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('ORDER_CREATED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'SELLER_REJECTED', 'SELLER_AUTO_REJECTED', 'SELLER_PROCESSING', 'SELLER_MARKED_READY', 'SELLER_DROPOFF_OTP_ISSUED', 'SELLER_DROPPED_OFF', 'COORDINATOR_RECEIVED', 'SELLER_MISSED_DROPOFF_DEADLINE', 'DELIVERER_ASSIGNED', 'DELIVERER_PICKUP_OTP_ISSUED', 'DELIVERER_PICKUP_OTP_VERIFIED', 'DELIVERER_CONFIRMED_PICKUP', 'HANDED_TO_DELIVERER', 'OUT_FOR_DELIVERY', 'BUYER_DELIVERY_OTP_ISSUED', 'BUYER_OTP_VERIFICATION_ATTEMPTED', 'BUYER_OTP_VERIFIED', 'DELIVERY_ATTEMPTED', 'DELIVERY_FAILED', 'DELIVERY_RETRY_SCHEDULED', 'RETURNED_TO_DROPOFF', 'DELIVERED', 'PARTIALLY_DELIVERED', 'ITEM_CANCELLED', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAYOUT_SUCCESS', 'PAYOUT_FAILED', 'LATE_DELIVERY_FINE_ISSUED', 'LATE_DELIVERY_FINE_PAID', 'BUSINESS_DELIVERY_RESTRICTED', 'BUSINESS_DELIVERY_UNRESTRICTED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED');

-- CreateEnum
CREATE TYPE "BusinessApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateEnum
CREATE TYPE "NotificationScope" AS ENUM ('MARKETPLACE', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "DelivererStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "deliverymanId" TEXT NOT NULL,
    "expectedDeliveryAt" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery_x_businesses" (
    "id" TEXT NOT NULL,
    "deliverymanId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
    "expectedDeliveryAt" TIMESTAMP(3),
    "pickupOtp" TEXT,
    "pickupOtpExpiry" TIMESTAMP(3),
    "pickupOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "delivererConfirmedPickupAt" TIMESTAMP(3),
    "pickupDeadlineReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_x_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "type" "OrderEventType" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDeliveryDay" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,

    CONSTRAINT "BusinessDeliveryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateDeliveryFine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "FineStatus" NOT NULL DEFAULT 'PENDING',
    "paystackReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LateDeliveryFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentNames" JSONB,
    "source" TEXT NOT NULL DEFAULT 'studashboard/essentials/suggestions',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "approvalStatus" "BusinessApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "public_id" TEXT,
    "secure_url" TEXT,
    "contactInfo" TEXT,
    "paymentMethod" TEXT,
    "bankName" TEXT,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "accountHolderName" TEXT,
    "paystackRecipientCode" TEXT,
    "location" TEXT,
    "serviceDays" TEXT,
    "serviceTimes" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "website" TEXT,
    "userId" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "deliveryRestricted" BOOLEAN NOT NULL DEFAULT false,
    "deliveryRestrictedAt" TIMESTAMP(3),
    "lateDeliveryCount" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "blockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessVerificationRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "BusinessVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "dropoffWindowStart" TEXT NOT NULL DEFAULT '17:00',
    "dropoffWindowEnd" TEXT NOT NULL DEFAULT '19:00',
    "handoffWindowStart" TEXT NOT NULL DEFAULT '15:00',
    "handoffWindowEnd" TEXT NOT NULL DEFAULT '16:00',
    "dropoffLocation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MarketplaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "image" TEXT,
    "public_id" TEXT,
    "secure_url" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantField" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantValue" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isCustomPrice" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantValueOnProductVariant" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,

    CONSTRAINT "VariantValueOnProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_SELLER',
    "rejectionReason" TEXT,
    "autoRejected" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "fulfillmentStatus" "FulfillmentStatus",
    "sellerMarkedReadyAt" TIMESTAMP(3),
    "pickupScheduledAt" TIMESTAMP(3),
    "dropoffOtp" TEXT,
    "dropoffOtpExpiry" TIMESTAMP(3),
    "dropoffOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "sellerDroppedOffAt" TIMESTAMP(3),
    "coordinatorReceivedAt" TIMESTAMP(3),
    "coordinatorReceivedBy" TEXT,
    "delivererConfirmedPickupAt" TIMESTAMP(3),
    "deliveryOutcome" "OrderDeliveryOutcome" NOT NULL DEFAULT 'PENDING',
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveryWindowStart" TIMESTAMP(3),
    "deliveryWindowEnd" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "disputeReason" TEXT,
    "disputeCreatedAt" TIMESTAMP(3),
    "disputeResolvedAt" TIMESTAMP(3),
    "disputeResolvedBy" TEXT,
    "disputeResolution" TEXT,
    "deliveryLocation" TEXT,
    "paystackReference" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "selectedVariants" TEXT,
    "variantId" TEXT,
    "variantName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "deliveryStatus" "DeliveryStatus",
    "deliveryAttempted" "DeliveryAttempted" NOT NULL DEFAULT 'PENDING',
    "failedDeliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "retryDeliveryAt" TIMESTAMP(3),
    "deliveryConfirmedAt" TIMESTAMP(3),
    "deliveryOtp" TEXT,
    "deliveryOtpExpiry" TIMESTAMP(3),
    "deliveryOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "escrowStatus" "EscrowPaymentStatus" NOT NULL DEFAULT 'HELD',
    "refundedAt" TIMESTAMP(3),
    "refundReference" TEXT,
    "payoutStatus" "PayoutStatus",
    "payoutAttempts" INTEGER NOT NULL DEFAULT 0,
    "payoutProcessingAt" TIMESTAMP(3),
    "payoutSucceededAt" TIMESTAMP(3),
    "payoutFailedAt" TIMESTAMP(3),
    "payoutFailureReason" TEXT,
    "payoutReference" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "NotificationScope" NOT NULL DEFAULT 'MARKETPLACE',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "businessId" TEXT,
    "orderId" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "expertiseLevel" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "profilePicture" TEXT,
    "profilePicturePublicId" TEXT,
    "startingPrice" DOUBLE PRECISION NOT NULL,
    "serviceDays" TEXT NOT NULL,
    "serviceTimes" TEXT NOT NULL,
    "mostActiveSocial" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "twitter" TEXT,
    "website" TEXT,
    "achievements" TEXT,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillOffer" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "offerFrom" TIMESTAMP(3) NOT NULL,
    "offerTo" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "skillOwnerAcceptedPrice" DOUBLE PRECISION,
    "buyerAcceptedPrice" DOUBLE PRECISION,
    "skillId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "fulfillmentOtp" TEXT,
    "fulfillmentOtpExpiry" TIMESTAMP(3),
    "fulfillmentOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputedBy" TEXT,
    "disputeReason" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCounterOffer" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "counterPrice" DOUBLE PRECISION NOT NULL,
    "madeBy" TEXT NOT NULL DEFAULT 'buyer',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillCounterOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillReview" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "sentiment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillNotification" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "selectedVariants" TEXT,
    "variantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3498db',
    "focus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3498db',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "ignoredAt" TIMESTAMP(3),
    "focus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_playlists" (
    "id" SERIAL NOT NULL,
    "student_id" VARCHAR(255) NOT NULL,
    "context" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "trigger_event" VARCHAR(255),

    CONSTRAINT "student_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deliverer_userId_key" ON "Deliverer"("userId");

-- CreateIndex
CREATE INDEX "Deliverer_status_idx" ON "Deliverer"("status");

-- CreateIndex
CREATE INDEX "Delivery_deliverymanId_idx" ON "Delivery"("deliverymanId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryItem_orderItemId_key" ON "DeliveryItem"("orderItemId");

-- CreateIndex
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryItem_businessId_idx" ON "DeliveryItem"("businessId");

-- CreateIndex
CREATE INDEX "DeliveryItem_status_idx" ON "DeliveryItem"("status");

-- CreateIndex
CREATE INDEX "Delivery_x_businesses_deliverymanId_idx" ON "Delivery_x_businesses"("deliverymanId");

-- CreateIndex
CREATE INDEX "Delivery_x_businesses_businessId_idx" ON "Delivery_x_businesses"("businessId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderItemId_idx" ON "OrderEvent"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderEvent_type_idx" ON "OrderEvent"("type");

-- CreateIndex
CREATE INDEX "OrderEvent_createdAt_idx" ON "OrderEvent"("createdAt");

-- CreateIndex
CREATE INDEX "BusinessDeliveryDay_businessId_idx" ON "BusinessDeliveryDay"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDeliveryDay_businessId_day_key" ON "BusinessDeliveryDay"("businessId", "day");

-- CreateIndex
CREATE INDEX "LateDeliveryFine_businessId_idx" ON "LateDeliveryFine"("businessId");

-- CreateIndex
CREATE INDEX "LateDeliveryFine_status_idx" ON "LateDeliveryFine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailConnection_userId_key" ON "EmailConnection"("userId");

-- CreateIndex
CREATE INDEX "EmailConnection_userId_idx" ON "EmailConnection"("userId");

-- CreateIndex
CREATE INDEX "Suggestion_userId_idx" ON "Suggestion"("userId");

-- CreateIndex
CREATE INDEX "Suggestion_category_idx" ON "Suggestion"("category");

-- CreateIndex
CREATE INDEX "Suggestion_status_idx" ON "Suggestion"("status");

-- CreateIndex
CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt");

-- CreateIndex
CREATE INDEX "Business_userId_idx" ON "Business"("userId");

-- CreateIndex
CREATE INDEX "Business_industry_idx" ON "Business"("industry");

-- CreateIndex
CREATE INDEX "Business_createdAt_idx" ON "Business"("createdAt");

-- CreateIndex
CREATE INDEX "Business_visitors_idx" ON "Business"("visitors");

-- CreateIndex
CREATE INDEX "Business_deliveryRestricted_idx" ON "Business"("deliveryRestricted");

-- CreateIndex
CREATE INDEX "Business_verified_idx" ON "Business"("verified");

-- CreateIndex
CREATE INDEX "Business_blocked_idx" ON "Business"("blocked");

-- CreateIndex
CREATE INDEX "Business_approvalStatus_idx" ON "Business"("approvalStatus");

-- CreateIndex
CREATE INDEX "BusinessVerificationRequest_businessId_status_idx" ON "BusinessVerificationRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessReport_businessId_idx" ON "BusinessReport"("businessId");

-- CreateIndex
CREATE INDEX "BusinessReport_reporterId_idx" ON "BusinessReport"("reporterId");

-- CreateIndex
CREATE INDEX "BusinessReport_status_idx" ON "BusinessReport"("status");

-- CreateIndex
CREATE INDEX "BusinessReport_createdAt_idx" ON "BusinessReport"("createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminId_idx" ON "AdminActionLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetType_targetId_idx" ON "AdminActionLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "Product_rating_idx" ON "Product"("rating");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "VariantField_productId_name_key" ON "VariantField"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VariantValue_fieldId_value_key" ON "VariantValue"("fieldId", "value");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "VariantValueOnProductVariant_valueId_idx" ON "VariantValueOnProductVariant"("valueId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantValueOnProductVariant_variantId_valueId_key" ON "VariantValueOnProductVariant"("variantId", "valueId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_businessId_idx" ON "Order"("businessId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_businessId_status_createdAt_idx" ON "Order"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paystackReference_idx" ON "Order"("paystackReference");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_sellerDroppedOffAt_idx" ON "Order"("fulfillmentStatus", "sellerDroppedOffAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_deliveryStatus_idx" ON "OrderItem"("deliveryStatus");

-- CreateIndex
CREATE INDEX "OrderItem_escrowStatus_idx" ON "OrderItem"("escrowStatus");

-- CreateIndex
CREATE INDEX "OrderItem_payoutStatus_idx" ON "OrderItem"("payoutStatus");

-- CreateIndex
CREATE INDEX "OrderItem_retryDeliveryAt_idx" ON "OrderItem"("retryDeliveryAt");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- CreateIndex
CREATE INDEX "Skill_visitors_idx" ON "Skill"("visitors");

-- CreateIndex
CREATE INDEX "Skill_createdAt_idx" ON "Skill"("createdAt");

-- CreateIndex
CREATE INDEX "SkillOffer_skillId_idx" ON "SkillOffer"("skillId");

-- CreateIndex
CREATE INDEX "SkillOffer_buyerId_idx" ON "SkillOffer"("buyerId");

-- CreateIndex
CREATE INDEX "SkillOffer_status_idx" ON "SkillOffer"("status");

-- CreateIndex
CREATE INDEX "SkillOffer_createdAt_idx" ON "SkillOffer"("createdAt");

-- CreateIndex
CREATE INDEX "SkillCounterOffer_offerId_idx" ON "SkillCounterOffer"("offerId");

-- CreateIndex
CREATE INDEX "SkillReview_buyerId_idx" ON "SkillReview"("buyerId");

-- CreateIndex
CREATE INDEX "SkillReview_skillId_idx" ON "SkillReview"("skillId");

-- CreateIndex
CREATE INDEX "SkillNotification_skillId_idx" ON "SkillNotification"("skillId");

-- CreateIndex
CREATE INDEX "CartItem_userId_idx" ON "CartItem"("userId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillType_name_key" ON "SkillType"("name");

-- CreateIndex
CREATE INDEX "SkillType_name_idx" ON "SkillType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Schedule_userId_idx" ON "Schedule"("userId");

-- CreateIndex
CREATE INDEX "Schedule_createdAt_idx" ON "Schedule"("createdAt");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_scheduleId_idx" ON "Task"("scheduleId");

-- CreateIndex
CREATE INDEX "Task_date_idx" ON "Task"("date");

-- CreateIndex
CREATE INDEX "Task_completed_idx" ON "Task"("completed");

-- CreateIndex
CREATE INDEX "Task_ignored_idx" ON "Task"("ignored");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "student_playlists_id_idx" ON "student_playlists"("id");

-- AddForeignKey
ALTER TABLE "Deliverer" ADD CONSTRAINT "Deliverer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_deliverymanId_fkey" FOREIGN KEY ("deliverymanId") REFERENCES "Deliverer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery_x_businesses" ADD CONSTRAINT "Delivery_x_businesses_deliverymanId_fkey" FOREIGN KEY ("deliverymanId") REFERENCES "Deliverer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery_x_businesses" ADD CONSTRAINT "Delivery_x_businesses_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDeliveryDay" ADD CONSTRAINT "BusinessDeliveryDay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateDeliveryFine" ADD CONSTRAINT "LateDeliveryFine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConnection" ADD CONSTRAINT "EmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessVerificationRequest" ADD CONSTRAINT "BusinessVerificationRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessReport" ADD CONSTRAINT "BusinessReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessReport" ADD CONSTRAINT "BusinessReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantField" ADD CONSTRAINT "VariantField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantValue" ADD CONSTRAINT "VariantValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "VariantField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantValueOnProductVariant" ADD CONSTRAINT "VariantValueOnProductVariant_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "VariantValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantValueOnProductVariant" ADD CONSTRAINT "VariantValueOnProductVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillOffer" ADD CONSTRAINT "SkillOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillOffer" ADD CONSTRAINT "SkillOffer_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCounterOffer" ADD CONSTRAINT "SkillCounterOffer_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SkillOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillNotification" ADD CONSTRAINT "SkillNotification_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

