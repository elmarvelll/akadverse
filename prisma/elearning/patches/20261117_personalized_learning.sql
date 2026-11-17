-- Additive learning state; apply after 20261117_learning_ai_foundations.sql.
BEGIN;
-- CreateTable
CREATE TABLE "LearningMaterialVersion" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningMaterialVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlan" (
    "id" TEXT NOT NULL,
    "materialVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "sections" JSONB NOT NULL,
    "missingPrerequisites" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlanConcept" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "sourceLocalId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prerequisites" JSONB NOT NULL,
    "sourceChunks" JSONB NOT NULL,

    CONSTRAINT "LearningPlanConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningLessonRun" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "planId" TEXT NOT NULL,
    "currentConceptId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "busy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningLessonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningLessonAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "runVersion" INTEGER NOT NULL,
    "conceptId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "privateResult" JSONB,
    "attemptId" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "errorCode" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LearningLessonAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCoverage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningMastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "policyVersion" TEXT NOT NULL DEFAULT '1',
    "pendingReview" BOOLEAN NOT NULL DEFAULT false,
    "consecutiveReinforce" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvaluation" (
    "id" TEXT NOT NULL,
    "actionId" TEXT,
    "reviewLogId" TEXT,
    "studentId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "evaluation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningHintEvent" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "attemptDraft" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningHintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "preparedVersion" INTEGER NOT NULL DEFAULT 0,
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "preparedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestratorDecision" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "allowed" JSONB NOT NULL,
    "decision" JSONB,
    "signals" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "guardReason" TEXT,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "executedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrchestratorDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningMaterialVersion_materialId_fingerprint_key" ON "LearningMaterialVersion"("materialId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_materialVersionId_key" ON "LearningPlan"("materialVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlanConcept_planId_conceptId_key" ON "LearningPlanConcept"("planId", "conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlanConcept_planId_position_key" ON "LearningPlanConcept"("planId", "position");

-- CreateIndex
CREATE INDEX "LearningLessonRun_studentId_courseId_updatedAt_idx" ON "LearningLessonRun"("studentId", "courseId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningLessonRun_studentId_planId_key" ON "LearningLessonRun"("studentId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningLessonAction_requestId_key" ON "LearningLessonAction"("requestId");

-- CreateIndex
CREATE INDEX "LearningLessonAction_status_createdAt_idx" ON "LearningLessonAction"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningLessonAction_runId_runVersion_key" ON "LearningLessonAction"("runId", "runVersion");

-- CreateIndex
CREATE INDEX "LearningCoverage_offeringId_conceptId_idx" ON "LearningCoverage"("offeringId", "conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCoverage_studentId_planId_conceptId_key" ON "LearningCoverage"("studentId", "planId", "conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningMastery_studentId_planId_conceptId_key" ON "LearningMastery"("studentId", "planId", "conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvaluation_actionId_key" ON "LearningEvaluation"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvaluation_reviewLogId_key" ON "LearningEvaluation"("reviewLogId");

-- CreateIndex
CREATE INDEX "LearningEvaluation_studentId_planId_conceptId_createdAt_idx" ON "LearningEvaluation"("studentId", "planId", "conceptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningHintEvent_actionId_key" ON "LearningHintEvent"("actionId");

-- CreateIndex
CREATE INDEX "LearningHintEvent_studentId_attemptId_createdAt_idx" ON "LearningHintEvent"("studentId", "attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningSnapshot_dirty_updatedAt_idx" ON "LearningSnapshot"("dirty", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSnapshot_studentId_offeringId_key" ON "LearningSnapshot"("studentId", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestratorDecision_actionId_key" ON "OrchestratorDecision"("actionId");

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_materialVersionId_fkey" FOREIGN KEY ("materialVersionId") REFERENCES "LearningMaterialVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanConcept" ADD CONSTRAINT "LearningPlanConcept_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningLessonRun" ADD CONSTRAINT "LearningLessonRun_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningLessonAction" ADD CONSTRAINT "LearningLessonAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LearningLessonRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LearningMaterialVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningPlanConcept" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningLessonRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningLessonAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningCoverage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningMastery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningHintEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrchestratorDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningMaterialVersion" ADD CONSTRAINT "LearningMaterialVersion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningPlanConcept" ADD CONSTRAINT "LearningPlanConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningLessonRun" ADD CONSTRAINT "LearningLessonRun_currentConceptId_fkey" FOREIGN KEY ("currentConceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningLessonAction" ADD CONSTRAINT "LearningLessonAction_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningCoverage" ADD CONSTRAINT "LearningCoverage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningCoverage" ADD CONSTRAINT "LearningCoverage_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningCoverage" ADD CONSTRAINT "LearningCoverage_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "LearningLessonAction"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningMastery" ADD CONSTRAINT "LearningMastery_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningMastery" ADD CONSTRAINT "LearningMastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningEvaluation" ADD CONSTRAINT "LearningEvaluation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningEvaluation" ADD CONSTRAINT "LearningEvaluation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RevisionConcept"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningEvaluation" ADD CONSTRAINT "LearningEvaluation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RevisionPracticeAttempt"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningEvaluation" ADD CONSTRAINT "LearningEvaluation_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "LearningLessonAction"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningEvaluation" ADD CONSTRAINT "LearningEvaluation_reviewLogId_fkey" FOREIGN KEY ("reviewLogId") REFERENCES "RevisionReviewLog"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningHintEvent" ADD CONSTRAINT "LearningHintEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "LearningLessonAction"("id") ON DELETE RESTRICT;
ALTER TABLE "LearningHintEvent" ADD CONSTRAINT "LearningHintEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RevisionPracticeAttempt"("id") ON DELETE RESTRICT;
ALTER TABLE "OrchestratorDecision" ADD CONSTRAINT "OrchestratorDecision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "LearningLessonAction"("id") ON DELETE RESTRICT;
COMMIT;
