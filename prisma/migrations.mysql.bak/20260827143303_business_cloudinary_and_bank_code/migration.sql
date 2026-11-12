/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `Business` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Business` DROP COLUMN `logoUrl`,
    ADD COLUMN `bankCode` VARCHAR(191) NULL,
    ADD COLUMN `public_id` VARCHAR(191) NULL,
    ADD COLUMN `secure_url` VARCHAR(191) NULL;
