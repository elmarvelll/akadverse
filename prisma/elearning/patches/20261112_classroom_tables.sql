-- Add only the classroom tables/enums declared by the existing Prisma schema.
-- E-Learning database only. No drops, data resets, or Core changes. Safe to rerun.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN CREATE TYPE "ClassroomStatus" AS ENUM ('LIVE', 'ENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ClassroomQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ClassroomPollStatus" AS ENUM ('OPEN', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ClassroomPollAnswer" AS ENUM ('YES', 'NO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ClassroomSession" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "status" "ClassroomStatus" NOT NULL DEFAULT 'LIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ClassroomSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClassroomQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ClassroomQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClassroomQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClassroomQuestionVote" (
    "questionId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomQuestionVote_pkey" PRIMARY KEY ("questionId","studentUserId")
);

CREATE TABLE IF NOT EXISTS "ClassroomPoll" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "ClassroomPollStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ClassroomPoll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClassroomPollResponse" (
    "pollId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "answer" "ClassroomPollAnswer" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomPollResponse_pkey" PRIMARY KEY ("pollId","studentUserId")
);

CREATE INDEX IF NOT EXISTS "ClassroomSession_courseOfferingId_status_idx" ON "ClassroomSession"("courseOfferingId", "status");

CREATE INDEX IF NOT EXISTS "ClassroomSession_hostUserId_idx" ON "ClassroomSession"("hostUserId");

CREATE INDEX IF NOT EXISTS "ClassroomQuestion_sessionId_status_idx" ON "ClassroomQuestion"("sessionId", "status");

CREATE INDEX IF NOT EXISTS "ClassroomPoll_sessionId_status_idx" ON "ClassroomPoll"("sessionId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassroomSession_courseOfferingId_fkey' AND conrelid = 'public."ClassroomSession"'::regclass) THEN
    ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassroomQuestion_sessionId_fkey' AND conrelid = 'public."ClassroomQuestion"'::regclass) THEN
    ALTER TABLE "ClassroomQuestion" ADD CONSTRAINT "ClassroomQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassroomQuestionVote_questionId_fkey' AND conrelid = 'public."ClassroomQuestionVote"'::regclass) THEN
    ALTER TABLE "ClassroomQuestionVote" ADD CONSTRAINT "ClassroomQuestionVote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ClassroomQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassroomPoll_sessionId_fkey' AND conrelid = 'public."ClassroomPoll"'::regclass) THEN
    ALTER TABLE "ClassroomPoll" ADD CONSTRAINT "ClassroomPoll_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassroomPollResponse_pollId_fkey' AND conrelid = 'public."ClassroomPollResponse"'::regclass) THEN
    ALTER TABLE "ClassroomPollResponse" ADD CONSTRAINT "ClassroomPollResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClassroomPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
COMMIT;
