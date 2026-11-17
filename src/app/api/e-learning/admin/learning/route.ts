import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { elearningDb } from "@/lib/db/elearning";
import { ServiceError } from "@/lib/service-error";
import { boundedStewartRequest } from "../../stewart/shared";
import { requireLearning } from "@/services/e-learning/learning-ai/lessons";
import { json } from "@/services/e-learning/learning-ai/plans";
import { dirtySnapshot } from "@/services/e-learning/learning-ai/snapshot";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function handle(work: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<unknown>) {
  try { const admin = await requireAdmin(); requireLearning(); return Response.json({ result: await work(admin) }, { headers }); }
  catch (error) { unstable_rethrow(error); return Response.json({ error: error instanceof ServiceError ? error.message : "Learning operations are unavailable." }, { status: error instanceof ServiceError ? error.status : 503, headers }); }
}
export async function GET() {
  return handle(async () => ({
    pending: await elearningDb.learningLessonAction.groupBy({ by: ["status"], _count: true }),
    recent: await elearningDb.learningLessonAction.findMany({ where: { status: { in: ["FAILED", "UNCERTAIN"] } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, runId: true, status: true, errorCode: true, leaseUntil: true, createdAt: true } }),
    reviews: await elearningDb.learningMastery.findMany({ where: { pendingReview: true }, take: 30, select: { studentId: true, planId: true, conceptId: true, updatedAt: true } }),
  }));
}
export async function POST(request: Request) {
  return handle(async admin => {
    const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) throw new ServiceError(403, "Cross-origin requests are not allowed.");
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new ServiceError(415, "Send JSON.");
    const input = await (await boundedStewartRequest(request, 8192)).json();
    if (!input || !["resolve_review", "reconcile_uncertain"].includes(input.action) || typeof input.runId !== "string" || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 1000) throw new ServiceError(400, "Provide the lesson, operation and review reason.");
    return elearningDb.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "LearningLessonRun" WHERE "id" = ${input.runId} FOR UPDATE`;
      const run = await tx.learningLessonRun.findUnique({ where: { id: input.runId } });
      if (!run || run.busy) throw new ServiceError(409, "Select an idle lesson.");
      if (input.action === "reconcile_uncertain") {
        if (input.providerStopped !== true || typeof input.actionId !== "string") throw new ServiceError(400, "Confirm the provider operation has stopped before releasing its slot.");
        const released = await tx.learningLessonAction.updateMany({ where: { id: input.actionId, runId: run.id, status: "UNCERTAIN" }, data: { status: "FAILED", leaseToken: null, leaseUntil: null, errorCode: "OPERATOR_RECONCILED" } });
        if (!released.count) throw new ServiceError(409, "This activity is no longer awaiting reconciliation.");
      } else {
        await tx.learningMastery.updateMany({ where: { studentId: run.studentId, planId: run.planId, conceptId: run.currentConceptId, pendingReview: true }, data: { pendingReview: false } });
      }
      // An append-only review activity records the operator and reason; no mastery/coverage is awarded.
      await tx.learningLessonAction.create({ data: { requestId: randomUUID(), requestHash: randomUUID(), runId: run.id, runVersion: run.version + 1, conceptId: run.currentConceptId, command: "review", trigger: "RETURN_VISIT", status: "COMPLETED", result: { message: "A reviewer checked this lesson. You may continue with a new learning activity." }, input: {}, privateResult: json({ operatorId: admin.user.id, reason: input.reason, operation: input.action, reconciledActionId: input.actionId ?? null }) } });
      await tx.learningLessonRun.update({ where: { id: run.id }, data: { version: { increment: 1 }, status: run.status === "COMPLETED" ? "COMPLETED" : "ACTIVE" } });
      await dirtySnapshot(tx, run.studentId, run.offeringId);
      return { reviewed: true };
    });
  });
}
