-- Additive standalone revision workspace; existing questions/cards/history are unchanged.
BEGIN;
-- CreateTable
CREATE TABLE "RevisionQuestionGovernance" (
    "questionId" TEXT NOT NULL,
    "publicationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "sourceFingerprint" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionQuestionGovernance_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "RevisionSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "offeringId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RevisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "coverageEventId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardVersion" INTEGER NOT NULL,
    "introduction" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "reasoning" TEXT,
    "answerHash" TEXT,
    "evaluation" JSONB,
    "evaluationToken" TEXT,
    "evaluationLease" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "reviewLogId" TEXT,

    CONSTRAINT "RevisionSessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionLearningContext" (
    "studentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "preparedVersion" INTEGER NOT NULL DEFAULT 0,
    "preparedAt" TIMESTAMP(3),
    "snapshot" JSONB,
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "claimToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionLearningContext_pkey" PRIMARY KEY ("studentId")
);

-- CreateIndex
CREATE INDEX "RevisionQuestionGovernance_publicationStatus_idx" ON "RevisionQuestionGovernance"("publicationStatus");

-- CreateIndex
CREATE INDEX "RevisionSession_studentId_status_updatedAt_idx" ON "RevisionSession"("studentId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSession_studentId_requestKey_key" ON "RevisionSession"("studentId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSessionItem_reviewLogId_key" ON "RevisionSessionItem"("reviewLogId");

-- CreateIndex
CREATE INDEX "RevisionSessionItem_sessionId_status_position_idx" ON "RevisionSessionItem"("sessionId", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSessionItem_sessionId_position_key" ON "RevisionSessionItem"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSessionItem_sessionId_questionId_key" ON "RevisionSessionItem"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "RevisionLearningContext_dirty_nextAttemptAt_idx" ON "RevisionLearningContext"("dirty", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "RevisionQuestionGovernance" ADD CONSTRAINT "RevisionQuestionGovernance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RevisionQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RevisionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RevisionQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_coverageEventId_fkey" FOREIGN KEY ("coverageEventId") REFERENCES "RevisionTeachingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RevisionStudentCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_reviewLogId_fkey" FOREIGN KEY ("reviewLogId") REFERENCES "RevisionReviewLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "RevisionQuestionGovernance" ADD CONSTRAINT "RevisionQuestionGovernance_status_check" CHECK ("publicationStatus" IN ('UNVERIFIED','PUBLISHED','SUSPENDED','RETIRED'));
ALTER TABLE "RevisionQuestionGovernance" ADD CONSTRAINT "RevisionQuestionGovernance_fingerprint_check" CHECK ("sourceFingerprint" ~ '^[a-f0-9]{64}$');
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_mode_check" CHECK ("mode" IN ('COURSE','RANDOM') AND ("mode" <> 'COURSE' OR "offeringId" IS NOT NULL));
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_status_check" CHECK ("status" IN ('ACTIVE','COMPLETED'));
ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_status_check" CHECK ("status" IN ('PENDING','EVALUATED','REVIEWED','SKIPPED') AND "position" >= 0 AND "cardVersion" >= 0 AND ("status" <> 'REVIEWED' OR "reviewLogId" IS NOT NULL) AND ("status" NOT IN ('EVALUATED','REVIEWED') OR ("evaluation" IS NOT NULL AND "evaluatedAt" IS NOT NULL)));

COMMIT;
