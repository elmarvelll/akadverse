import { createHash } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import { ServiceError } from "@/lib/service-error";
import { STEWART_MAX_ATTACHMENTS } from "@/lib/stewart/config";
import { AiServiceError, requestAttachmentDelete, requestAttachmentUpload } from "@/services/e-learning/ai-ingest/client";

export class AttachmentError extends ServiceError {
  constructor(status: number, message: string, readonly code: string) { super(status, message); }
}
const expired = () => new AttachmentError(422, "An attachment expired or is unavailable. Reattach it, then submit your question again.", "ATTACHMENT_EXPIRED");
async function locked<T>(sessionId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return elearningDb.$transaction(async (tx) => {
    // Cross-instance serialization covers reservation, use and deletion without holding a transaction across HTTP.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))::text`;
    return fn(tx);
  });
}
export function publicAttachment(row: { attachmentId: string | null; filename: string; mimeType: string; sizeBytes: number; createdAt: Date; expiresAt: Date }) {
  return { attachment_id: row.attachmentId!, filename: row.filename, mime_type: row.mimeType, size_bytes: row.sizeBytes, created_at: row.createdAt.toISOString(), expires_at: row.expiresAt.toISOString(), status: "uploaded" as const };
}
export async function storeAttachment(userId: string, sessionId: string, file: File, conversationId?: string) {
  const uploadKey = createHash("sha256").update(file.name).update(file.type).update(new Uint8Array(await file.arrayBuffer())).digest("hex");
  const reservation = await locked(sessionId, async (tx) => {
    if (conversationId && !await tx.chatConversation.findFirst({ where: { id: conversationId, userId, sessionId } })) throw new AttachmentError(404, "That conversation is no longer available.", "CONVERSATION_DELETED");
    // Opportunistic metadata retention; upstream handles binary expiry without an application job.
    // Keep expired references for saved chats so refresh cannot silently omit a required file.
    await tx.$executeRaw`DELETE FROM "StewartAttachment" a
      WHERE a."expiresAt" < ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
      AND (a."inUseUntil" IS NULL OR a."inUseUntil" < ${new Date()})
      AND NOT (a.status IN ('uploaded','failed') AND a."attachmentId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "ChatConversation" c WHERE c."sessionId"=a."sessionId" AND c."userId"=a."userId"))`;
    const existing = await tx.stewartAttachment.findUnique({ where: { sessionId_uploadKey: { sessionId, uploadKey } } });
    if (existing && existing.userId !== userId) throw new AttachmentError(403, "Attachment access denied.", "ATTACHMENT_FORBIDDEN");
    if (existing && existing.expiresAt > new Date() && existing.status === "uploaded") return { row: existing, reused: true };
    if (existing && existing.expiresAt > new Date() && ["uploading", "deleting"].includes(existing.status)) throw new AttachmentError(409, "This file is being processed. Please retry shortly.", "ATTACHMENT_BUSY");
    const count = await tx.stewartAttachment.count({ where: { sessionId, status: { in: ["uploading", "uploaded", "deleting"] }, expiresAt: { gt: new Date() } } });
    if (count >= STEWART_MAX_ATTACHMENTS) throw new AttachmentError(422, "Use at most eight active attachments. Remove a file first.", "ATTACHMENT_LIMIT");
    const data = { userId, sessionId, uploadKey, filename: file.name, mimeType: file.type, sizeBytes: file.size, status: "uploading", attachmentId: null, expiresAt: new Date(Date.now() + 90_000), inUseUntil: null };
    const row = existing ? await tx.stewartAttachment.update({ where: { id: existing.id }, data }) : await tx.stewartAttachment.create({ data });
    return { row, reused: false };
  });
  if (reservation.reused) return publicAttachment(reservation.row);
  let remoteId: string | undefined;
  try {
    const metadata = await requestAttachmentUpload(file); remoteId = metadata.attachment_id;
    if (metadata.mime_type !== file.type || metadata.size_bytes !== file.size) throw new AiServiceError("Attachment metadata mismatch.", null);
    const row = await elearningDb.stewartAttachment.update({ where: { id: reservation.row.id }, data: { attachmentId: metadata.attachment_id, filename: file.name, createdAt: new Date(metadata.created_at), expiresAt: new Date(metadata.expires_at), status: "uploaded" } });
    return publicAttachment(row);
  } catch (error) {
    if (remoteId) await requestAttachmentDelete(remoteId).catch(() => {});
    await elearningDb.stewartAttachment.update({ where: { id: reservation.row.id }, data: { status: "failed" } }).catch(() => {});
    throw error;
  }
}
export async function acquireAttachments(userId: string, sessionId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new AttachmentError(422, "Select up to eight valid attachments.", "ATTACHMENT_INVALID");
  if (!ids.length) return [];
  return locked(sessionId, async (tx) => {
    const rows = await tx.stewartAttachment.findMany({ where: { attachmentId: { in: ids } } });
    if (rows.some((row) => row.userId !== userId || row.sessionId !== sessionId)) throw new AttachmentError(403, "These attachments do not belong to this conversation.", "ATTACHMENT_FORBIDDEN");
    if (rows.length !== ids.length || rows.some((row) => row.status !== "uploaded" || row.expiresAt <= new Date())) throw expired();
    if (rows.some((row) => row.inUseUntil && row.inUseUntil > new Date())) throw new AttachmentError(409, "An attachment is in use. Please wait for the answer.", "ATTACHMENT_BUSY");
    await tx.stewartAttachment.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { inUseUntil: new Date(Date.now() + 180_000) } });
    return ids;
  });
}
export async function releaseAttachments(sessionId: string, ids: string[]) {
  if (ids.length) await elearningDb.stewartAttachment.updateMany({ where: { sessionId, attachmentId: { in: ids } }, data: { inUseUntil: null } });
}
export async function removeAttachment(userId: string, sessionId: string, id: unknown) {
  if (typeof id !== "string") throw new AttachmentError(422, "Choose an attachment to remove.", "ATTACHMENT_INVALID");
  const row = await locked(sessionId, async (tx) => {
    const row = await tx.stewartAttachment.findUnique({ where: { attachmentId: id } });
    if (!row) return null;
    if (row.userId !== userId || row.sessionId !== sessionId) throw new AttachmentError(403, "Attachment access denied.", "ATTACHMENT_FORBIDDEN");
    if (row.inUseUntil && row.inUseUntil > new Date()) throw new AttachmentError(409, "Wait for Stewart's answer before removing this attachment.", "ATTACHMENT_BUSY");
    if (row.status === "deleted") return null;
    return tx.stewartAttachment.update({ where: { id: row.id }, data: { status: "deleting" } });
  });
  if (!row) return;
  await requestAttachmentDelete(id);
  await elearningDb.stewartAttachment.update({ where: { id: row.id }, data: { status: "deleted" } });
}
