import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import { workspaceEnabled } from "./eligibility";
export async function signalRevisionContext(tx: Prisma.TransactionClient, studentId: string) {
  if (!workspaceEnabled()) return;
  await tx.revisionLearningContext.upsert({ where: { studentId }, create: { studentId }, update: { dirty: true, version: { increment: 1 }, nextAttemptAt: new Date() } });
}
export async function preparedRevisionContext(studentId: string) {
  if (!workspaceEnabled()) return null;
  try { const row = await elearningDb.revisionLearningContext.findUnique({ where: { studentId } }); return row?.snapshot ? { evidence: row.snapshot, refreshing: row.dirty, preparedAt: row.preparedAt?.toISOString() || null } : null; }
  catch { return null; } // Learning context cannot make Stewart or Revisions unavailable.
}
export async function refreshRevisionContexts() {
  if (!workspaceEnabled()) return 0;
  // The review log is the durable recovery source if the post-commit signal failed.
  const missed = await elearningDb.$queryRaw<{ studentId: string }[]>`SELECT r."studentId" FROM "RevisionReviewLog" r JOIN "RevisionSessionItem" i ON i."reviewLogId" = r."id" LEFT JOIN "RevisionLearningContext" c ON c."studentId" = r."studentId" WHERE c."studentId" IS NULL OR (c."dirty" = false AND (c."preparedAt" IS NULL OR r."reviewedAt" > c."preparedAt")) GROUP BY r."studentId" ORDER BY MAX(r."reviewedAt") DESC LIMIT 50`;
  for (const row of missed) await elearningDb.$transaction(tx => signalRevisionContext(tx, row.studentId));
  const rows = await elearningDb.revisionLearningContext.findMany({ where: { dirty: true, nextAttemptAt: { lte: new Date() }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, take: 5, orderBy: { updatedAt: "asc" } });
  let completed = 0;
  for (const row of rows) {
    const token = randomUUID();
    const claimed = await elearningDb.revisionLearningContext.updateMany({ where: { studentId: row.studentId, version: row.version, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { claimToken: token, leaseUntil: new Date(Date.now() + 60000) } });
    if (!claimed.count) continue;
    try {
      const items = await elearningDb.revisionSessionItem.findMany({ where: { session: { studentId: row.studentId }, status: "REVIEWED" }, include: { question: { select: { conceptTitle: true } }, coverageEvent: { select: { conceptId: true, concept: { select: { material: { select: { courseOfferingId: true } } } } } }, review: { select: { rating: true, reviewedAt: true } } }, orderBy: { review: { reviewedAt: "desc" } }, take: 100 });
      const concepts = new Map<string, { conceptId: string; offeringId: string; concept: string; reviews: number; independentCorrect: number; incorrect: number; difficultRecall: number; mastery: string; retrievalEvidence: string }>();
      for (const item of items) {
        const title = item.question.conceptTitle, evaluation = item.evaluation as Record<string, unknown>;
        const key = item.coverageEvent.conceptId, value = concepts.get(key) || { conceptId: key, offeringId: item.coverageEvent.concept.material.courseOfferingId, concept: title, reviews: 0, independentCorrect: 0, incorrect: 0, difficultRecall: 0, mastery: "not_assessed", retrievalEvidence: "insufficient_evidence" };
        value.reviews++; if (evaluation.answer_correct === true && evaluation.evidence_strength === "independent" && evaluation.needs_review === false) { value.independentCorrect++; }
        if (evaluation.answer_correct === false) value.incorrect++; if ((item.review?.rating || 4) <= 2) value.difficultRecall++;
        concepts.set(key, value);
      }
      // Aggregate distinct historical questions in the worker, not on ordinary review requests.
      const distinct = await elearningDb.$queryRaw<{ conceptId: string; questions: number }[]>`SELECT e."conceptId", COUNT(DISTINCT i."questionId")::int AS questions FROM "RevisionSessionItem" i JOIN "RevisionSession" s ON s.id = i."sessionId" JOIN "RevisionTeachingEvent" e ON e.id = i."coverageEventId" WHERE s."studentId" = ${row.studentId} AND i.status = 'REVIEWED' AND e."conceptId" IN (SELECT jsonb_array_elements_text(${JSON.stringify([...concepts.keys()])}::jsonb)) AND i.evaluation->>'answer_correct' = 'true' AND i.evaluation->>'evidence_strength' = 'independent' AND i.evaluation->>'needs_review' = 'false' GROUP BY e."conceptId"`;
      for (const evidence of distinct) if (evidence.questions >= 3) concepts.get(evidence.conceptId)!.retrievalEvidence = "consistent_retrieval";
      const snapshot = { schemaVersion: 1, basis: "latest_100_completed_revision_answers", concepts: [...concepts.values()].slice(0, 30), retentionIsNotMastery: true };
      const changed = await elearningDb.revisionLearningContext.updateMany({ where: { studentId: row.studentId, claimToken: token, version: row.version }, data: { snapshot, preparedVersion: row.version, preparedAt: items[0]?.review?.reviewedAt || new Date(), dirty: false, claimToken: null, leaseUntil: null, attempts: 0 } });
      if (changed.count) completed++;
      else await elearningDb.revisionLearningContext.updateMany({ where: { studentId: row.studentId, claimToken: token }, data: { claimToken: null, leaseUntil: null } });
    } catch {
      await elearningDb.revisionLearningContext.updateMany({ where: { studentId: row.studentId, claimToken: token }, data: { claimToken: null, leaseUntil: null, attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 60000) } });
    }
  }
  return completed;
}

// Keep the optional AI reference complete and small; never cut JSON mid-value.
export function revisionContextExcerpt(snapshot: unknown) {
  const value = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const rows = Array.isArray(value.concepts) ? value.concepts : [];
  const concepts = rows.filter(c => c && typeof c === "object" && typeof c.concept === "string").slice(0, 3).map(c => ({
    concept: c.concept.slice(0, 100),
    reviews: typeof c.reviews === "number" ? c.reviews : null,
    independentCorrect: typeof c.independentCorrect === "number" ? c.independentCorrect : null,
    incorrect: typeof c.incorrect === "number" ? c.incorrect : null,
    difficultRecall: typeof c.difficultRecall === "number" ? c.difficultRecall : null,
    retrievalEvidence: ["consistent_retrieval", "insufficient_evidence"].includes(c.retrievalEvidence) ? c.retrievalEvidence : "not_assessed",
  }));
  let text = JSON.stringify({ concepts, retentionIsNotMastery: true });
  while (text.length > 900 && concepts.length) { concepts.pop(); text = JSON.stringify({ concepts, retentionIsNotMastery: true }); }
  return text;
}
