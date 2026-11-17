CREATE TYPE "BuddyKind" AS ENUM ('GROUP', 'REQUEST');
CREATE TYPE "BuddyStatus" AS ENUM ('OPEN', 'FULL', 'MATCHED', 'CLOSED');
CREATE TYPE "BuddyApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TABLE "BuddyListing" (
 "id" TEXT PRIMARY KEY, "creatorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "kind" "BuddyKind" NOT NULL, "title" VARCHAR(160) NOT NULL, "description" VARCHAR(4000) NOT NULL,
 "privateDetails" VARCHAR(2000) NOT NULL, "maxMembers" INTEGER,
 "status" "BuddyStatus" NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BuddyListing_capacity_check" CHECK ("maxMembers" IS NULL OR ("kind" = 'GROUP' AND "maxMembers" > 0)),
 CONSTRAINT "BuddyListing_kind_status_check" CHECK (("kind" = 'GROUP' AND "status" <> 'MATCHED') OR ("kind" = 'REQUEST' AND "status" <> 'FULL'))
);
CREATE TABLE "BuddyApplication" (
 "id" TEXT PRIMARY KEY, "listingId" TEXT NOT NULL REFERENCES "BuddyListing"("id") ON DELETE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "status" "BuddyApplicationStatus" NOT NULL DEFAULT 'PENDING', "contactDetails" VARCHAR(2000),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BuddyApplication_listingId_userId_key" ON "BuddyApplication"("listingId", "userId");
CREATE INDEX "BuddyListing_kind_status_createdAt_idx" ON "BuddyListing"("kind", "status", "createdAt");
CREATE INDEX "BuddyListing_creatorId_createdAt_idx" ON "BuddyListing"("creatorId", "createdAt");
CREATE INDEX "BuddyApplication_userId_status_createdAt_idx" ON "BuddyApplication"("userId", "status", "createdAt");
CREATE INDEX "BuddyApplication_listingId_status_idx" ON "BuddyApplication"("listingId", "status");
-- One-to-one matching and group capacity are serialized by locking the listing
-- row before every application transition. Unique membership also guards retries.
