import { NextResponse } from "next/server";
import { badRequest } from "@/lib/service-error";
import { createConversation, conversationSummary, listConversations } from "@/services/e-learning/student/stewart/conversations";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { boundedStewartRequest, requireStewartStudent, stewartErrorResponse } from "../shared";
const headers = { "Cache-Control": "no-store" };
export async function GET(req: Request) {
  try {
    const userId = await requireStewartStudent(); const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw badRequest("Choose a page size from 1 to 50.");
    return NextResponse.json(await listConversations(userId, { courseId: url.searchParams.get("courseId") ?? undefined, before: url.searchParams.get("before") ?? undefined, limit }), { headers });
  } catch (error) { return stewartErrorResponse("conversation list", error); }
}
export async function POST(req: Request) {
  try {
    const userId = await requireStewartStudent();
    enforceRateLimit(`conversation:${userId}`, { limit: 40, windowMs: 10 * 60 * 1000 });
    const body = await (await boundedStewartRequest(req, 16384)).json().catch(() => null);
    if (!body) throw badRequest("That conversation request couldn't be read.");
    const conversation = await createConversation(userId, body);
    return NextResponse.json({ conversation: conversationSummary(conversation) }, { status: 201, headers });
  } catch (error) { return stewartErrorResponse("conversation create", error); }
}
