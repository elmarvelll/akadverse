-- Additive, versioned E-Learning migration. No existing learning data is changed.
CREATE TABLE IF NOT EXISTS "RevisionWebhookIdempotency" (
  "id" TEXT PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "teachingEventId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "bodyHash" VARCHAR(64) NOT NULL,
  "requestBody" BYTEA,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "claimToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "responsePayload" TEXT,
  "lastFailureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "RevisionWebhookIdempotency_status_check" CHECK ("status" IN ('PROCESSING','COMPLETED')),
  CONSTRAINT "RevisionWebhookIdempotency_hash_check" CHECK ("bodyHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "RevisionWebhookIdempotency_completion_check" CHECK (
    ("status" = 'PROCESSING' AND "responsePayload" IS NULL AND "completedAt" IS NULL AND "claimToken" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
    OR ("status" = 'COMPLETED' AND "responsePayload" IS NOT NULL AND "completedAt" IS NOT NULL AND "claimToken" IS NULL AND "leaseExpiresAt" IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS "RevisionWebhookIdempotency_status_leaseExpiresAt_idx" ON "RevisionWebhookIdempotency"("status", "leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "RevisionWebhookIdempotency_teachingEventId_idx" ON "RevisionWebhookIdempotency"("teachingEventId");

ALTER TABLE "RevisionWebhookIdempotency" ADD COLUMN IF NOT EXISTS "requestBody" BYTEA;

-- Install checks even when prisma db push created the table before this patch ran.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"RevisionWebhookIdempotency"'::regclass AND conname = 'RevisionWebhookIdempotency_status_check') THEN
    ALTER TABLE "RevisionWebhookIdempotency" ADD CONSTRAINT "RevisionWebhookIdempotency_status_check" CHECK ("status" IN ('PROCESSING','COMPLETED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"RevisionWebhookIdempotency"'::regclass AND conname = 'RevisionWebhookIdempotency_hash_check') THEN
    ALTER TABLE "RevisionWebhookIdempotency" ADD CONSTRAINT "RevisionWebhookIdempotency_hash_check" CHECK ("bodyHash" ~ '^[a-f0-9]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"RevisionWebhookIdempotency"'::regclass AND conname = 'RevisionWebhookIdempotency_completion_check') THEN
    ALTER TABLE "RevisionWebhookIdempotency" ADD CONSTRAINT "RevisionWebhookIdempotency_completion_check" CHECK (
      ("status" = 'PROCESSING' AND "responsePayload" IS NULL AND "completedAt" IS NULL AND "claimToken" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
      OR ("status" = 'COMPLETED' AND "responsePayload" IS NOT NULL AND "completedAt" IS NOT NULL AND "claimToken" IS NULL AND "leaseExpiresAt" IS NULL)
    );
  END IF;
END $$;
