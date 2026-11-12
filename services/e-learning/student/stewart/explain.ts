import { elearningDb } from "@/lib/db/elearning";
import { ServiceError } from "@/lib/service-error";
import { AiServiceError, requestExplanation } from "@/services/e-learning/ai-ingest/client";
import { acquireAttachments, AttachmentError, releaseAttachments } from "./attachment-store";
import { attachmentContext } from "./attachment-context";
import type { StewartTurn } from "./chat";

export async function explainStewart(userId: string, ctx: Awaited<ReturnType<typeof attachmentContext>>, question: string, ids: unknown, grounded: boolean, history?: StewartTurn[]) {
  const { workspace, week, sessionId } = ctx;
  const verified = await acquireAttachments(userId, sessionId, ids);
  try {
    const result = await requestExplanation(question, workspace.offeringId!, week.weekNumber, grounded, { sessionId, attachmentIds: verified, ...(history ? { history } : {}) });
    const sources = grounded ? result.sources : result.sources.filter((s) => s.source_type === "ai_generated" || (s.source_type === "attachment" ? verified.includes(s.attachment_id!) : week.documents.some((d) => d.id === s.document_id)));
    return { reply: result.text, truncated: false, sources, ...(result.retrieval_info ? { retrieval_info: result.retrieval_info } : {}), session_id: sessionId };
  } catch (error) {
    if (error instanceof AiServiceError && error.status === 422 && verified.length) {
      await elearningDb.stewartAttachment.updateMany({ where: { sessionId, attachmentId: { in: verified } }, data: { status: "failed" } });
      throw new AttachmentError(422, "Stewart couldn't read an attachment; it may have expired. Reattach it and submit again.", "ATTACHMENT_REATTACH_REQUIRED");
    }
    throw new ServiceError(503, grounded ? "Grounded explanation is temporarily unavailable. Please try again." : "Course explanation is temporarily unavailable. Please try again.");
  } finally {
    await releaseAttachments(sessionId, verified).catch(() => console.warn("[stewart] attachment lease release failed; lease will expire"));
  }
}
