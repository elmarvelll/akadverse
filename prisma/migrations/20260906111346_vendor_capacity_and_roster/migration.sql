-- CreateEnum
CREATE TYPE "RosterAssignmentStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "VendorTimeframeCapacity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorTimeframeCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelivererRosterAssignment" (
    "id" TEXT NOT NULL,
    "delivererId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "RosterAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelivererRosterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorTimeframeCapacity_businessId_idx" ON "VendorTimeframeCapacity"("businessId");

-- CreateIndex
CREATE INDEX "VendorTimeframeCapacity_slotId_idx" ON "VendorTimeframeCapacity"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorTimeframeCapacity_businessId_slotId_key" ON "VendorTimeframeCapacity"("businessId", "slotId");

-- CreateIndex
CREATE INDEX "DelivererRosterAssignment_delivererId_idx" ON "DelivererRosterAssignment"("delivererId");

-- CreateIndex
CREATE INDEX "DelivererRosterAssignment_slotId_date_idx" ON "DelivererRosterAssignment"("slotId", "date");

-- CreateIndex
CREATE INDEX "DelivererRosterAssignment_date_idx" ON "DelivererRosterAssignment"("date");

-- AddForeignKey
ALTER TABLE "VendorTimeframeCapacity" ADD CONSTRAINT "VendorTimeframeCapacity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTimeframeCapacity" ADD CONSTRAINT "VendorTimeframeCapacity_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "VendorDeliverySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelivererRosterAssignment" ADD CONSTRAINT "DelivererRosterAssignment_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "Deliverer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelivererRosterAssignment" ADD CONSTRAINT "DelivererRosterAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "VendorDeliverySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
