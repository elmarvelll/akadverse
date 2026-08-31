-- AlterTable
ALTER TABLE `Business` ADD COLUMN `contactInfo` VARCHAR(191) NULL,
    MODIFY `paymentMethod` VARCHAR(191) NULL,
    MODIFY `location` VARCHAR(191) NULL,
    MODIFY `serviceDays` VARCHAR(191) NULL,
    MODIFY `serviceTimes` VARCHAR(191) NULL;
