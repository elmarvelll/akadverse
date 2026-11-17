import { elearningDb } from "@/lib/db/elearning";
import { learningAiFlags } from "./flags";
import { ownedRun } from "./lessons";
import { teachingPassed, type Evaluation } from "../revision-questions/policy";
/** Readiness signals are advisory. Reuse the existing job, bank and FSRS paths; never generate here. */
export async function queueEligibleLearningRevision(studentId: string, runId: string) {
  if (!learningAiFlags().REVISION_PIPELINE_ENABLED) return { queued: 0 };
  const { run } = await ownedRun(studentId, runId);
  const coverage = await elearningDb.learningCoverage.findMany({ where: { studentId, planId: run.planId }, select: { conceptId: true } });
  if (!coverage.length) return { queued: 0 };
  const events = await elearningDb.revisionTeachingEvent.findMany({ where: { studentId, conceptId: { in: coverage.map(c => c.conceptId) } }, include: { practiceAttempt: true }, orderBy: { passedAt: "desc" }, take: 100 });
  const eligible = events.filter(e => teachingPassed(e.practiceAttempt.evaluation as unknown as Evaluation) && (e.context as Record<string, unknown>)._learningPlanId === run.planId);
  const selected = [...new Map(eligible.reverse().map(e => [e.conceptId, e])).values()];
  const configured = Number(process.env.LEARNING_DAILY_NEW_QUESTION_LIMIT ?? "10");
  const limit = Number.isSafeInteger(configured) && configured >= 0 && configured <= 100 ? configured : 10;
  return elearningDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`learning-revision:${studentId}`}))::text`;
    const now = new Date(); now.setUTCHours(0, 0, 0, 0);
    const cards = await tx.revisionStudentCard.count({ where: { studentId, createdAt: { gte: now } } });
    const reserved = await tx.revisionGenerationJob.count({ where: { teachingEvent: { studentId }, status: { in: ["PENDING", "PROCESSING", "NEEDS_REVIEW"] } } });
    let capacity = Math.max(0, limit - cards - reserved), queued = 0;
    for (const event of selected) {
      if (!capacity) break;
      const existing = await tx.revisionGenerationJob.findUnique({ where: { teachingEventId: event.id } });
      if (existing) continue;
      await tx.revisionGenerationJob.create({ data: { teachingEventId: event.id, learningV2: true } }); queued++; capacity--;
    }
    return { queued };
  });
}
