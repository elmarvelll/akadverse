-- CreateTable
CREATE TABLE "ProductivityAIConversation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "nextSequence" INTEGER NOT NULL DEFAULT 0,
    "activeTurnId" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityAIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityAIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "clientKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductivityAIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityAIToolExecution" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" JSONB,
    "operationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProductivityAIToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityAIPendingAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProductivityAIPendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductivityAIConversation_ownerId_updatedAt_idx" ON "ProductivityAIConversation"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIConversation_id_ownerId_key" ON "ProductivityAIConversation"("id", "ownerId");

-- CreateIndex
CREATE INDEX "ProductivityAIMessage_ownerId_createdAt_idx" ON "ProductivityAIMessage"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIMessage_conversationId_clientKey_key" ON "ProductivityAIMessage"("conversationId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIMessage_conversationId_sequence_key" ON "ProductivityAIMessage"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIMessage_id_ownerId_key" ON "ProductivityAIMessage"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIToolExecution_operationKey_key" ON "ProductivityAIToolExecution"("operationKey");

-- CreateIndex
CREATE INDEX "ProductivityAIToolExecution_conversationId_createdAt_idx" ON "ProductivityAIToolExecution"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIToolExecution_messageId_step_key" ON "ProductivityAIToolExecution"("messageId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIToolExecution_id_ownerId_key" ON "ProductivityAIToolExecution"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIPendingAction_executionId_key" ON "ProductivityAIPendingAction"("executionId");

-- CreateIndex
CREATE INDEX "ProductivityAIPendingAction_conversationId_status_idx" ON "ProductivityAIPendingAction"("conversationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityAIPendingAction_executionId_ownerId_key" ON "ProductivityAIPendingAction"("executionId", "ownerId");

-- AddForeignKey
ALTER TABLE "ProductivityAIConversation" ADD CONSTRAINT "ProductivityAIConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityAIMessage" ADD CONSTRAINT "ProductivityAIMessage_conversationId_ownerId_fkey" FOREIGN KEY ("conversationId", "ownerId") REFERENCES "ProductivityAIConversation"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityAIToolExecution" ADD CONSTRAINT "ProductivityAIToolExecution_conversationId_ownerId_fkey" FOREIGN KEY ("conversationId", "ownerId") REFERENCES "ProductivityAIConversation"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityAIToolExecution" ADD CONSTRAINT "ProductivityAIToolExecution_messageId_ownerId_fkey" FOREIGN KEY ("messageId", "ownerId") REFERENCES "ProductivityAIMessage"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityAIPendingAction" ADD CONSTRAINT "ProductivityAIPendingAction_conversationId_ownerId_fkey" FOREIGN KEY ("conversationId", "ownerId") REFERENCES "ProductivityAIConversation"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityAIPendingAction" ADD CONSTRAINT "ProductivityAIPendingAction_executionId_ownerId_fkey" FOREIGN KEY ("executionId", "ownerId") REFERENCES "ProductivityAIToolExecution"("id", "ownerId") ON DELETE NO ACTION ON UPDATE CASCADE;

