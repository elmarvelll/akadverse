-- Preserve authenticated exact bytes for reviewed synchronous redelivery; never expose them in status APIs.
BEGIN;
ALTER TABLE "RevisionWebhookIdempotency" ADD COLUMN IF NOT EXISTS "requestBody" BYTEA;
ALTER TABLE "RevisionQuestionProvenance" ADD COLUMN IF NOT EXISTS "dedupMetadata" JSONB;
COMMIT;
