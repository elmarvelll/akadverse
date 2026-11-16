import { requireStewartStudent, boundedStewartRequest } from "@/app/api/e-learning/stewart/shared";
import { ServiceError } from "@/lib/service-error";
import { currentStudent, prepareConcepts, createPractice, evaluatePractice, dueRevisionCards, revealRevisionCard, reviewRevisionCard } from "@/services/e-learning/revision-questions/students";
import { RevisionWebhookError } from "@/services/e-learning/revision-questions/errors";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { revisionHome, startRevisionSession, revisionSessionView, answerRevisionItem, rateRevisionItem } from "@/services/e-learning/revision-questions/workspace";
import { workspaceEnabled } from "@/services/e-learning/revision-questions/eligibility";
import { elearningDb } from "@/lib/db/elearning";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };
async function handle(work: () => Promise<unknown>) {
  try {
    if (process.env.REVISION_QUESTIONS_ENABLED !== "true") throw new RevisionWebhookError(503, "REVISION_DISABLED", "Practice and revision have not been enabled for this deployment.");
    return Response.json({ result: await work() }, { headers });
  }
  catch (error) { const known = error instanceof RevisionWebhookError || error instanceof ServiceError; return Response.json({ error: known ? error.message : "The learning service is temporarily unavailable.", code: error instanceof RevisionWebhookError ? error.code : "LEARNING_UNAVAILABLE" }, { status: known ? error.status : 503, headers }); }
}
export async function GET(request: Request) {
  return handle(async () => {
    const studentId = await requireStewartStudent(); await currentStudent(studentId);
    const params = new URL(request.url).searchParams;
    if (params.has("workspace") || params.has("session")) {
      if (!workspaceEnabled()) throw new RevisionWebhookError(503, "WORKSPACE_DISABLED", "The Revisions workspace is not enabled yet.");
      return params.has("session") ? revisionSessionView(studentId, params.get("session")!) : revisionHome(studentId);
    }
    const id = params.get("event");
    if (id) {
      const event = await elearningDb.revisionTeachingEvent.findFirst({ where: { id, studentId }, select: { id: true, generation: { select: { status: true, needsReview: true, acceptedCount: true, rejectedCount: true } } } });
      if (!event) throw new RevisionWebhookError(404, "EVENT_UNAVAILABLE", "This teaching event is unavailable."); return event;
    }
    return dueRevisionCards(studentId);
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) throw new ServiceError(403, "Cross-origin learning requests are not allowed.");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ServiceError(400, "Send JSON.");
    const studentId = await requireStewartStudent(); await currentStudent(studentId);
    const input = await (await boundedStewartRequest(request, 16384)).json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ServiceError(400, "Invalid learning request.");
    enforceRateLimit(`revision:${studentId}`, { limit: 30, windowMs: 600000 });
    if (["start_session", "answer_item", "rate_item"].includes(input.action) && !workspaceEnabled()) throw new RevisionWebhookError(503, "WORKSPACE_DISABLED", "The Revisions workspace is not enabled yet.");
    switch (input.action) {
      case "start_session": return startRevisionSession(studentId, input);
      case "answer_item": return answerRevisionItem(studentId, input);
      case "rate_item": return rateRevisionItem(studentId, input);
      case "prepare_concepts": return prepareConcepts(studentId, input);
      case "practice": return createPractice(studentId, input);
      case "evaluate": return evaluatePractice(studentId, input);
      case "reveal": if (typeof input.cardId === "string") return revealRevisionCard(studentId, input.cardId); break;
      case "review": return reviewRevisionCard(studentId, input);
    }
    throw new ServiceError(400, "Unsupported learning action.");
  });
}
