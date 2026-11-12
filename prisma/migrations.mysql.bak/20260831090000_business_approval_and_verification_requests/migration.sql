-- AlterTable
ALTER TABLE `Business` ADD COLUMN `approvalStatus` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedBy` VARCHAR(191) NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL;

-- CreateTable
CREATE TABLE `BusinessVerificationRequest` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,

    INDEX `BusinessVerificationRequest_businessId_status_idx`(`businessId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Business_approvalStatus_idx` ON `Business`(`approvalStatus`);

-- AddForeignKey
ALTER TABLE `BusinessVerificationRequest` ADD CONSTRAINT `BusinessVerificationRequest_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather every business that existed before this migration to
-- APPROVED — the new PENDING_APPROVAL default only applies going forward,
-- to businesses created after this ships, so no current seller loses
-- marketplace access.
UPDATE `Business` SET `approvalStatus` = 'APPROVED';

