-- Additive E-Learning patch. Run before the conversation routes are deployed.
-- userId is an application-level reference to the separate Core identity database.
BEGIN;
DO $$ BEGIN
  CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ChatMessageStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "ChatConversation" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "clientKey" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleGenerated" BOOLEAN NOT NULL DEFAULT false,
  "courseId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL CHECK ("weekNumber" >= 1),
  "documentId" TEXT,
  "documentTitle" TEXT,
  "pendingRequestId" TEXT,
  "pendingToken" TEXT,
  "pendingUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatConversation_title_check" CHECK (length("title") BETWEEN 1 AND 160)
);
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "ChatConversation"("id") ON DELETE CASCADE,
  "requestId" TEXT NOT NULL,
  "role" "ChatMessageRole" NOT NULL,
  "status" "ChatMessageStatus" NOT NULL DEFAULT 'COMPLETE',
  "content" TEXT NOT NULL CHECK (length("content") > 0),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatConversation_sessionId_key" ON "ChatConversation"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatConversation_userId_clientKey_key" ON "ChatConversation"("userId", "clientKey");
CREATE INDEX IF NOT EXISTS "ChatConversation_userId_updatedAt_id_idx" ON "ChatConversation"("userId", "updatedAt", "id");
CREATE INDEX IF NOT EXISTS "ChatConversation_userId_courseId_updatedAt_id_idx" ON "ChatConversation"("userId", "courseId", "updatedAt", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessage_conversationId_requestId_role_key" ON "ChatMessage"("conversationId", "requestId", "role");
CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_id_idx" ON "ChatMessage"("conversationId", "createdAt", "id");
COMMIT;
