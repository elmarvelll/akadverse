-- Additive Phase 1 only. Review/apply separately; new feature flags remain off.
BEGIN;
CREATE TABLE "AiCallLog" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "operation" TEXT NOT NULL,
  "studentId" TEXT, "courseId" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestHash" TEXT NOT NULL, "httpStatus" INTEGER, "latencyMs" INTEGER,
  "usageReported" BOOLEAN NOT NULL DEFAULT false, "model" TEXT,
  "inputTokens" INTEGER, "outputTokens" INTEGER, "embeddingTokens" INTEGER,
  "modelCalls" INTEGER, "cached" BOOLEAN NOT NULL DEFAULT false,
  "creditsCharged" DOUBLE PRECISION NOT NULL DEFAULT 0, "errorCode" TEXT,
  "responseRef" JSONB, "capabilities" JSONB, "schemaVersion" TEXT,
  "promptVersion" TEXT, "modelVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiCallLog_requestId_key" ON "AiCallLog"("requestId");
CREATE INDEX "AiCallLog_studentId_createdAt_idx" ON "AiCallLog"("studentId", "createdAt");
CREATE INDEX "AiCallLog_operation_status_createdAt_idx" ON "AiCallLog"("operation", "status", "createdAt");
ALTER TABLE "AiCallLog" ENABLE ROW LEVEL SECURITY;
-- No browser policies: responseRef can contain private teaching content/answer keys.
COMMIT;
