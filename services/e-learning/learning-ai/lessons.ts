import { elearningDb } from "@/lib/db/elearning";
import { attachmentContext } from "../student/stewart/attachment-context";
import { RevisionWebhookError } from "../revision-questions/errors";
import { hash } from "../revision-questions/policy";
import { sourceFingerprint } from "../revision-questions/eligibility";
import { learningAiFlags } from "./flags";
import { prepareLearningPlan, json } from "./plans";
import { allowedActions, developed, type LearningState, type Trigger, type Action } from "./policy";
import { dirtySnapshot } from "./snapshot";
export const problem = (code: string, message: string, status = 409): never => { throw new RevisionWebhookError(status, code, message); };
export function requireLearning() { if (!learningAiFlags().AI_V2_ENABLED) problem("LEARNING_DISABLED", "Personalized learning is not enabled.", 503); }
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export async function ownedRun(studentId: string, runId: string) {
  requireLearning();
  const run = await elearningDb.learningLessonRun.findFirst({ where: { id: runId, studentId }, include: { plan: { include: { version: true, concepts: { orderBy: { position: "asc" } } } } } });
  if (!run) return problem("RUN_UNAVAILABLE", "This lesson is unavailable.", 404);
  const ctx = await attachmentContext(studentId, { courseId: run.courseId, weekNumber: run.week, documentId: run.materialId });
  const material = await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: run.materialId } });
  if (ctx.workspace.offeringId !== run.offeringId || material.aiIngestStatus !== "INGESTED" || sourceFingerprint(material) !== run.plan.version.fingerprint || run.plan.status !== "READY") return problem("MATERIAL_CHANGED", "This material changed. Start a lesson for the current version.");
  return { run, ctx, material };
}
export async function lessonState(run: Awaited<ReturnType<typeof ownedRun>>["run"]) {
  const ids = run.plan.concepts.map(c => c.conceptId);
  const [concepts, mastery, coverage, latest] = await Promise.all([
    elearningDb.revisionConcept.findMany({ where: { id: { in: ids }, active: true } }),
    elearningDb.learningMastery.findMany({ where: { studentId: run.studentId, planId: run.planId } }),
    elearningDb.learningCoverage.findMany({ where: { studentId: run.studentId, planId: run.planId } }),
    elearningDb.learningLessonAction.findFirst({ where: { runId: run.id, conceptId: run.currentConceptId, attemptId: { not: null }, action: { in: ["GENERATE_PRACTICE", "REASONING_EXERCISE", "TRANSFER_TASK"] }, status: "COMPLETED" }, orderBy: { createdAt: "desc" } }),
  ]);
  if (concepts.length !== ids.length) return problem("PLAN_UNAVAILABLE", "A concept in this lesson is unavailable.");
  const currentIndex = run.plan.concepts.findIndex(c => c.conceptId === run.currentConceptId), node = run.plan.concepts[currentIndex];
  if (!node) return problem("PLAN_INVALID", "This lesson needs review.");
  const attempt = latest?.attemptId ? await elearningDb.revisionPracticeAttempt.findFirst({ where: { id: latest.attemptId, studentId: run.studentId, conceptId: run.currentConceptId, evaluatedAt: null } }) : null;
  const currentMastery = mastery.find(m => m.conceptId === run.currentConceptId);
  const prerequisites = strings(node.prerequisites);
  const state: LearningState = {
    current: run.currentConceptId, prerequisites, next: run.plan.concepts[currentIndex + 1]?.conceptId ?? null,
    explained: coverage.some(c => c.conceptId === run.currentConceptId), mastery: currentMastery?.status ?? "UNKNOWN",
    prerequisitesReady: strings(run.plan.missingPrerequisites).length === 0 && prerequisites.every(id => mastery.some(m => m.conceptId === id && developed(m.status) && !m.pendingReview)),
    allHandled: ids.every(id => coverage.some(c => c.conceptId === id) && mastery.some(m => m.conceptId === id && developed(m.status) && !m.pendingReview)),
    pendingReview: currentMastery?.pendingReview ?? false, attemptActive: !!attempt, consecutiveReinforce: currentMastery?.consecutiveReinforce ?? 0,
  };
  return { state, concepts, mastery, coverage, attempt, allowed: allowedActions(state).filter(a => a !== "GIVE_HINT" || learningAiFlags().HINTS_ENABLED) };
}
export async function lessonView(studentId: string, runId: string) {
  const { run } = await ownedRun(studentId, runId), state = await lessonState(run);
  const actions = await elearningDb.learningLessonAction.findMany({ where: { runId }, orderBy: { createdAt: "desc" }, take: 8 });
  return { id: run.id, status: run.status, busy: run.busy, currentConceptId: run.currentConceptId, mode: learningAiFlags().orchestratorMode,
    concepts: run.plan.concepts.map(node => ({ id: node.conceptId, title: state.concepts.find(c => c.id === node.conceptId)!.title, coverage: state.coverage.some(c => c.conceptId === node.conceptId) ? "EXPLAINED" : "NOT_EXPLAINED", mastery: state.mastery.find(m => m.conceptId === node.conceptId)?.status ?? "UNKNOWN" })),
    activeQuestion: state.attempt ? { id: state.attempt.id, text: (state.attempt.question as Record<string, unknown>).question_text, type: (state.attempt.question as Record<string, unknown>).question_type } : null,
    allowedActions: state.allowed,
    actions: actions.reverse().map(a => ({ id: a.id, status: a.status, action: a.action, result: a.result, errorCode: a.errorCode, delivered: !!a.deliveredAt })),
  };
}
export async function startLesson(studentId: string, input: Record<string, unknown>) {
  requireLearning();
  const ctx = await attachmentContext(studentId, input);
  if (typeof input.documentId !== "string" || !ctx.week.documents.some(d => d.id === input.documentId)) return problem("MATERIAL_UNAVAILABLE", "Select an available material.", 404);
  if (!learningAiFlags().AI_INGEST_PIPELINE_ENABLED) return problem("PLANS_DISABLED", "Learning plan preparation is not enabled.", 503);
  const { plan } = await prepareLearningPlan(input.documentId);
  if (!plan) return { status: "PREPARING", message: "Preparing this material's learning plan." };
  const first = await elearningDb.learningPlanConcept.findFirst({ where: { planId: plan.id }, orderBy: { position: "asc" } });
  if (!first) return problem("PLAN_EMPTY", "This learning plan needs review.");
  const run = await elearningDb.$transaction(async tx => {
    let r = await tx.learningLessonRun.upsert({ where: { studentId_planId: { studentId, planId: plan.id } }, update: { studentId }, create: { studentId, courseId: ctx.workspace.course.id, offeringId: ctx.workspace.offeringId!, materialId: input.documentId as string, week: ctx.week.weekNumber, planId: plan.id, currentConceptId: first.conceptId } });
    if (r.status === "COMPLETED" && !r.busy) {
      const needsStudy = await tx.learningMastery.findFirst({ where: { studentId, planId: plan.id, status: "NEEDS_REINFORCEMENT" }, orderBy: { updatedAt: "desc" } });
      if (needsStudy) r = await tx.learningLessonRun.update({ where: { id: r.id }, data: { status: "ACTIVE", currentConceptId: needsStudy.conceptId, version: { increment: 1 } } });
    }
    await dirtySnapshot(tx, studentId, r.offeringId); return r;
  });
  return { status: "READY", run: await lessonView(studentId, run.id) };
}
const commands = { explain: "EXPLAIN_CONCEPT", guided: "SHOW_GUIDED_EXAMPLE", practice: "GENERATE_PRACTICE", recap: "RECAP", question: "CONTINUE_CONVERSATION", hint: "GIVE_HINT" } as const;
export async function queueLessonCommand(studentId: string, runId: string, input: Record<string, unknown>) {
  const { run } = await ownedRun(studentId, runId);
  const command = input.command;
  if (typeof command !== "string" || ![...Object.keys(commands), "next", "answer"].includes(command)) return problem("INVALID_COMMAND", "Choose a supported learning action.", 400);
  const requestId = input.requestId;
  if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return problem("INVALID_REQUEST_ID", "A valid request identifier is required.", 400);
  const text = (key: string, required = false) => { const value = input[key]; if ((required && (typeof value !== "string" || !value.trim())) || (value !== undefined && (typeof value !== "string" || value.length > 4000))) return problem("INVALID_INPUT", "Provide a valid answer or question.", 400); return typeof value === "string" ? value : ""; };
  const payload = { question: text("question", command === "question"), answer: text("answer", command === "answer" || command === "hint"), reasoning: text("reasoning"), explicit: input.explicit === true };
  const requestHash = hash([runId, command, payload]);
  const old = await elearningDb.learningLessonAction.findUnique({ where: { requestId } });
  if (old) { if (old.runId !== run.id || old.requestHash !== requestHash) return problem("REQUEST_CONFLICT", "That request identifier is already in use."); return { actionId: old.id, status: old.status }; }
  if (run.status === "COMPLETED") return problem("LESSON_COMPLETED", "This lesson is complete. Open Revisions to continue practicing.");
  const state = await lessonState(run);
  if (command === "next" && learningAiFlags().orchestratorMode === "off") return problem("ORCHESTRATOR_DISABLED", "Choose a learning activity to continue.");
  if (command === "hint" && !learningAiFlags().HINTS_ENABLED) return problem("HINTS_DISABLED", "Hints are not enabled.", 503);
  if (command === "answer" && state.state.pendingReview) return problem("REVIEW_REQUIRED", "A reviewer must check this concept before another evaluation.");
  if (command === "answer" && !state.attempt) return problem("ATTEMPT_UNAVAILABLE", "Start a practice activity before submitting an answer.");
  if (command !== "next" && command !== "answer" && !state.allowed.includes(commands[command as keyof typeof commands])) return problem("ACTION_NOT_ALLOWED", "Complete the required learning steps before this activity.");
  const last = await elearningDb.learningLessonAction.findFirst({ where: { runId, status: "COMPLETED", deliveredAt: { not: null } }, orderBy: { completedAt: "desc" } });
  const lastEvidence = command === "next" ? await elearningDb.learningEvaluation.findFirst({ where: { studentId, planId: run.planId, conceptId: run.currentConceptId }, orderBy: { createdAt: "desc" }, select: { evidence: true, createdAt: true } }) : null;
  const failedRevision = lastEvidence && (lastEvidence.evidence as Record<string, unknown>).kind === "revision" && (lastEvidence.evidence as Record<string, unknown>).correct === false && (!last || lastEvidence.createdAt > (last.completedAt ?? last.createdAt));
  const trigger: Trigger = command === "hint" ? "HINT_REQUESTED" : command === "question" ? "STUDENT_ASKED" : failedRevision ? "REVISION_REVIEW_COMPLETED" : last?.action === "EVALUATE_PRACTICE" ? "ATTEMPT_EVALUATED" : last?.action === "SHOW_GUIDED_EXAMPLE" ? "GUIDED_COMPLETED" : !last ? "LESSON_STARTED" : ["EXPLAIN_CONCEPT", "REINFORCE_CONCEPT", "TEACH_PREREQUISITE"].includes(last.action ?? "") ? "EXPLANATION_DELIVERED" : "RETURN_VISIT";
  return elearningDb.$transaction(async tx => {
    const fenced = await tx.learningLessonRun.updateMany({ where: { id: run.id, studentId, version: run.version, busy: false, status: { in: ["ACTIVE", "PAUSED"] } }, data: { busy: true, version: { increment: 1 } } });
    if (!fenced.count) return problem("LESSON_BUSY", "Wait for the current activity to finish, then refresh.");
    const action = await tx.learningLessonAction.create({ data: { requestId, requestHash, runId, runVersion: run.version + 1, conceptId: run.currentConceptId, command, trigger, action: command === "answer" ? "EVALUATE_PRACTICE" : command === "next" ? null : commands[command as keyof typeof commands], input: json(payload), attemptId: command === "answer" || command === "hint" ? state.attempt?.id : undefined } });
    return { actionId: action.id, status: action.status };
  });
}
/** Delivery is an explicit owned browser acknowledgement, never a generation-side effect. */
export async function acknowledgeDelivery(studentId: string, runId: string, actionId: string) {
  const { run } = await ownedRun(studentId, runId);
  return elearningDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "LearningLessonAction" WHERE "id" = ${actionId} AND "runId" = ${runId} FOR UPDATE`;
    const action = await tx.learningLessonAction.findFirst({ where: { id: actionId, runId, status: "COMPLETED" } });
    if (!action) return problem("ACTION_UNAVAILABLE", "This activity is unavailable.", 404);
    if (action.deliveredAt) return { delivered: true };
    const result = action.result as Record<string, unknown> | null;
    const sources = Array.isArray(result?.sources) ? result.sources.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && (s as Record<string, unknown>).document_id === run.materialId && (s as Record<string, unknown>).source_type === "course_material") : [];
    const qualifies = ["EXPLAIN_CONCEPT", "REINFORCE_CONCEPT", "RECAP", "TEACH_PREREQUISITE"].includes(action.action ?? "") && sources.length > 0;
    await tx.learningLessonAction.update({ where: { id: action.id }, data: { deliveredAt: new Date() } });
    if (qualifies) {
      await tx.learningCoverage.upsert({ where: { studentId_planId_conceptId: { studentId, planId: run.planId, conceptId: action.conceptId } }, update: { conceptId: action.conceptId }, create: { studentId, offeringId: run.offeringId, planId: run.planId, conceptId: action.conceptId, actionId: action.id, sources: json(sources) } });
      await tx.learningMastery.upsert({ where: { studentId_planId_conceptId: { studentId, planId: run.planId, conceptId: action.conceptId } }, update: { conceptId: action.conceptId }, create: { studentId, planId: run.planId, conceptId: action.conceptId, status: "INTRODUCED" } });
    }
    if (qualifies) await tx.learningMastery.updateMany({ where: { studentId, planId: run.planId, conceptId: action.conceptId, status: "UNKNOWN" }, data: { status: "INTRODUCED" } });
    await dirtySnapshot(tx, studentId, run.offeringId);
    return { delivered: true };
  });
}
export const actionForCommand = (command: string): Action | undefined => commands[command as keyof typeof commands];
