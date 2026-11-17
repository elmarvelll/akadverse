import { elearningDb } from "@/lib/db/elearning";
import type { Prisma, RevisionConceptAnalysisJob } from "@/generated/prisma-elearning";
import { sourceFingerprint, sourceSnapshot } from "../revision-questions/eligibility";
import { validateAnalysis, type AnalysisResult } from "../revision-questions/analysis-contract";
import { conceptKey } from "../revision-questions/policy";
import { RevisionWebhookError } from "../revision-questions/errors";
import { learningAiFlags } from "./flags";
import { callAi, LearningAiError } from "./client";
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
/** Validate the complete graph before any official concept/plan rows are written. */
export function orderedConcepts(result: AnalysisResult, maxConcepts = 12) {
  const plan = result.lesson_plan;
  if ((plan.concepts.length === 1 && result.chunks_analysed > 1 && maxConcepts >= 3) || /fallback/i.test(plan.notes ?? "") || plan.concepts.length > 20) throw new Error("SUSPECT_ANALYSIS");
  const byId = new Map(plan.concepts.map(c => [c.concept_id, c]));
  const resultIds: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error("CYCLIC_PREREQUISITES");
    const concept = byId.get(id); if (!concept) throw new Error("UNKNOWN_PREREQUISITE");
    if (concept.title.length > 200 || concept.description.length > 2000 || concept.learning_objective.length > 2000) throw new Error("ANALYSIS_TOO_LARGE");
    visiting.add(id);
    for (const prerequisite of concept.prerequisite_concept_ids) visit(prerequisite);
    visiting.delete(id); visited.add(id); resultIds.push(id);
  }
  for (const section of plan.sections) for (const id of section.concept_ids) visit(id);
  for (const concept of plan.concepts) visit(concept.concept_id);
  return resultIds.map(id => byId.get(id)!);
}
export async function prepareLearningPlan(materialId: string) {
  const material = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: materialId } });
  if (material.aiIngestStatus !== "INGESTED") throw new RevisionWebhookError(409, "MATERIAL_NOT_INGESTED", "Wait for this material to finish ingestion.");
  const version = await elearningDb.learningMaterialVersion.upsert({
    where: { materialId_fingerprint: { materialId, fingerprint: sourceFingerprint(material) } }, update: { fingerprint: sourceFingerprint(material) },
    create: { materialId, offeringId: material.courseOfferingId, fingerprint: sourceFingerprint(material), source: json(sourceSnapshot(material)) },
  });
  const found = await elearningDb.learningPlan.findUnique({ where: { materialVersionId: version.id } });
  const plan = found?.status === "READY" ? found : undefined;
  if (!plan) {
    const job = await elearningDb.revisionConceptAnalysisJob.upsert({ where: { materialId }, update: { materialId }, create: { materialId, learningV2: true } });
    if (job.status === "COMPLETED") await elearningDb.revisionConceptAnalysisJob.updateMany({ where: { id: job.id, status: "COMPLETED" }, data: { status: "PENDING", learningV2: true, nextAttemptAt: new Date(), completedAt: null } });
    if (job.status === "PENDING" && !job.learningV2) await elearningDb.revisionConceptAnalysisJob.updateMany({ where: { id: job.id, status: "PENDING", claimToken: null }, data: { learningV2: true } });
    if (job.status === "FAILED") throw new RevisionWebhookError(409, "PLAN_REQUIRES_REVIEW", "This material's learning plan needs review before study can start.");
  }
  return { version, plan };
}
export async function analyseLearningPlan(job: RevisionConceptAnalysisJob) {
  const material = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: job.materialId }, include: { courseOffering: { include: { curriculumCourse: { include: { course: true, curriculum: true } } } } } });
  if (material.aiIngestStatus !== "INGESTED") throw new RevisionWebhookError(409, "MATERIAL_NOT_INGESTED", "Material is not ready.");
  const fingerprint = sourceFingerprint(material);
  const immutableVersion = await elearningDb.learningMaterialVersion.upsert({ where: { materialId_fingerprint: { materialId: material.id, fingerprint } }, update: {}, create: { materialId: material.id, offeringId: material.courseOfferingId, fingerprint, source: json(sourceSnapshot(material)) } });
  let raw: unknown;
  try {
    const response = await callAi("ANALYSE_MATERIAL", { document_id: material.id, max_concepts: 12 }, { requestId: immutableVersion.id, courseId: material.courseOfferingId });
    if (response.metadata.status === "degraded") throw new Error("SUSPECT_ANALYSIS");
    raw = response.body;
  } catch (error) {
    if (error instanceof LearningAiError && ["UPSTREAM_UNCERTAIN", "REQUEST_NOT_REPLAYABLE", "REQUEST_IN_PROGRESS"].includes(error.code)) throw new RevisionWebhookError(503, "AI_REQUEST_UNCERTAIN", "Analysis outcome requires reconciliation.");
    throw error;
  }
  const analysis = validateAnalysis(raw, material.id), ordered = orderedConcepts(analysis);
  await elearningDb.$transaction(async tx => {
    const current = await tx.courseMaterial.findUniqueOrThrow({ where: { id: material.id } });
    if (current.aiIngestStatus !== "INGESTED" || sourceFingerprint(current) !== fingerprint) throw new Error("MATERIAL_CHANGED");
    const fence = await tx.revisionConceptAnalysisJob.updateMany({ where: { id: job.id, claimToken: job.claimToken, status: "PROCESSING", leaseUntil: { gt: new Date() } }, data: { status: "COMPLETED", completedAt: new Date(), claimToken: null, leaseUntil: null, lastErrorCode: null } });
    if (!fence.count) throw new Error("ANALYSIS_LEASE_LOST");
    const version = await tx.learningMaterialVersion.upsert({ where: { materialId_fingerprint: { materialId: material.id, fingerprint } }, update: {}, create: { materialId: material.id, offeringId: material.courseOfferingId, fingerprint, source: json(sourceSnapshot(material)) } });
    if (await tx.learningPlan.findUnique({ where: { materialVersionId: version.id } })) return;
    const cc = material.courseOffering.curriculumCourse;
    const mapped = new Map<string, string>();
    for (const c of ordered) {
      // Namespace local AI IDs by immutable version. Never match canonical identity by title.
      const externalId = `${version.id}:${c.concept_id}`;
      const concept = await tx.revisionConcept.create({ data: { materialId: material.id, externalId, title: c.title, description: c.description, learningObjective: c.learning_objective,
        conceptKey: conceptKey({ subject: cc.course.title, curriculum: cc.curriculum.name, level: String(cc.level), title: c.title, learningObjective: c.learning_objective }),
        subject: cc.course.title, curriculum: cc.curriculum.name, level: String(cc.level), topic: material.title, language: "en" } });
      mapped.set(c.concept_id, concept.id);
    }
    await tx.learningPlan.create({ data: { materialVersionId: version.id, sections: json(analysis.lesson_plan.sections.map(s => ({ id: s.section_id, title: s.title, conceptIds: s.concept_ids.map(id => mapped.get(id)) }))), missingPrerequisites: json(analysis.lesson_plan.missing_prerequisites),
      concepts: { create: ordered.map((c, position) => ({ conceptId: mapped.get(c.concept_id)!, sourceLocalId: c.concept_id, position, prerequisites: json(c.prerequisite_concept_ids.map(id => mapped.get(id)!)), sourceChunks: json(c.source_chunk_ids) })) } } });
  });
}

/** Queue only; ingestion callback/reconciliation never performs analysis inline. */
export async function queueIngestedLearningPlan(tx: Prisma.TransactionClient, materialId: string) {
  const flags = learningAiFlags();
  if (!flags.AI_V2_ENABLED || !flags.AI_INGEST_PIPELINE_ENABLED) return;
  await tx.revisionConceptAnalysisJob.upsert({ where: { materialId }, update: { materialId }, create: { materialId, learningV2: true } });
}
