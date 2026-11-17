import { NextResponse } from "next/server";
import { badRequest } from "@/lib/service-error";
import { elearningDb } from "@/lib/db/elearning";
import { attachmentContext } from "@/services/e-learning/student/stewart/attachment-context";
import { explainStewart } from "@/services/e-learning/student/stewart/explain";
import { completeMessage, conversationSummary, failMessage, isRequestId, jsonMetadata, messageMetadata, ownedConversation, reserveMessage, validQuestion } from "@/services/e-learning/student/stewart/conversations";
import { stewartTiming } from "@/services/e-learning/student/stewart/timing";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { boundedStewartRequest, requireStewartStudent, stewartErrorResponse } from "../../../shared";
export const maxDuration = 240;
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const referenceId = crypto.randomUUID();
  let claim: { userId: string; id: string; requestId: string; token: string } | undefined;
  try {
    const userId = await stewartTiming("authorize", referenceId, () => requireStewartStudent()); const { id } = await context.params;
    const conversation = await stewartTiming("conversation", referenceId, () => ownedConversation(userId, id));
    const body = await (await boundedStewartRequest(req, 32768)).json().catch(() => null);
    if (!body || !isRequestId(body.requestId)) throw badRequest("A valid message request ID is required.");
    const question = validQuestion(body.content);
    if (body.grounded !== undefined && typeof body.grounded !== "boolean") throw badRequest("Invalid explanation mode.");
    const ids = body.attachment_ids ?? [];
    if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length || ids.some((value: unknown) => !isRequestId(value))) throw badRequest("Choose up to eight valid attachments.");
    if (body.grounded === true && ids.length) throw badRequest("Remove attachments to use external grounding, or turn grounding off.");
    // Both depend only on the already owned conversation. Keep fresh course
    // authorization, but do not serialize the independent attachment metadata read.
    const [ctx, attachments] = await stewartTiming("context", referenceId, () => Promise.all([
      attachmentContext(userId, { courseId: conversation.courseId, weekNumber: conversation.weekNumber, documentId: conversation.documentId, conversationId: conversation.id }),
      ids.length ? elearningDb.stewartAttachment.findMany({ where: { userId, sessionId: conversation.sessionId, attachmentId: { in: ids } }, select: { attachmentId: true, filename: true, mimeType: true, sizeBytes: true, expiresAt: true } }) : Promise.resolve([]),
    ]));
    const metadata = { grounded: body.grounded === true, attachment_ids: ids, attachments: attachments.map((a) => ({ attachment_id: a.attachmentId, name: a.filename, mime_type: a.mimeType, size_bytes: a.sizeBytes, expires_at: a.expiresAt.toISOString() })) };
    const reserved = await stewartTiming("reserve", referenceId, () => reserveMessage(userId, id, body.requestId, question, metadata));
    if (reserved.cached) {
      const saved = messageMetadata(reserved.assistant.metadata);
      return NextResponse.json({ reply: reserved.assistant.content, truncated: false, ...saved, userMessage: reserved.user, assistantMessage: reserved.assistant, conversation: conversationSummary(reserved.conversation), session_id: reserved.conversation.sessionId }, { headers: { "Cache-Control": "no-store" } });
    }
    claim = { userId, id, requestId: body.requestId, token: reserved.token };
    enforceRateLimit(`chat:${userId}`, { limit: 20, windowMs: 5 * 60 * 1000 });
    const result = await explainStewart(userId, ctx, question, ids, body.grounded === true, reserved.history, referenceId);
    const complete = await stewartTiming("persist", referenceId, () => completeMessage(userId, id, body.requestId, reserved.token, question, result.reply, jsonMetadata({ sources: result.sources, ...(result.retrieval_info ? { retrieval_info: result.retrieval_info } : {}), grounded: body.grounded === true })));
    claim = undefined;
    return NextResponse.json({ ...result, userMessage: complete.user, assistantMessage: complete.assistant, conversation: conversationSummary(complete.conversation) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (claim) await failMessage(claim.userId, claim.id, claim.requestId, claim.token).catch(() => console.warn("[stewart] failed to release message claim; lease will expire"));
    return stewartErrorResponse("conversation message", error);
  }
}
