import type { Prisma } from "@/generated/prisma-elearning";
import { learningAiFlags } from "./flags";
import { computeMastery, misconceptionCode, type Evidence } from "./policy";
import { json } from "./plans";
import { dirtySnapshot } from "./snapshot";
import { isObject } from "./capabilities";
/** Evaluated revision results affect mastery; a student's FSRS self-rating never does. */
export async function recordLearningRevision(tx: Prisma.TransactionClient, studentId: string, reviewLogId: string, itemId: string) {
  if (!learningAiFlags().AI_V2_ENABLED) return;
  const item = await tx.revisionSessionItem.findFirst({ where: { id: itemId, session: { studentId } }, include: { coverageEvent: true } });
  const context = item?.coverageEvent.context;
  if (!item || !isObject(context) || typeof context._learningPlanId !== "string" || !isObject(item.evaluation) || item.evaluation.needs_review !== false) return;
  const planId = context._learningPlanId, conceptId = item.coverageEvent.conceptId;
  const coverage = await tx.learningCoverage.findUnique({ where: { studentId_planId_conceptId: { studentId, planId, conceptId } } });
  if (!coverage) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`mastery:${studentId}:${planId}:${conceptId}`}))::text`;
  const e = item.evaluation;
  const evidence: Evidence = { kind: "revision", correct: e.answer_correct === true, reasoning: ["strong", "adequate", "weak", "absent"].includes(String(e.reasoning_quality)) ? e.reasoning_quality as Evidence["reasoning"] : "absent", assistance: "independent", needsReview: false, misconceptions: Array.isArray(e.misconceptions) ? (e.misconceptions as unknown[]).filter(isObject).flatMap(m => typeof m.label === "string" ? [misconceptionCode(m.label)] : []) : [] };
  await tx.learningEvaluation.create({ data: { reviewLogId, studentId, planId, conceptId, attemptId: item.coverageEvent.practiceAttemptId, answer: item.answer ?? "", reasoning: item.reasoning ?? "", evidence: json(evidence), evaluation: json(e) } });
  const history = await tx.learningEvaluation.findMany({ where: { studentId, planId, conceptId }, select: { evidence: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const status = computeMastery(history.reverse().map(r => r.evidence as unknown as Evidence), true);
  await tx.learningMastery.upsert({ where: { studentId_planId_conceptId: { studentId, planId, conceptId } }, create: { studentId, planId, conceptId, status }, update: { status } });
  await dirtySnapshot(tx, studentId, coverage.offeringId);
}
