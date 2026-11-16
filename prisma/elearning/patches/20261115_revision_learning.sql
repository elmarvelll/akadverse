BEGIN;
-- First revision-learning subsystem. Additive; apply after receipt patch.
CREATE EXTENSION IF NOT EXISTS vector;
SET LOCAL search_path = public, extensions;
-- CreateTable
CREATE TABLE "RevisionConcept" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "learningObjective" TEXT NOT NULL,
    "conceptKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionConceptAnalysisJob" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionConceptAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionPracticeAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "question" JSONB NOT NULL,
    "evaluation" JSONB,
    "answerHash" TEXT,
    "evaluationToken" TEXT,
    "evaluationLease" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "RevisionPracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionTeachingEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "practiceAttemptId" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "taughtSummary" TEXT NOT NULL,
    "passedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionTeachingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionGenerationJob" (
    "id" TEXT NOT NULL,
    "teachingEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "reusedCount" INTEGER NOT NULL DEFAULT 0,
    "cardsCreated" INTEGER NOT NULL DEFAULT 0,
    "webhookStatus" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionQuestion" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "canonicalHash" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "bloomLevel" TEXT NOT NULL,
    "tags" TEXT[],
    "subject" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "conceptTitle" TEXT NOT NULL,
    "learningObjective" TEXT NOT NULL,
    "variantOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionQuestionEmbedding" (
    "questionId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vector" vector(1536) NOT NULL,

    CONSTRAINT "RevisionQuestionEmbedding_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "RevisionStudentCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "schedulerVersion" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionStudentCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionReviewLog" (
    "id" TEXT NOT NULL,
    "studentCardId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "previousState" JSONB NOT NULL,
    "nextState" JSONB NOT NULL,
    "schedulerLog" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionQuestionProvenance" (
    "id" TEXT NOT NULL,
    "teachingEventId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "clientRef" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionQuestionProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionAdminAlert" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "RevisionAdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionConcept_conceptKey_idx" ON "RevisionConcept"("conceptKey");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionConcept_materialId_externalId_key" ON "RevisionConcept"("materialId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionConceptAnalysisJob_materialId_key" ON "RevisionConceptAnalysisJob"("materialId");

-- CreateIndex
CREATE INDEX "RevisionConceptAnalysisJob_status_nextAttemptAt_idx" ON "RevisionConceptAnalysisJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RevisionPracticeAttempt_studentId_createdAt_idx" ON "RevisionPracticeAttempt"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionPracticeAttempt_studentId_requestKey_key" ON "RevisionPracticeAttempt"("studentId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionTeachingEvent_practiceAttemptId_key" ON "RevisionTeachingEvent"("practiceAttemptId");

-- CreateIndex
CREATE INDEX "RevisionTeachingEvent_studentId_passedAt_idx" ON "RevisionTeachingEvent"("studentId", "passedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionGenerationJob_teachingEventId_key" ON "RevisionGenerationJob"("teachingEventId");

-- CreateIndex
CREATE INDEX "RevisionGenerationJob_status_nextAttemptAt_idx" ON "RevisionGenerationJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RevisionQuestion_scopeKey_idx" ON "RevisionQuestion"("scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionQuestion_scopeKey_canonicalHash_key" ON "RevisionQuestion"("scopeKey", "canonicalHash");

-- CreateIndex
CREATE INDEX "RevisionStudentCard_studentId_dueAt_idx" ON "RevisionStudentCard"("studentId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionStudentCard_studentId_questionId_key" ON "RevisionStudentCard"("studentId", "questionId");

-- CreateIndex
CREATE INDEX "RevisionReviewLog_studentCardId_reviewedAt_idx" ON "RevisionReviewLog"("studentCardId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionReviewLog_studentId_requestKey_key" ON "RevisionReviewLog"("studentId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionQuestionProvenance_teachingEventId_clientRef_key" ON "RevisionQuestionProvenance"("teachingEventId", "clientRef");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionAdminAlert_dedupeKey_key" ON "RevisionAdminAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "RevisionAdminAlert_status_nextAttemptAt_idx" ON "RevisionAdminAlert"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "RevisionConcept" ADD CONSTRAINT "RevisionConcept_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionConceptAnalysisJob" ADD CONSTRAINT "RevisionConceptAnalysisJob_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionPracticeAttempt" ADD CONSTRAINT "RevisionPracticeAttempt_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionTeachingEvent" ADD CONSTRAINT "RevisionTeachingEvent_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionTeachingEvent" ADD CONSTRAINT "RevisionTeachingEvent_practiceAttemptId_fkey" FOREIGN KEY ("practiceAttemptId") REFERENCES "RevisionPracticeAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionGenerationJob" ADD CONSTRAINT "RevisionGenerationJob_teachingEventId_fkey" FOREIGN KEY ("teachingEventId") REFERENCES "RevisionTeachingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQuestion" ADD CONSTRAINT "RevisionQuestion_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQuestion" ADD CONSTRAINT "RevisionQuestion_variantOfId_fkey" FOREIGN KEY ("variantOfId") REFERENCES "RevisionQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQuestionEmbedding" ADD CONSTRAINT "RevisionQuestionEmbedding_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RevisionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionStudentCard" ADD CONSTRAINT "RevisionStudentCard_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RevisionQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionReviewLog" ADD CONSTRAINT "RevisionReviewLog_studentCardId_fkey" FOREIGN KEY ("studentCardId") REFERENCES "RevisionStudentCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQuestionProvenance" ADD CONSTRAINT "RevisionQuestionProvenance_teachingEventId_fkey" FOREIGN KEY ("teachingEventId") REFERENCES "RevisionTeachingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQuestionProvenance" ADD CONSTRAINT "RevisionQuestionProvenance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RevisionQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE INDEX IF NOT EXISTS "RevisionQuestionEmbedding_cosine_idx" ON "RevisionQuestionEmbedding" USING hnsw ("vector" vector_cosine_ops);
ALTER TABLE "RevisionQuestionEmbedding" ADD CONSTRAINT "RevisionQuestionEmbedding_model_lock" CHECK ("model" = 'gemini-embedding-2' AND "version" = 'revision-v1' AND "dimensions" = 1536);

COMMIT;
