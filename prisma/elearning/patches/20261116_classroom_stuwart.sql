-- Additive, backward-compatible lesson metadata. No existing conversation or classroom data is removed.
ALTER TABLE "ClassroomSession" ADD COLUMN IF NOT EXISTS "lessonTopic" TEXT;
ALTER TABLE "ClassroomSession" ADD COLUMN IF NOT EXISTS "lessonWeekNumber" INTEGER;
ALTER TABLE "ClassroomSession" ADD COLUMN IF NOT EXISTS "lessonDocumentId" TEXT;
ALTER TABLE "ClassroomSession" ADD COLUMN IF NOT EXISTS "lessonVersion" INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassroomSession_lessonWeek_check') THEN
  ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_lessonWeek_check" CHECK ("lessonWeekNumber" IS NULL OR "lessonWeekNumber" BETWEEN 1 AND 366);
 END IF;
END $$;
