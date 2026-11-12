// Authenticated single-file multipart proxy. Files stay in Concept Explainer; only metadata is persisted here.
import { NextResponse } from "next/server";
import { badRequest } from "@/lib/service-error";
import { STEWART_MAX_ATTACHMENT_BYTES } from "@/lib/stewart/config";
import { AiServiceError } from "@/services/e-learning/ai-ingest/client";
import { attachmentContext } from "@/services/e-learning/student/stewart/attachment-context";
import { AttachmentError, removeAttachment, storeAttachment } from "@/services/e-learning/student/stewart/attachment-store";
import { validateAttachment } from "@/services/e-learning/student/stewart/validate-attachment";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { boundedStewartRequest, requireStewartStudent, stewartErrorResponse } from "../shared";

export const maxDuration = 60;
function uploadError(error: unknown) {
  if (error instanceof AiServiceError) {
    const status = error.status === 413 ? 413 : error.status === 422 ? 422 : 503;
    return stewartErrorResponse("attachment", new AttachmentError(status, status === 413 ? "The maximum file size is 4 MiB." : status === 422 ? "This file could not be read. Choose a supported, nonempty file." : "We couldn't upload this file. Please retry.", "ATTACHMENT_UPLOAD_FAILED"));
  }
  return stewartErrorResponse("attachment", error);
}
export async function POST(req: Request) {
  try {
    const userId = await requireStewartStudent();
    enforceRateLimit(`upload-v2:${userId}`, { limit: 60, windowMs: 10 * 60 * 1000 });
    const limited = await boundedStewartRequest(req, STEWART_MAX_ATTACHMENT_BYTES + 64 * 1024);
    const form = await limited.formData().catch(() => { throw badRequest("That upload couldn't be read."); });
    const { sessionId } = await attachmentContext(userId, { courseId: form.get("courseId"), weekNumber: form.get("weekNumber"), documentId: form.get("documentId"), ...(form.get("conversationId") ? { conversationId: form.get("conversationId") } : {}) });
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) throw badRequest("Upload one file per request.");
    const attachment = await storeAttachment(userId, sessionId, await validateAttachment(file), typeof form.get("conversationId") === "string" ? form.get("conversationId") as string : undefined);
    return NextResponse.json({ success: true, attachment, session_id: sessionId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return uploadError(error); }
}
export async function DELETE(req: Request) {
  try {
    const userId = await requireStewartStudent();
    const body = await (await boundedStewartRequest(req, 8192)).json().catch(() => null);
    if (!body) throw badRequest("Choose an attachment to remove.");
    const { sessionId } = await attachmentContext(userId, body);
    await removeAttachment(userId, sessionId, body.attachment_id);
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return uploadError(error); }
}
