-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiIngestStatus" ADD VALUE 'RETRY_PENDING';
ALTER TYPE "AiIngestStatus" ADD VALUE 'UNSUPPORTED_FORMAT';

-- CreateTable
CREATE TABLE "AiIngestTask" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "materialId" TEXT,
    "operation" TEXT NOT NULL DEFAULT 'INGEST',
    "state" TEXT NOT NULL DEFAULT 'READY',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "callbackAt" TIMESTAMP(3),
    "cleanupUncertain" BOOLEAN NOT NULL DEFAULT false,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "claimToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiIngestTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiIngestTask_documentId_key" ON "AiIngestTask"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "AiIngestTask_materialId_key" ON "AiIngestTask"("materialId");

-- CreateIndex
CREATE INDEX "AiIngestTask_state_nextAttemptAt_idx" ON "AiIngestTask"("state", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "AiIngestTask" ADD CONSTRAINT "AiIngestTask_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
