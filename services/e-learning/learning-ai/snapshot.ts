import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import { isObject } from "./capabilities";
import { json } from "./plans";
export const SNAPSHOT_MAX_BYTES = 8192;
export async function dirtySnapshot(tx: Prisma.TransactionClient, studentId: string, offeringId: string) {
  await tx.learningSnapshot.upsert({ where: { studentId_offeringId: { studentId, offeringId } }, create: { studentId, offeringId, snapshot: {}, version: 1 }, update: { dirty: true, version: { increment: 1 } } });
}
export function boundedSnapshot(value: Record<string, unknown>, max = SNAPSHOT_MAX_BYTES) {
  const result = { ...value, concepts: Array.isArray(value.concepts) ? [...value.concepts] : [] };
  while (Buffer.byteLength(JSON.stringify(result), "utf8") > max && result.concepts.length) result.concepts.pop();
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > max) return { schema_version: "1", stale: true, concepts: [] };
  return result;
}
/** Single indexed lookup only; never rebuild from history on a chat request. */
export async function preparedLearningSnapshot(studentId: string, offeringId: string) {
  const row = await elearningDb.learningSnapshot.findUnique({ where: { studentId_offeringId: { studentId, offeringId } } });
  const stale = !row || row.dirty || row.preparedVersion !== row.version || !row.preparedAt || Date.now() - row.preparedAt.getTime() > 15 * 60_000;
  return { ...(row && isObject(row.snapshot) ? row.snapshot : { schema_version: "1", concepts: [] }), stale };
}
export async function refreshLearningSnapshots(limit = 5) {
  const rows = await elearningDb.learningSnapshot.findMany({ where: { dirty: true }, orderBy: { updatedAt: "asc" }, take: limit });
  let refreshed = 0;
  for (const row of rows) {
    const runs = await elearningDb.learningLessonRun.findMany({ where: { studentId: row.studentId, offeringId: row.offeringId }, select: { planId: true, currentConceptId: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5 });
    const plans = runs.map(r => r.planId);
    const [mastery, coverage] = await Promise.all([
      elearningDb.learningMastery.findMany({ where: { studentId: row.studentId, planId: { in: plans } }, orderBy: { updatedAt: "desc" }, take: 30, select: { conceptId: true, planId: true, status: true, pendingReview: true, policyVersion: true } }),
      elearningDb.learningCoverage.findMany({ where: { studentId: row.studentId, planId: { in: plans } }, orderBy: { deliveredAt: "desc" }, take: 30, select: { conceptId: true, planId: true } }),
    ]);
    const concepts = mastery.sort((a, b) => Number(runs.some(r => r.currentConceptId === b.conceptId)) - Number(runs.some(r => r.currentConceptId === a.conceptId)) || a.conceptId.localeCompare(b.conceptId)).map(m => ({ concept_id: m.conceptId, plan_id: m.planId, mastery: m.status, needs_review: m.pendingReview, policy_version: m.policyVersion, coverage: coverage.some(c => c.planId === m.planId && c.conceptId === m.conceptId) ? "EXPLAINED" : "NOT_EXPLAINED" }));
    const snapshot = boundedSnapshot({ schema_version: "1", scope: row.offeringId, version: row.version, stale: false, retention_is_mastery: false, runs: runs.map(r => ({ plan_id: r.planId, current_concept_id: r.currentConceptId, status: r.status })), concepts });
    const saved = await elearningDb.learningSnapshot.updateMany({ where: { id: row.id, version: row.version }, data: { snapshot: json(snapshot), dirty: false, preparedVersion: row.version, preparedAt: new Date() } });
    refreshed += saved.count;
  }
  return refreshed;
}
