-- Apply to the E-Learning database before deploying the new Stewart routes.
-- Binaries are never stored here. The service's expires_at controls usability.
BEGIN;
CREATE TABLE IF NOT EXISTS "StewartAttachment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "uploadKey" TEXT NOT NULL,
  "attachmentId" TEXT,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'uploading',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "inUseUntil" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "StewartAttachment_attachmentId_key" ON "StewartAttachment"("attachmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "StewartAttachment_sessionId_uploadKey_key" ON "StewartAttachment"("sessionId", "uploadKey");
CREATE INDEX IF NOT EXISTS "StewartAttachment_sessionId_expiresAt_idx" ON "StewartAttachment"("sessionId", "expiresAt");
CREATE INDEX IF NOT EXISTS "StewartAttachment_expiresAt_idx" ON "StewartAttachment"("expiresAt");
COMMIT;
