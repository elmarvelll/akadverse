-- CreateIndex
CREATE INDEX `BusinessReport_reporterId_idx` ON `BusinessReport`(`reporterId`);

-- AddForeignKey
ALTER TABLE `BusinessReport` ADD CONSTRAINT `BusinessReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

