// Backward-compatible text/history endpoint; persistent conversation messages use the same explanation service.
import { NextResponse } from "next/server";
import { badRequest } from "@/lib/service-error";
import { normalizeHistory } from "@/services/e-learning/student/stewart/chat";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { attachmentContext } from "@/services/e-learning/student/stewart/attachment-context";
import { AttachmentError } from "@/services/e-learning/student/stewart/attachment-store";
import { explainStewart } from "@/services/e-learning/student/stewart/explain";
import { boundedStewartRequest, requireStewartStudent, stewartErrorResponse } from "../shared";
export const maxDuration = 180;
export async function POST(req: Request) {
  try {
    const userId = await requireStewartStudent();
    const body = await (await boundedStewartRequest(req, 1024 * 1024)).json().catch(() => null);
    if (!body) throw badRequest("That request couldn't be read. Please try again.");
    if (body.conversationId !== undefined) throw badRequest("Use the conversation message endpoint to continue a saved chat.");
    const ctx = await attachmentContext(userId, body);
    if (body.grounded !== undefined && typeof body.grounded !== "boolean") throw badRequest("Invalid explanation mode.");
    if (body.attachment || body.attachments?.length) throw new AttachmentError(422, "Please select these files again to use them with Stewart.", "ATTACHMENT_EXPIRED");
    const ids = body.attachment_ids ?? [];
    if (body.grounded === true && (!Array.isArray(ids) || ids.length)) throw badRequest("Remove attachments to use external grounding, or turn grounding off.");
    const history = normalizeHistory(body.messages);
    enforceRateLimit(`chat:${userId}`, { limit: 20, windowMs: 5 * 60 * 1000 });
    const result = await explainStewart(userId, ctx, history[history.length - 1].text, ids, body.grounded === true);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return stewartErrorResponse("chat", error); }
}
