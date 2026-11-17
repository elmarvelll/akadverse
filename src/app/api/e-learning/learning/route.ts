import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireStewartStudent, boundedStewartRequest } from "../stewart/shared";
import { ServiceError } from "@/lib/service-error";
import { RevisionWebhookError } from "@/services/e-learning/revision-questions/errors";
import { acknowledgeDelivery, lessonView, queueLessonCommand, requireLearning, startLesson } from "@/services/e-learning/learning-ai/lessons";
import { runLearningSweep } from "@/services/e-learning/learning-ai/worker";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
const headers = { "Cache-Control": "private, no-store" };
async function handle(work: () => Promise<unknown>) {
  try { requireLearning(); return Response.json({ result: await work() }, { headers }); }
  catch (error) {
    unstable_rethrow(error);
    const known = error instanceof ServiceError || error instanceof RevisionWebhookError;
    return Response.json({ error: known ? error.message : "This learning activity is temporarily unavailable.", code: error instanceof RevisionWebhookError ? error.code : "LEARNING_UNAVAILABLE" }, { status: known ? error.status : 503, headers });
  }
}
function kick(studentId: string) { after(async () => { try { await runLearningSweep(studentId); } catch { console.warn("[learning-ai] background sweep unavailable"); } }); }
export async function GET(request: Request) {
  return handle(async () => {
    const studentId = await requireStewartStudent();
    enforceRateLimit(`learning:read:${studentId}`, { limit: 60, windowMs: 60_000 });
    const runId = new URL(request.url).searchParams.get("run");
    if (!runId || runId.length > 200) throw new ServiceError(400, "Select a valid lesson.");
    const view = await lessonView(studentId, runId); if (view.busy) kick(studentId); return view;
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ServiceError(403, "Cross-origin learning requests are not allowed.");
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ServiceError(415, "Send JSON.");
    const studentId = await requireStewartStudent();
    enforceRateLimit(`learning:write:${studentId}`, { limit: 60, windowMs: 10 * 60_000 });
    const input: unknown = await (await boundedStewartRequest(request, 16384)).json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ServiceError(400, "Invalid learning request.");
    const body = input as Record<string, unknown>;
    if (body.action === "start") { const result = await startLesson(studentId, body); if (result.status === "PREPARING") kick(studentId); return result; }
    if (typeof body.runId !== "string" || body.runId.length > 200) throw new ServiceError(400, "Select a valid lesson.");
    if (body.action === "deliver" && typeof body.actionId === "string") { const result = await acknowledgeDelivery(studentId, body.runId, body.actionId); kick(studentId); return result; }
    if (body.action === "command") { const result = await queueLessonCommand(studentId, body.runId, body); kick(studentId); return result; }
    throw new ServiceError(400, "Choose a supported learning action.");
  });
}
