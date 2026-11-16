CREATE TABLE marketplace."BusinessDeliveryPrice" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "slotId" TEXT NOT NULL,
 "feeKobo" INTEGER NOT NULL CHECK ("feeKobo" >= 0), "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("slotId") REFERENCES marketplace."CentralDeliverySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 UNIQUE ("businessId", "slotId")
);
CREATE INDEX "BusinessDeliveryPrice_slotId_idx" ON marketplace."BusinessDeliveryPrice"("slotId");
CREATE TABLE marketplace."BusinessPricingSettings" (
 "id" TEXT PRIMARY KEY DEFAULT 'default', "serviceFeeKobo" INTEGER NOT NULL DEFAULT 15000 CHECK ("serviceFeeKobo" >= 0),
 "updatedAt" TIMESTAMP(3) NOT NULL, "updatedBy" TEXT
);
INSERT INTO marketplace."BusinessPricingSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
CREATE TABLE marketplace."CheckoutFinancialSnapshot" (
 "reference" TEXT PRIMARY KEY, "subtotalKobo" INTEGER NOT NULL, "deliveryFeeKobo" INTEGER NOT NULL,
 "serviceFeeKobo" INTEGER NOT NULL, "totalKobo" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'NGN',
 "orders" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("subtotalKobo" >= 0 AND "deliveryFeeKobo" >= 0 AND "serviceFeeKobo" >= 0),
 CHECK ("totalKobo" = "subtotalKobo" + "deliveryFeeKobo" + "serviceFeeKobo")
);
GRANT SELECT, INSERT, UPDATE ON marketplace."BusinessDeliveryPrice", marketplace."BusinessPricingSettings" TO marketplace_app;
GRANT SELECT, INSERT ON marketplace."CheckoutFinancialSnapshot" TO marketplace_app;
