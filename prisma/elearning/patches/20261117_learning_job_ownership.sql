-- Additive ownership fences: flag rollback must park new work, not run it through legacy handlers.
BEGIN;
ALTER TABLE "RevisionConceptAnalysisJob" ADD COLUMN IF NOT EXISTS "learningV2" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RevisionGenerationJob" ADD COLUMN IF NOT EXISTS "learningV2" BOOLEAN NOT NULL DEFAULT false;
COMMIT;
