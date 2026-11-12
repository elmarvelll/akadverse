import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { Prisma, ChatConversation } from "@/generated/prisma-elearning";
import { badRequest, conflict, notFound } from "@/lib/service-error";
import { attachmentContext } from "./attachment-context";
import { conversationTitle, temporaryConversationTitle } from "./conversation-title";
import { requestAttachmentDelete } from "@/services/e-learning/ai-ingest/client";
import { publicAttachment } from "./attachment-store";

export const isRequestId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validQuestion(v: unknown): string {
  if (typeof v !== "string" || !v.trim() || v.trim().length > 4000) throw badRequest("Ask a question of up to 4,000 characters.");
  return v.trim();
}
export const jsonMetadata = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function messageMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export async function ownedConversation(userId: string, id: string) {
  const conversation = await elearningDb.chatConversation.findFirst({ where: { id, userId } });
  if (!conversation) throw notFound("That conversation isn't available.");
  return conversation;
}
export const conversationSummary = (c: ChatConversation) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, courseId: c.courseId, courseCode: c.courseCode, weekNumber: c.weekNumber, documentId: c.documentId, documentTitle: c.documentTitle });
async function locked<T>(userId: string, id: string, fn: (tx: Prisma.TransactionClient, conversation: ChatConversation) => Promise<T>) {
  return elearningDb.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ChatConversation" WHERE id=${id} AND "userId"=${userId} FOR UPDATE`;
    const c = await tx.chatConversation.findFirst({ where: { id, userId } });
    if (!c) throw notFound("That conversation isn't available.");
    return fn(tx, c);
  }, { maxWait: 10000, timeout: 20000 });
}
export async function createConversation(userId: string, body: { clientKey?: unknown; courseId?: unknown; weekNumber?: unknown; documentId?: unknown; message?: unknown; requestId?: unknown }) {
  if (!isRequestId(body.clientKey)) throw badRequest("A valid conversation request ID is required.");
  const question = body.message === undefined ? undefined : validQuestion(body.message);
  if (question && !isRequestId(body.requestId)) throw badRequest("A valid message request ID is required.");
  const { workspace, week } = await attachmentContext(userId, body);
  const document = typeof body.documentId === "string" ? week.documents.find((d) => d.id === body.documentId) : undefined;
  const existing = await elearningDb.chatConversation.findUnique({ where: { userId_clientKey: { userId, clientKey: body.clientKey } } });
  if (existing) {
    if (existing.courseId !== body.courseId || existing.weekNumber !== week.weekNumber || existing.documentId !== (document?.id ?? null)) throw conflict("That conversation request belongs to a different study context.");
    if (question) {
      const first = await elearningDb.chatMessage.findFirst({ where: { conversationId: existing.id, role: "USER" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      if (!first || first.requestId !== body.requestId || first.content !== question) throw conflict("That conversation request has already been used.");
    }
    return existing;
  }
  try {
    return await elearningDb.chatConversation.create({ data: {
      userId, clientKey: body.clientKey, sessionId: randomUUID(), title: question ? temporaryConversationTitle(question) : `${workspace.course.code} study`,
      courseId: workspace.course.id, offeringId: workspace.offeringId!, courseCode: workspace.course.code, weekNumber: week.weekNumber, documentId: document?.id ?? null, documentTitle: document?.title ?? null,
      ...(question ? { messages: { create: { role: "USER", status: "FAILED", requestId: body.requestId as string, content: question, metadata: { awaitingSubmission: true } } } } : {}),
    } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return createConversation(userId, body);
    throw error;
  }
}
export async function listConversations(userId: string, options: { courseId?: string; before?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(50, options.limit ?? 20));
  let cursor: ChatConversation | null = null;
  if (options.before) cursor = await ownedConversation(userId, options.before);
  const conversations = await elearningDb.chatConversation.findMany({
    where: { userId, ...(options.courseId ? { courseId: options.courseId } : {}), ...(cursor ? { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }] } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit + 1,
  });
  return { conversations: conversations.slice(0, limit).map(conversationSummary), nextCursor: conversations.length > limit ? conversations[limit - 1].id : null };
}
export async function getConversation(userId: string, id: string, before?: string) {
  const conversation = await ownedConversation(userId, id);
  const cursor = before ? await elearningDb.chatMessage.findFirst({ where: { id: before, conversationId: id } }) : null;
  if (before && !cursor) throw badRequest("Invalid message page.");
  const rows = await elearningDb.chatMessage.findMany({ where: { conversationId: id, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
  const messages = rows.slice(0, 50).reverse().map((m) => ({ ...m, status: m.status === "PENDING" && (!conversation.pendingUntil || conversation.pendingUntil <= new Date()) ? "FAILED" : m.status }));
  const attachments = await elearningDb.stewartAttachment.findMany({ where: { userId, sessionId: conversation.sessionId, status: { in: ["uploaded", "failed"] }, attachmentId: { not: null } }, orderBy: { createdAt: "asc" } });
  return { conversation: conversationSummary(conversation), messages, nextCursor: rows.length > 50 ? rows[49].id : null, attachments: attachments.map((a) => ({ ...publicAttachment(a), ...(a.status === "failed" ? { requires_reattach: true } : {}) })) };
}
export async function reserveMessage(userId: string, id: string, requestId: string, content: string, metadata: Record<string, unknown>) {
  return locked(userId, id, async (tx, c) => {
    const existing = await tx.chatMessage.findUnique({ where: { conversationId_requestId_role: { conversationId: id, requestId, role: "USER" } } });
    if (existing && existing.content !== content) throw conflict("This request ID was used for a different question.");
    if (existing && messageMetadata(existing.metadata).grounded !== undefined && messageMetadata(existing.metadata).grounded !== metadata.grounded) throw conflict("Retry this message using its original explanation mode.");
    const assistant = await tx.chatMessage.findUnique({ where: { conversationId_requestId_role: { conversationId: id, requestId, role: "ASSISTANT" } } });
    if (assistant) return { cached: true as const, user: existing!, assistant, conversation: c };
    if (c.pendingUntil && c.pendingUntil > new Date()) throw conflict("Stewart is still answering a message in this conversation. Please wait.");
    const user = existing ? await tx.chatMessage.update({ where: { id: existing.id }, data: { status: "PENDING", metadata: jsonMetadata(metadata) } }) : await tx.chatMessage.create({ data: { conversationId: id, requestId, role: "USER", status: "PENDING", content, metadata: jsonMetadata(metadata) } });
    const token = randomUUID();
    await tx.chatConversation.update({ where: { id }, data: { pendingRequestId: requestId, pendingToken: token, pendingUntil: new Date(Date.now() + 210000), updatedAt: new Date(), ...(!c.titleGenerated ? { title: temporaryConversationTitle(content) } : {}) } });
    const previous = await tx.chatMessage.findMany({ where: { conversationId: id, status: "COMPLETE", requestId: { not: requestId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 });
    return { cached: false as const, user, conversation: c, token, history: previous.reverse().map((m) => ({ role: m.role === "USER" ? "student" as const : "stewart" as const, text: m.content })) };
  });
}
export async function completeMessage(userId: string, id: string, requestId: string, token: string, question: string, reply: string, metadata: unknown) {
  return locked(userId, id, async (tx, c) => {
    if (c.pendingToken !== token || c.pendingRequestId !== requestId) throw conflict("This message is being handled by a newer request. Reload the conversation.");
    const assistant = await tx.chatMessage.create({ data: { conversationId: id, requestId, role: "ASSISTANT", status: "COMPLETE", content: reply, metadata: jsonMetadata(metadata) } });
    const user = await tx.chatMessage.update({ where: { conversationId_requestId_role: { conversationId: id, requestId, role: "USER" } }, data: { status: "COMPLETE" } });
    let title = c.title;
    if (!c.titleGenerated) { try { title = conversationTitle(question, reply); } catch { /* The temporary title remains usable. */ } }
    const conversation = await tx.chatConversation.update({ where: { id }, data: { title, titleGenerated: true, updatedAt: new Date(), pendingToken: null, pendingRequestId: null, pendingUntil: null } });
    return { user, assistant, conversation };
  });
}
export async function failMessage(userId: string, id: string, requestId: string, token: string) {
  await locked(userId, id, async (tx, c) => {
    if (c.pendingToken !== token) return;
    await tx.chatMessage.updateMany({ where: { conversationId: id, requestId, role: "USER" }, data: { status: "FAILED" } });
    await tx.chatConversation.update({ where: { id }, data: { pendingRequestId: null, pendingToken: null, pendingUntil: null, updatedAt: new Date() } });
  });
}
export async function deleteConversation(userId: string, id: string) {
  const remoteIds = await locked(userId, id, async (tx, c) => {
    if (c.pendingUntil && c.pendingUntil > new Date()) throw conflict("Wait for Stewart's answer before deleting this conversation.");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${c.sessionId}))::text`;
    const attachments = await tx.stewartAttachment.findMany({ where: { sessionId: c.sessionId, userId } });
    if (attachments.some((a) => (a.status === "uploading" && a.expiresAt > new Date()) || (a.inUseUntil && a.inUseUntil > new Date()))) throw conflict("Wait for the attachment operation to finish before deleting this conversation.");
    await tx.stewartAttachment.updateMany({ where: { sessionId: c.sessionId, userId }, data: { status: "deleting" } });
    await tx.chatConversation.delete({ where: { id } });
    return attachments.filter((a) => a.attachmentId && a.status !== "deleted").map((a) => a.attachmentId!);
  });
  // A failed remote cleanup falls back to the service's six-hour expiry; local history is already removed.
  for (let i = 0; i < remoteIds.length; i += 4) await Promise.allSettled(remoteIds.slice(i, i + 4).map(async (attachmentId) => {
    await requestAttachmentDelete(attachmentId);
    await elearningDb.stewartAttachment.updateMany({ where: { attachmentId, userId }, data: { status: "deleted" } });
  }));
}
