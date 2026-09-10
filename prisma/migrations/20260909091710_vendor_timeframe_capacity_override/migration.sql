-- CreateTable
CREATE TABLE "VendorTimeframeCapacityOverride" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorTimeframeCapacityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorTimeframeCapacityOverride_businessId_date_idx" ON "VendorTimeframeCapacityOverride"("businessId", "date");

-- CreateIndex
CREATE INDEX "VendorTimeframeCapacityOverride_slotId_date_idx" ON "VendorTimeframeCapacityOverride"("slotId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VendorTimeframeCapacityOverride_businessId_slotId_date_key" ON "VendorTimeframeCapacityOverride"("businessId", "slotId", "date");

-- AddForeignKey
ALTER TABLE "VendorTimeframeCapacityOverride" ADD CONSTRAINT "VendorTimeframeCapacityOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTimeframeCapacityOverride" ADD CONSTRAINT "VendorTimeframeCapacityOverride_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "VendorDeliverySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
