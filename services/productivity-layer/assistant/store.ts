import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { badRequest, conflict, notFound, tooManyRequests } from "@/lib/service-error";
import { requireProductivityActor } from "../auth";
import { interruptedOutcome } from "./outcome";

export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value ?? null));
export const LEASE_MS = 90000;
export type Scope = { sub: string; cid: string; turn: string };
async function savedOutcome(tx: Prisma.TransactionClient, scope: Scope) {
  // The owner lock must already be held: it fences an in-flight tool commit
  // before we describe its outcome and close the turn. Never rerun a mutation.
  const executions = await tx.productivityAIToolExecution.findMany({
    where: { ownerId: scope.sub, conversationId: scope.cid, messageId: scope.turn },
    orderBy: { step: "asc" }, take: 10,
    select: { toolName: true, status: true, result: true },
  });
  return interruptedOutcome(executions);
}
export async function ownedConversation(ownerId: string, id: string) {
  const value = await prisma.productivityAIConversation.findFirst({ where: { id, ownerId } });
  if (!value) throw notFound("This assistant conversation is unavailable.");
  return value;
}
export async function lockOwner(tx: Prisma.TransactionClient, ownerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: ownerId }, select: { role: true } });
  if (user?.role !== "student") throw notFound("This student workspace is unavailable.");
}
export async function assertTurn(tx: Prisma.TransactionClient, scope: Scope) {
  // Both reads are fully scoped and independent. Outside a write transaction this
  // removes one database round trip from every delegated context/tool admission.
  const [conversation, message] = await Promise.all([
    tx.productivityAIConversation.findFirst({ where: { id: scope.cid, ownerId: scope.sub } }),
    tx.productivityAIMessage.findFirst({ where: { id: scope.turn, conversationId: scope.cid, ownerId: scope.sub, role: "user", status: "processing" } }),
  ]);
  if (!conversation || conversation.activeTurnId !== scope.turn || !conversation.leaseExpiresAt || conversation.leaseExpiresAt.getTime() <= Date.now()) throw conflict("This assistant turn has ended. Reload the conversation before continuing.");
  if (!message) throw conflict("This assistant turn is no longer active.");
  return { conversation, message };
}
export async function createConversation(ownerId: string) {
  await requireProductivityActor(ownerId);
  return prisma.$transaction(async tx => {
    await lockOwner(tx, ownerId);
    const count = await tx.productivityAIConversation.count({ where: { ownerId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (count >= 30) throw tooManyRequests("Please continue an existing conversation. The daily new-conversation limit has been reached.");
    return tx.productivityAIConversation.create({ data: { ownerId } });
  });
}
export async function listConversations(ownerId: string, cursor?: string) {
  if (cursor) await ownedConversation(ownerId, cursor);
  return prisma.productivityAIConversation.findMany({ where: { ownerId }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 30, select: { id: true, title: true, updatedAt: true } });
}
export async function conversationView(ownerId: string, id: string, before?: number) {
  const conversation = await ownedConversation(ownerId, id);
  if (conversation.activeTurnId && (!conversation.leaseExpiresAt || conversation.leaseExpiresAt.getTime() <= Date.now())) {
    await finishTurn({ sub: ownerId, cid: id, turn: conversation.activeTurnId }, "The assistant stopped before finishing. Check the operation results below before repeating a request.", "interrupted", true);
  }
  const [messages, executions, pending] = await Promise.all([
    prisma.productivityAIMessage.findMany({ where: { ownerId, conversationId: id, ...(before !== undefined ? { sequence: { lt: before } } : {}) }, orderBy: { sequence: "desc" }, take: 60, select: { id: true, sequence: true, role: true, content: true, status: true, createdAt: true } }),
    prisma.productivityAIToolExecution.findMany({ where: { ownerId, conversationId: id }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, messageId: true, toolName: true, status: true, result: true, error: true, createdAt: true } }),
    prisma.productivityAIPendingAction.findMany({ where: { ownerId, conversationId: id, status: "pending" }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, preview: true, expiresAt: true } }),
  ]);
  return { conversation: { id, title: conversation.title }, messages: messages.reverse(), executions, pending: pending.map(row => ({ ...row, expired: row.expiresAt.getTime() <= Date.now() })), hasOlder: messages.length === 60 };
}
export async function beginTurn(ownerId: string, conversationId: string, clientKey: string, content: string) {
  if (!content.trim() || content.length > 4000) throw badRequest("Messages must contain between 1 and 4,000 characters.");
  await requireProductivityActor(ownerId);
  return prisma.$transaction(async tx => {
    await lockOwner(tx, ownerId);
    const conversation = await tx.productivityAIConversation.findFirst({ where: { id: conversationId, ownerId } });
    if (!conversation) throw notFound("This assistant conversation is unavailable.");
    const existing = await tx.productivityAIMessage.findUnique({ where: { conversationId_clientKey: { conversationId, clientKey } } });
    if (existing) {
      if (existing.ownerId !== ownerId || existing.content !== content) throw conflict("This message identifier has already been used for different content.");
      return { turn: existing.id, started: false };
    }
    if (conversation.activeTurnId) {
      if (conversation.leaseExpiresAt && conversation.leaseExpiresAt.getTime() > Date.now()) throw conflict("The assistant is still processing another message in this conversation.");
      // Fence expired workers. Preserve actual execution rows; no operation is rerun here.
      const old = await tx.productivityAIMessage.findFirst({ where: { id: conversation.activeTurnId, ownerId, status: "processing" } });
      if (old) {
        await tx.productivityAIMessage.update({ where: { id: old.id }, data: { status: "interrupted" } });
        const outcome = await savedOutcome(tx, { sub: ownerId, cid: conversationId, turn: old.id });
        await tx.productivityAIMessage.create({ data: { ownerId, conversationId, sequence: old.sequence + 1, role: "assistant", content: outcome || "The previous turn was interrupted. Its saved operation results remain below; do not assume every step failed.", status: "interrupted", clientKey: `reply:${old.id}` } });
      }
    }
    const count = await tx.productivityAIMessage.count({ where: { ownerId, role: "user", createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (count >= 30) throw tooManyRequests("The hourly assistant message limit has been reached. Please try later or use the workspace forms.");
    const message = await tx.productivityAIMessage.create({ data: { ownerId, conversationId, sequence: conversation.nextSequence, role: "user", content, status: "processing", clientKey } });
    await tx.productivityAIConversation.update({ where: { id: conversationId }, data: { activeTurnId: message.id, leaseExpiresAt: new Date(Date.now() + LEASE_MS), nextSequence: { increment: 2 }, ...(conversation.nextSequence === 0 ? { title: content.slice(0, 80) } : {}) } });
    return { turn: message.id, started: true };
  });
}
export async function finishTurn(scope: Scope, content: string, status = "completed", expiredOnly = false) {
  return prisma.$transaction(async tx => {
    await lockOwner(tx, scope.sub);
    const conversation = await tx.productivityAIConversation.findFirst({ where: { id: scope.cid, ownerId: scope.sub } });
    const message = await tx.productivityAIMessage.findFirst({ where: { id: scope.turn, conversationId: scope.cid, ownerId: scope.sub, role: "user" } });
    if (!conversation || !message || conversation.activeTurnId !== scope.turn || message.status !== "processing") return;
    if (expiredOnly && conversation.leaseExpiresAt && conversation.leaseExpiresAt.getTime() > Date.now()) return;
    if (status === "failed" || status === "interrupted") content = await savedOutcome(tx, scope) || content;
    await tx.productivityAIMessage.create({ data: { ownerId: scope.sub, conversationId: scope.cid, sequence: message.sequence + 1, role: "assistant", content: content.slice(0, 8000), status, clientKey: `reply:${scope.turn}` } });
    await tx.productivityAIMessage.update({ where: { id: scope.turn }, data: { status } });
    await tx.productivityAIConversation.update({ where: { id: scope.cid }, data: { activeTurnId: null, leaseExpiresAt: null } });
  });
}
export async function deleteConversation(ownerId: string, id: string, confirmed: boolean) {
  if (!confirmed) throw badRequest("Confirm deleting this conversation and its messages first.");
  return prisma.$transaction(async tx => {
    await lockOwner(tx, ownerId);
    const conversation = await tx.productivityAIConversation.findFirst({ where: { id, ownerId } });
    if (!conversation) throw notFound("This assistant conversation is unavailable.");
    if (conversation.activeTurnId && conversation.leaseExpiresAt && conversation.leaseExpiresAt.getTime() > Date.now()) throw conflict("Wait for the current message to finish before deleting this conversation.");
    await tx.productivityAIConversation.delete({ where: { id } });
    // Productivity records/receipts are separate: deleting chat never deletes saved work.
    return { deleted: true };
  });
}
