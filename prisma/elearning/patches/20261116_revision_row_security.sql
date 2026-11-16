-- Backend-only learning state. App Prisma uses the server owner/BYPASSRLS role.
-- No browser/anon/authenticated SQL policies: access goes through authorized application APIs.
BEGIN;
ALTER TABLE "RevisionWebhookIdempotency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionConcept" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionConceptAnalysisJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionPracticeAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionTeachingEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionGenerationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionQuestionEmbedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionStudentCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionReviewLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionQuestionProvenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionAdminAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionQuestionGovernance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionSessionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionLearningContext" ENABLE ROW LEVEL SECURITY;
COMMIT;
