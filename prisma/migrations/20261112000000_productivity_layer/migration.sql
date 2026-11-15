-- CreateEnum
CREATE TYPE "ProductivityOutcome" AS ENUM ('unrecorded', 'completed', 'missed');

-- CreateTable
CREATE TABLE "ProductivityPreferences" (
    "ownerId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityPreferences_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "ProductivityHabit" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdDate" VARCHAR(10) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityHabit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityCategory" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityOccurrence" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "originalDate" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductivityOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityTask" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "occurrenceId" TEXT,
    "dueDate" VARCHAR(10),
    "outcome" "ProductivityOutcome" NOT NULL DEFAULT 'unrecorded',
    "deletedAt" TIMESTAMP(3),
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityEvent" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "occurrenceId" TEXT,
    "categoryId" TEXT,
    "linkedTaskId" TEXT,
    "scheduledDate" VARCHAR(10) NOT NULL,
    "outcome" "ProductivityOutcome" NOT NULL DEFAULT 'unrecorded',
    "archivedAt" TIMESTAMP(3),
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityRequest" (
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductivityRequest_pkey" PRIMARY KEY ("ownerId","key")
);

-- CreateIndex
CREATE INDEX "ProductivityHabit_ownerId_createdDate_idx" ON "ProductivityHabit"("ownerId", "createdDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityHabit_id_ownerId_key" ON "ProductivityHabit"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityCategory_id_ownerId_key" ON "ProductivityCategory"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityCategory_ownerId_normalizedName_key" ON "ProductivityCategory"("ownerId", "normalizedName");

-- CreateIndex
CREATE INDEX "ProductivityOccurrence_ownerId_originalDate_idx" ON "ProductivityOccurrence"("ownerId", "originalDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityOccurrence_habitId_originalDate_key" ON "ProductivityOccurrence"("habitId", "originalDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityOccurrence_id_ownerId_key" ON "ProductivityOccurrence"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityTask_occurrenceId_key" ON "ProductivityTask"("occurrenceId");

-- CreateIndex
CREATE INDEX "ProductivityTask_ownerId_dueDate_outcome_idx" ON "ProductivityTask"("ownerId", "dueDate", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityTask_id_ownerId_key" ON "ProductivityTask"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityTask_occurrenceId_ownerId_key" ON "ProductivityTask"("occurrenceId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityEvent_occurrenceId_key" ON "ProductivityEvent"("occurrenceId");

-- CreateIndex
CREATE INDEX "ProductivityEvent_ownerId_scheduledDate_outcome_idx" ON "ProductivityEvent"("ownerId", "scheduledDate", "outcome");

-- CreateIndex
CREATE INDEX "ProductivityEvent_ownerId_categoryId_idx" ON "ProductivityEvent"("ownerId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityEvent_id_ownerId_key" ON "ProductivityEvent"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityEvent_occurrenceId_ownerId_key" ON "ProductivityEvent"("occurrenceId", "ownerId");

-- CreateIndex
CREATE INDEX "ProductivityRequest_createdAt_idx" ON "ProductivityRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductivityPreferences" ADD CONSTRAINT "ProductivityPreferences_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityHabit" ADD CONSTRAINT "ProductivityHabit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityCategory" ADD CONSTRAINT "ProductivityCategory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityOccurrence" ADD CONSTRAINT "ProductivityOccurrence_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityOccurrence" ADD CONSTRAINT "ProductivityOccurrence_habitId_ownerId_fkey" FOREIGN KEY ("habitId", "ownerId") REFERENCES "ProductivityHabit"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityTask" ADD CONSTRAINT "ProductivityTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityTask" ADD CONSTRAINT "ProductivityTask_occurrenceId_ownerId_fkey" FOREIGN KEY ("occurrenceId", "ownerId") REFERENCES "ProductivityOccurrence"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEvent" ADD CONSTRAINT "ProductivityEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEvent" ADD CONSTRAINT "ProductivityEvent_occurrenceId_ownerId_fkey" FOREIGN KEY ("occurrenceId", "ownerId") REFERENCES "ProductivityOccurrence"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEvent" ADD CONSTRAINT "ProductivityEvent_categoryId_ownerId_fkey" FOREIGN KEY ("categoryId", "ownerId") REFERENCES "ProductivityCategory"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEvent" ADD CONSTRAINT "ProductivityEvent_linkedTaskId_ownerId_fkey" FOREIGN KEY ("linkedTaskId", "ownerId") REFERENCES "ProductivityTask"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityRequest" ADD CONSTRAINT "ProductivityRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
