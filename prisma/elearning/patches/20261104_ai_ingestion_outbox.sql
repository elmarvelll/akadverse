-- Additive E-Learning production patch. Safe to rerun after db push or a prior application.
-- Does not modify Core/Marketplace or remove existing rows/tables/columns.
-- Run with the production ELEARNING_DIRECT_URL, never the Core DATABASE_URL.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TYPE "AiIngestStatus" ADD VALUE IF NOT EXISTS 'RETRY_PENDING';
ALTER TYPE "AiIngestStatus" ADD VALUE IF NOT EXISTS 'UNSUPPORTED_FORMAT';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiIngestTask" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "AiIngestTask_documentId_key" ON "AiIngestTask"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AiIngestTask_materialId_key" ON "AiIngestTask"("materialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiIngestTask_state_nextAttemptAt_idx" ON "AiIngestTask"("state", "nextAttemptAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AiIngestTask_materialId_fkey'
      AND conrelid = '"AiIngestTask"'::regclass
  ) THEN
    ALTER TABLE "AiIngestTask" ADD CONSTRAINT "AiIngestTask_materialId_fkey"
      FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
