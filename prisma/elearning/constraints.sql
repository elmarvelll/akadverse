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
