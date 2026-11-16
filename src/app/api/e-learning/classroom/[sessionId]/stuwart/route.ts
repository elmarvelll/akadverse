import { NextResponse } from "next/server";
import { badRequest, ServiceError } from "@/lib/service-error";
import { requireStewartStudent, boundedStewartRequest, stewartErrorResponse } from "@/app/api/e-learning/stewart/shared";
import { classroomHistory, askClassroomStuwart } from "@/services/e-learning/classroom/stuwart";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { AiServiceError } from "@/services/e-learning/ai-ingest/client";
export const runtime = "nodejs";
export const maxDuration = 180;
type Context = { params: Promise<{ sessionId: string }> };
export async function GET(_req: Request, context: Context) {
  try {
    const id = await requireStewartStudent();
    return NextResponse.json(await classroomHistory(id, (await context.params).sessionId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return stewartErrorResponse("classroom-history", e); }
}
export async function POST(req: Request, context: Context) {
  try {
    const id = await requireStewartStudent();
    enforceRateLimit(`chat:${id}`, { limit: 20, windowMs: 5 * 60 * 1000 });
    const body = await (await boundedStewartRequest(req, 16000)).json().catch(() => { throw badRequest("Invalid JSON."); });
    if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Invalid question.");
    return NextResponse.json(await askClassroomStuwart(id, (await context.params).sessionId, body), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return stewartErrorResponse("classroom-chat", e instanceof AiServiceError ? new ServiceError(503, "Stuwart is temporarily unavailable. Your class is still live. Try this question again shortly.") : e);
  }
}
