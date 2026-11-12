-- Data migration, hand-added ahead of the generated schema diff below.
-- `Order.status` is moving from a free-text column (only ever "pending" or
-- "processing" in practice — see src/lib/order-fulfillment.ts) to the new
-- OrderStatus enum (PENDING_SELLER/ACCEPTED/REJECTED/CANCELLED). Existing
-- rows must be translated before the column type changes, or the ALTER
-- below fails/silently truncates unrecognized values under MySQL. Mapping:
--   "pending"    -> PENDING_SELLER (payment not yet confirmed; unchanged meaning)
--   "processing" -> ACCEPTED, with fulfillmentStatus = PROCESSING (this is
--                   what "processing" meant pre-migration: payment
--                   confirmed, order being worked — there was no seller
--                   accept/reject step yet, so the closest honest mapping
--                   is "implicitly accepted, now in seller processing").
UPDATE `Order` SET `status` = 'processing_tmp' WHERE `status` = 'processing';

-- DropIndex
DROP INDEX `Order_escrowReleased_escrowReleaseAt_idx` ON `Order`;

-- AlterTable
ALTER TABLE `Business` ADD COLUMN `deliveryRestricted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `deliveryRestrictedAt` DATETIME(3) NULL,
    ADD COLUMN `lateDeliveryCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable: widen `status` to fit the temporary marker used above before
-- narrowing it down to the real enum values.
ALTER TABLE `Order` MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'pending';
UPDATE `Order` SET `status` = 'pending' WHERE `status` = 'pending';

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `deliveryOtp`,
    DROP COLUMN `deliveryOtpAttempts`,
    DROP COLUMN `deliveryOtpExpiry`,
    DROP COLUMN `escrowFailureReason`,
    DROP COLUMN `escrowReleaseAt`,
    DROP COLUMN `escrowReleaseStatus`,
    DROP COLUMN `escrowReleased`,
    DROP COLUMN `escrowReleasedAt`,
    DROP COLUMN `escrowTransferCode`,
    DROP COLUMN `escrowTransferReference`,
    DROP COLUMN `expectedDeliveryDate`,
    DROP COLUMN `shipOtp`,
    DROP COLUMN `shipOtpExpiry`,
    ADD COLUMN `acceptedAt` DATETIME(3) NULL,
    ADD COLUMN `autoRejected` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cancellationReason` TEXT NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `delivererConfirmedPickupAt` DATETIME(3) NULL,
    ADD COLUMN `deliveryOutcome` ENUM('PENDING', 'DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `deliveryWindowEnd` DATETIME(3) NULL,
    ADD COLUMN `deliveryWindowStart` DATETIME(3) NULL,
    ADD COLUMN `estimatedDeliveryAt` DATETIME(3) NULL,
    ADD COLUMN `fulfillmentStatus` ENUM('PROCESSING', 'READY_FOR_PICKUP', 'HANDED_TO_DELIVERER') NULL,
    ADD COLUMN `pickupScheduledAt` DATETIME(3) NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `sellerDroppedOffAt` DATETIME(3) NULL,
    ADD COLUMN `sellerMarkedReadyAt` DATETIME(3) NULL;

-- Translate the free-text values to the new enum's literal names, and
-- backfill fulfillmentStatus for orders that were implicitly "processing".
UPDATE `Order` SET `status` = 'PENDING_SELLER' WHERE `status` = 'pending';
UPDATE `Order` SET `status` = 'ACCEPTED', `fulfillmentStatus` = 'PROCESSING', `acceptedAt` = `createdAt` WHERE `status` = 'processing_tmp';

-- Now safe to narrow the column to the real enum.
ALTER TABLE `Order` MODIFY `status` ENUM('PENDING_SELLER', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_SELLER';

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `cancellationReason` TEXT NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `deliveryAttempted` ENUM('PENDING', 'TRUE', 'FALSE') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `deliveryConfirmedAt` DATETIME(3) NULL,
    ADD COLUMN `deliveryOtp` VARCHAR(191) NULL,
    ADD COLUMN `deliveryOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `deliveryOtpExpiry` DATETIME(3) NULL,
    ADD COLUMN `deliveryStatus` ENUM('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'FAILED', 'RETURNED') NULL,
    ADD COLUMN `escrowStatus` ENUM('HELD', 'REFUND_PENDING', 'REFUNDED', 'PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAID_OUT') NOT NULL DEFAULT 'HELD',
    ADD COLUMN `failedDeliveryAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `payoutAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `payoutFailedAt` DATETIME(3) NULL,
    ADD COLUMN `payoutFailureReason` TEXT NULL,
    ADD COLUMN `payoutProcessingAt` DATETIME(3) NULL,
    ADD COLUMN `payoutReference` VARCHAR(191) NULL,
    ADD COLUMN `payoutStatus` ENUM('PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAYOUT_SUCCESS', 'PAYOUT_FAILED') NULL,
    ADD COLUMN `payoutSucceededAt` DATETIME(3) NULL,
    ADD COLUMN `refundReference` VARCHAR(191) NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `retryDeliveryAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Deliverer` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `suspendedAt` DATETIME(3) NULL,
    `suspensionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Deliverer_userId_key`(`userId`),
    INDEX `Deliverer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Delivery` (
    `id` VARCHAR(191) NOT NULL,
    `deliverymanId` VARCHAR(191) NOT NULL,
    `expectedDeliveryAt` DATETIME(3) NULL,
    `status` ENUM('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'FAILED', 'RETURNED') NOT NULL DEFAULT 'ASSIGNED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Delivery_deliverymanId_idx`(`deliverymanId`),
    INDEX `Delivery_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryItem` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'FAILED', 'RETURNED') NOT NULL DEFAULT 'ASSIGNED',
    `businessId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeliveryItem_orderItemId_key`(`orderItemId`),
    INDEX `DeliveryItem_deliveryId_idx`(`deliveryId`),
    INDEX `DeliveryItem_businessId_idx`(`businessId`),
    INDEX `DeliveryItem_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Delivery_x_businesses` (
    `id` VARCHAR(191) NOT NULL,
    `deliverymanId` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `deliveryStatus` ENUM('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'FAILED', 'RETURNED') NOT NULL DEFAULT 'ASSIGNED',
    `expectedDeliveryAt` DATETIME(3) NULL,
    `pickupOtp` VARCHAR(191) NULL,
    `pickupOtpExpiry` DATETIME(3) NULL,
    `pickupOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    `delivererConfirmedPickupAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Delivery_x_businesses_deliverymanId_idx`(`deliverymanId`),
    INDEX `Delivery_x_businesses_businessId_idx`(`businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NULL,
    `type` ENUM('ORDER_CREATED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'SELLER_REJECTED', 'SELLER_AUTO_REJECTED', 'SELLER_PROCESSING', 'SELLER_MARKED_READY', 'SELLER_DROPPED_OFF', 'SELLER_MISSED_DROPOFF_DEADLINE', 'DELIVERER_ASSIGNED', 'DELIVERER_PICKUP_OTP_ISSUED', 'DELIVERER_PICKUP_OTP_VERIFIED', 'DELIVERER_CONFIRMED_PICKUP', 'HANDED_TO_DELIVERER', 'OUT_FOR_DELIVERY', 'BUYER_DELIVERY_OTP_ISSUED', 'BUYER_OTP_VERIFICATION_ATTEMPTED', 'BUYER_OTP_VERIFIED', 'DELIVERY_ATTEMPTED', 'DELIVERY_FAILED', 'DELIVERY_RETRY_SCHEDULED', 'RETURNED_TO_DROPOFF', 'DELIVERED', 'PARTIALLY_DELIVERED', 'ITEM_CANCELLED', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAYOUT_SUCCESS', 'PAYOUT_FAILED', 'LATE_DELIVERY_FINE_ISSUED', 'LATE_DELIVERY_FINE_PAID', 'BUSINESS_DELIVERY_RESTRICTED', 'BUSINESS_DELIVERY_UNRESTRICTED') NOT NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderEvent_orderId_idx`(`orderId`),
    INDEX `OrderEvent_orderItemId_idx`(`orderItemId`),
    INDEX `OrderEvent_type_idx`(`type`),
    INDEX `OrderEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessDeliveryDay` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `day` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,

    INDEX `BusinessDeliveryDay_businessId_idx`(`businessId`),
    UNIQUE INDEX `BusinessDeliveryDay_businessId_day_key`(`businessId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LateDeliveryFine` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `paystackReference` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LateDeliveryFine_businessId_idx`(`businessId`),
    INDEX `LateDeliveryFine_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Business_deliveryRestricted_idx` ON `Business`(`deliveryRestricted`);

-- CreateIndex
CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `Order_fulfillmentStatus_sellerDroppedOffAt_idx` ON `Order`(`fulfillmentStatus`, `sellerDroppedOffAt`);

-- CreateIndex
CREATE INDEX `OrderItem_deliveryStatus_idx` ON `OrderItem`(`deliveryStatus`);

-- CreateIndex
CREATE INDEX `OrderItem_escrowStatus_idx` ON `OrderItem`(`escrowStatus`);

-- CreateIndex
CREATE INDEX `OrderItem_payoutStatus_idx` ON `OrderItem`(`payoutStatus`);

-- CreateIndex
CREATE INDEX `OrderItem_retryDeliveryAt_idx` ON `OrderItem`(`retryDeliveryAt`);

-- AddForeignKey
ALTER TABLE `Deliverer` ADD CONSTRAINT `Deliverer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery` ADD CONSTRAINT `Delivery_deliverymanId_fkey` FOREIGN KEY (`deliverymanId`) REFERENCES `Deliverer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryItem` ADD CONSTRAINT `DeliveryItem_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `Delivery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryItem` ADD CONSTRAINT `DeliveryItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryItem` ADD CONSTRAINT `DeliveryItem_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery_x_businesses` ADD CONSTRAINT `Delivery_x_businesses_deliverymanId_fkey` FOREIGN KEY (`deliverymanId`) REFERENCES `Deliverer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery_x_businesses` ADD CONSTRAINT `Delivery_x_businesses_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessDeliveryDay` ADD CONSTRAINT `BusinessDeliveryDay_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LateDeliveryFine` ADD CONSTRAINT `LateDeliveryFine_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
