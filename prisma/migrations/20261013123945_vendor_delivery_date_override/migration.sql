-- Vendor delivery-date availability overrides (close a date / add a custom delivery date).
-- Purely additive: one new table + indexes + FK. Existing vendors have no rows and keep delivering every day.
-- Rollback: DROP TABLE "VendorDeliveryDateOverride";

-- CreateTable
CREATE TABLE "VendorDeliveryDateOverride" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "available" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorDeliveryDateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorDeliveryDateOverride_businessId_date_idx" ON "VendorDeliveryDateOverride"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VendorDeliveryDateOverride_businessId_date_key" ON "VendorDeliveryDateOverride"("businessId", "date");

-- AddForeignKey
ALTER TABLE "VendorDeliveryDateOverride" ADD CONSTRAINT "VendorDeliveryDateOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
