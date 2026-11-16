-- Constraints Prisma's schema language can't express. Idempotent; apply after `db push` on a fresh database:
--   npx prisma db execute --schema=prisma/elearning/schema.prisma --file prisma/elearning/constraints.sql
--
-- A faculty member is flagged as a Level Advisor exactly when they point at an assignment.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FacultyProfile_levelAdvisor_consistent') THEN
    ALTER TABLE "FacultyProfile"
      ADD CONSTRAINT "FacultyProfile_levelAdvisor_consistent"
      CHECK (("isLevelAdviser" = TRUE AND "levelAdvisorId" IS NOT NULL) OR ("isLevelAdviser" = FALSE AND "levelAdvisorId" IS NULL));
  END IF;
END $$;

-- Keep fresh db-push installations aligned with the versioned learning patch.
BEGIN;
SET LOCAL search_path = public, extensions;
CREATE INDEX IF NOT EXISTS "RevisionQuestionEmbedding_cosine_idx" ON "RevisionQuestionEmbedding" USING hnsw ("vector" vector_cosine_ops);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"RevisionQuestionEmbedding"'::regclass AND conname = 'RevisionQuestionEmbedding_model_lock') THEN
    ALTER TABLE "RevisionQuestionEmbedding" ADD CONSTRAINT "RevisionQuestionEmbedding_model_lock" CHECK ("model" = 'gemini-embedding-2' AND "version" = 'revision-v1' AND "dimensions" = 1536);
  END IF;
END $$;
COMMIT;

-- Course materials: a valid week range and the 8 MB per-file limit, enforced by the database itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseMaterial_weeks_valid') THEN
    ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_weeks_valid" CHECK ("startWeek" >= 1 AND "endWeek" >= "startWeek");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseMaterial_size_limit') THEN
    ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_size_limit" CHECK ("fileSize" > 0 AND "fileSize" <= 8388608);
  END IF;
END $$;

-- At most ONE coordinator per course offering (the coordinator is also one of its lecturers).
CREATE UNIQUE INDEX IF NOT EXISTS "CourseOfferingLecturer_one_coordinator"
  ON "CourseOfferingLecturer" ("courseOfferingId") WHERE "role" = 'COORDINATOR';

-- Revision webhook receipt invariants (also installed by the versioned SQL patch).
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

-- Backend-only revision tables: direct browser database access is not authorized.
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

-- Standalone Revisions invariants for fresh db-push installations.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevisionQuestionGovernance_status_check') THEN
    ALTER TABLE "RevisionQuestionGovernance" ADD CONSTRAINT "RevisionQuestionGovernance_status_check" CHECK ("publicationStatus" IN ('UNVERIFIED','PUBLISHED','SUSPENDED','RETIRED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevisionQuestionGovernance_fingerprint_check') THEN
    ALTER TABLE "RevisionQuestionGovernance" ADD CONSTRAINT "RevisionQuestionGovernance_fingerprint_check" CHECK ("sourceFingerprint" ~ '^[a-f0-9]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevisionSession_mode_check') THEN
    ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_mode_check" CHECK ("mode" IN ('COURSE','RANDOM') AND ("mode" <> 'COURSE' OR "offeringId" IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevisionSession_status_check') THEN
    ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_status_check" CHECK ("status" IN ('ACTIVE','COMPLETED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevisionSessionItem_status_check') THEN
    ALTER TABLE "RevisionSessionItem" ADD CONSTRAINT "RevisionSessionItem_status_check" CHECK ("status" IN ('PENDING','EVALUATED','REVIEWED','SKIPPED') AND "position" >= 0 AND "cardVersion" >= 0 AND ("status" <> 'REVIEWED' OR "reviewLogId" IS NOT NULL) AND ("status" NOT IN ('EVALUATED','REVIEWED') OR ("evaluation" IS NOT NULL AND "evaluatedAt" IS NOT NULL)));
  END IF;
END $$;
