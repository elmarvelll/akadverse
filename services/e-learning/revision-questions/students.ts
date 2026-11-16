import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma-elearning";
import { attachmentContext } from "@/services/e-learning/student/stewart/attachment-context";
import { RevisionWebhookError } from "./errors";
import { learningRequest } from "./providers";
import { hash, teachingPassed, type Evaluation, SCHEDULER_VERSION } from "./policy";
import { scheduleRevisionReview } from "./scheduler";
import { bankQuestionInclude, coveragePool, eligibleFromPool, eligibleBankQuestion, sourceFingerprint, workspaceEnabled } from "./eligibility";
import { signalRevisionContext } from "./learning-context";
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const invalid = (message: string): never => { throw new RevisionWebhookError(400, "INVALID_LEARNING_REQUEST", message); };
export function boundedText(value: unknown, name: string, max = 4000) { if (typeof value !== "string" || !value.trim() || value.length > max) return invalid(`Provide a valid ${name}.`); return value; }
export async function currentStudent(id: string) { const user = await prisma.user.findUnique({ where: { id }, select: { role: true } }); if (user?.role !== "student") throw new RevisionWebhookError(403, "STUDENT_REQUIRED", "A current student account is required."); }
async function studyContext(studentId: string, input: Record<string, unknown>) {
  const context = await attachmentContext(studentId, input);
  const materialId = boundedText(input.documentId, "material identifier", 200);
  if (!context.week.documents.some(doc => doc.id === materialId)) throw new RevisionWebhookError(404, "MATERIAL_UNAVAILABLE", "This material is unavailable in your registered course.");
  return { ...context, materialId };
}
export async function prepareConcepts(studentId: string, input: Record<string, unknown>) {
  const context = await studyContext(studentId, input);
  const material = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: context.materialId } });
  if (material.aiIngestStatus !== "INGESTED") throw new RevisionWebhookError(409, "MATERIAL_NOT_INGESTED", "This material must finish ingestion before concept preparation.");
  const job = await elearningDb.revisionConceptAnalysisJob.upsert({ where: { materialId: material.id }, update: {}, create: { materialId: material.id } });
  const concepts = await elearningDb.revisionConcept.findMany({ where: { materialId: material.id, active: true }, select: { id: true, title: true, description: true, learningObjective: true } });
  return { status: job.status, concepts };
}
function publicAttempt(attempt: { id: string; question: unknown; evaluation: unknown }) {
  const q = attempt.question as Record<string, unknown>;
  return { attemptId: attempt.id, question: { question_text: q.question_text, question_type: q.question_type, options: q.options || [] }, evaluation: attempt.evaluation };
}
export async function createPractice(studentId: string, input: Record<string, unknown>) {
  const context = await studyContext(studentId, input), conceptId = boundedText(input.conceptId, "concept identifier", 200), key = boundedText(input.requestId, "request identifier", 200);
  const concept = await elearningDb.revisionConcept.findFirst({ where: { id: conceptId, materialId: context.materialId, active: true } });
  if (!concept) throw new RevisionWebhookError(404, "CONCEPT_UNAVAILABLE", "Select a concept from this material.");
  const requestHash = hash([context.materialId, conceptId]);
  const existing = await elearningDb.revisionPracticeAttempt.findUnique({ where: { studentId_requestKey: { studentId, requestKey: key } } });
  if (existing) { if (existing.requestHash !== requestHash) throw new RevisionWebhookError(409, "REQUEST_CONFLICT", "This request identifier belongs to another practice activity."); return publicAttempt(existing); }
  const practiceSource = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: context.materialId } });
  const practiceFingerprint = sourceFingerprint(practiceSource);
  const result = await learningRequest("/generate-practice", { document_id: context.materialId, concept_id: concept.externalId, concept_description: concept.description, question_type: "short_answer", max_questions: 1 });
  const q = result?.questions?.[0];
  if (result?.concept_id !== concept.externalId || result.needs_review !== false || !Array.isArray(result.questions) || result.questions.length !== 1 || !q || typeof q.question_id !== "string" || !q.question_id || !["easy", "medium", "hard"].includes(q.difficulty) || q.concept_id !== concept.externalId || typeof q.question_text !== "string" || !q.question_text.trim() || q.question_text.length > 8000 || typeof q.expected_answer !== "string" || !q.expected_answer.trim() || q.expected_answer.length > 8000 || typeof q.explanation !== "string" || !Array.isArray(q.evaluation_criteria) || q.evaluation_criteria.length > 20 || q.evaluation_criteria.some((s: unknown) => typeof s !== "string" || s.length > 2000) || !["multiple_choice", "short_answer", "numeric", "step"].includes(q.question_type)) throw new RevisionWebhookError(502, "PRACTICE_REQUIRES_REVIEW", "The generated practice activity needs review.");
  const attempt = await elearningDb.revisionPracticeAttempt.upsert({ where: { studentId_requestKey: { studentId, requestKey: key } }, update: {}, create: { studentId, conceptId, requestKey: key, requestHash, question: json({ ...q, _sourceFingerprint: practiceFingerprint }) } });
  if (attempt.requestHash !== requestHash) throw new RevisionWebhookError(409, "REQUEST_CONFLICT", "This request identifier belongs to another activity.");
  return publicAttempt(attempt);
}
export function validateEvaluation(value: unknown, conceptId: string): Evaluation {
  const e = value as Evaluation;
  if (!e || e.concept_id !== conceptId || typeof e.answer_correct !== "boolean" || !["strong", "adequate", "weak", "absent"].includes(e.reasoning_quality) || !["independent", "assisted", "insufficient"].includes(e.evidence_strength) || typeof e.needs_review !== "boolean" || !["progress", "reinforce", "teach_prerequisite"].includes(e.recommended_next_step) || typeof e.answer_feedback !== "string" || e.answer_feedback.length > 8000 || typeof e.reasoning_feedback !== "string" || e.reasoning_feedback.length > 8000) throw new RevisionWebhookError(502, "EVALUATION_INVALID", "The practice evaluation could not be verified.");
  return e;
}
export async function evaluatePractice(studentId: string, input: Record<string, unknown>) {
  const context = await studyContext(studentId, input), id = boundedText(input.attemptId, "practice identifier", 200);
  const attempt = await elearningDb.revisionPracticeAttempt.findFirst({ where: { id, studentId }, include: { concept: true, teachingEvent: true } });
  if (!attempt || attempt.concept.materialId !== context.materialId) throw new RevisionWebhookError(404, "PRACTICE_UNAVAILABLE", "This practice activity is unavailable.");
  const answer = boundedText(input.answer, "answer"), reasoning = typeof input.reasoning === "string" && input.reasoning.length <= 4000 ? input.reasoning : "", answerHash = hash([answer, reasoning]);
  if (attempt.evaluation) {
    if (attempt.answerHash !== answerHash) throw new RevisionWebhookError(409, "ANSWER_ALREADY_EVALUATED", "This activity has already been evaluated. Start a new practice attempt to try again.");
    return { evaluation: attempt.evaluation, passed: teachingPassed(attempt.evaluation as unknown as Evaluation), teachingEventId: attempt.teachingEvent?.id };
  }
  const material = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: context.materialId } });
  const fingerprint = (attempt.question as Record<string, unknown>)._sourceFingerprint;
  if (workspaceEnabled() && (fingerprint ? fingerprint !== sourceFingerprint(material) : attempt.createdAt < material.updatedAt)) throw new RevisionWebhookError(409, "MATERIAL_CHANGED", "This material changed. Start a new practice attempt.");
  const token = randomUUID();
  const claimed = await elearningDb.revisionPracticeAttempt.updateMany({ where: { id, studentId, evaluatedAt: null, OR: [{ evaluationLease: null }, { evaluationLease: { lt: new Date() } }] }, data: { evaluationToken: token, evaluationLease: new Date(Date.now() + 90000) } });
  if (!claimed.count) throw new RevisionWebhookError(409, "EVALUATION_PROCESSING", "This answer is already being evaluated.");
  try {
    const q = attempt.question as Record<string, unknown>;
    const result = validateEvaluation(await learningRequest("/evaluate-practice", { concept_id: attempt.concept.externalId, concept_description: attempt.concept.description, question: q.question_text, expected_answer: q.expected_answer, evaluation_criteria: q.evaluation_criteria, student_answer: answer, student_reasoning: reasoning, response_type: q.question_type === "multiple_choice" ? "multiple_choice" : q.question_type === "numeric" ? "number" : q.question_type === "step" ? "step" : "text" }), attempt.concept.externalId);
    if (workspaceEnabled() && sourceFingerprint(await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: context.materialId } })) !== sourceFingerprint(material)) throw new RevisionWebhookError(409, "MATERIAL_CHANGED", "The material changed during evaluation. Start a new attempt.");
    return await elearningDb.$transaction(async tx => {
      const fenced = await tx.revisionPracticeAttempt.updateMany({ where: { id, studentId, evaluationToken: token, evaluatedAt: null, evaluationLease: { gt: new Date() } }, data: { evaluation: json(result), answerHash, evaluatedAt: new Date(), evaluationToken: null, evaluationLease: null } });
      if (!fenced.count) throw new RevisionWebhookError(409, "EVALUATION_LEASE_LOST", "This evaluation is no longer active.");
      let teachingEventId: string | undefined;
      if (teachingPassed(result)) {
        const c = attempt.concept;
        const event = await tx.revisionTeachingEvent.create({ data: { studentId, conceptId: c.id, practiceAttemptId: id, taughtSummary: `${c.description.slice(0, 1400)}\nLearning objective: ${c.learningObjective.slice(0, 500)}`, context: json({ _sourceFingerprint: sourceFingerprint(material), subject: c.subject, curriculum: c.curriculum, level: c.level, topic: c.topic, concept_id: c.externalId, concept_title: c.description.slice(0, 2000), language: c.language }), generation: { create: {} } } });
        teachingEventId = event.id;
      }
      return { evaluation: result, passed: teachingPassed(result), teachingEventId };
    });
  } catch (error) { await elearningDb.revisionPracticeAttempt.updateMany({ where: { id, evaluationToken: token }, data: { evaluationToken: null, evaluationLease: null } }).catch(() => {}); throw error; }
}
export async function dueRevisionCards(studentId: string) {
  if (workspaceEnabled()) {
    const pool = await coveragePool(studentId);
    const rows = await elearningDb.revisionStudentCard.findMany({ where: { studentId, dueAt: { lte: new Date() }, question: { scopeKey: { in: [...pool.scopes.keys()] }, governance: { publicationStatus: "PUBLISHED" }, concept: { active: true, material: { aiIngestStatus: "INGESTED" } } } }, orderBy: { dueAt: "asc" }, take: 50, include: { question: { include: bankQuestionInclude } } });
    return rows.filter(c => { try { eligibleFromPool(pool, c.question); return true; } catch (e) { if (e instanceof RevisionWebhookError && e.status === 404) return false; throw e; } }).map(c => ({ id: c.id, dueAt: c.dueAt, version: c.version, question: { stem: c.question.stem, type: c.question.type, options: c.question.options, conceptTitle: c.question.conceptTitle } }));
  }
  return elearningDb.revisionStudentCard.findMany({ where: { studentId, dueAt: { lte: new Date() } }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 50, select: { id: true, dueAt: true, version: true, question: { select: { stem: true, type: true, options: true, conceptTitle: true } } } });
}
export async function revealRevisionCard(studentId: string, id: string) {
  if (workspaceEnabled()) { const owned = await elearningDb.revisionStudentCard.findFirst({ where: { id, studentId }, select: { questionId: true } }); if (!owned) throw new RevisionWebhookError(404, "CARD_UNAVAILABLE", "This card is unavailable."); await eligibleBankQuestion(studentId, owned.questionId); }
  const card = await elearningDb.revisionStudentCard.findFirst({ where: { id, studentId }, select: { question: { select: { correctAnswer: true, explanation: true, options: true } } } });
  if (!card) throw new RevisionWebhookError(404, "CARD_UNAVAILABLE", "This revision card is unavailable."); return card.question;
}
export async function reviewRevisionCard(studentId: string, input: Record<string, unknown>) {
  const id = boundedText(input.cardId, "card identifier", 200), requestKey = boundedText(input.requestId, "review identifier", 200), rating = input.rating, expectedVersion = input.version;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 4 || typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) return invalid("Choose a valid review rating and card version.");
  const requestHash = input.sessionItemId ? hash([id, rating, expectedVersion, input.sessionItemId]) : hash([id, rating, expectedVersion]);
  if (workspaceEnabled()) { const owned = await elearningDb.revisionStudentCard.findFirst({ where: { id, studentId }, select: { questionId: true } }); if (!owned) throw new RevisionWebhookError(404, "CARD_UNAVAILABLE", "This card is unavailable."); await eligibleBankQuestion(studentId, owned.questionId, typeof input.offeringId === "string" ? input.offeringId : undefined); }
  const result = await elearningDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "RevisionStudentCard" WHERE "id" = ${id} AND "studentId" = ${studentId} FOR UPDATE`;
    const previous = await tx.revisionReviewLog.findUnique({ where: { studentId_requestKey: { studentId, requestKey } } });
    if (previous) { if (previous.requestHash !== requestHash) throw new RevisionWebhookError(409, "REVIEW_CONFLICT", "This review identifier was already used for different input."); return { state: previous.nextState, replay: true }; }
    const card = await tx.revisionStudentCard.findFirst({ where: { id, studentId } });
    if (!card) throw new RevisionWebhookError(404, "CARD_UNAVAILABLE", "This revision card is unavailable.");
    if (card.version !== expectedVersion || card.schedulerVersion !== SCHEDULER_VERSION) throw new RevisionWebhookError(409, "CARD_CHANGED", "Reload this card before submitting a review.");
    const sessionItem = typeof input.sessionItemId === "string" ? await tx.revisionSessionItem.findFirst({ where: { id: input.sessionItemId, cardId: id, cardVersion: expectedVersion, status: "EVALUATED", evaluatedAt: { not: null }, session: { studentId } } }) : null;
    if (input.sessionItemId && !sessionItem) throw new RevisionWebhookError(409, "SESSION_CHANGED", "Reload your revision session before rating.");
    const scheduled = await scheduleRevisionReview(card.state, rating);
    await tx.revisionStudentCard.update({ where: { id }, data: { state: json(scheduled.card), dueAt: scheduled.card.dueAt, version: { increment: 1 } } });
    const log = await tx.revisionReviewLog.create({ data: { studentCardId: id, studentId, requestKey, requestHash, rating, previousState: card.state as Prisma.InputJsonValue, nextState: json(scheduled.card), schedulerLog: json(scheduled.revlog) } });
    if (sessionItem) await tx.revisionSessionItem.update({ where: { id: sessionItem.id }, data: { status: "REVIEWED", reviewLogId: log.id } });
    return { state: scheduled.card, replay: false };
  }, { timeout: 15000 });
  if (workspaceEnabled() && !result.replay) { try { await elearningDb.$transaction(tx => signalRevisionContext(tx, studentId)); } catch { console.warn("[revisions] Context refresh signal failed; review remains committed."); } }
  return result;
}
