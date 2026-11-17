import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { LearningLessonAction } from "@/generated/prisma-elearning";
import { claimRevisionWork, processConceptAnalysis, processRevisionGeneration } from "../revision-questions/worker";
import { teachingPassed, type Evaluation } from "../revision-questions/policy";
import { sourceFingerprint } from "../revision-questions/eligibility";
import { callAi, LearningAiError } from "./client";
import { isObject } from "./capabilities";
import { learningAiFlags } from "./flags";
import { actionForCommand, ownedRun, lessonState, problem } from "./lessons";
import { guardDecision, fallback, computeMastery, type Evidence, type Action, type Trigger } from "./policy";
import { executeLearningAction, type Execution, type Scope } from "./executor";
import { json } from "./plans";
import { dirtySnapshot, refreshLearningSnapshots, preparedLearningSnapshot } from "./snapshot";
import { queueEligibleLearningRevision } from "./revision";

export async function claimLessonAction(studentId?: string) {
  return elearningDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72419039)::text`;
    const stale = await tx.learningLessonAction.findMany({ where: { status: "PROCESSING", leaseUntil: { lt: new Date() } }, take: 20 });
    for (const action of stale) {
      await tx.learningLessonAction.update({ where: { id: action.id }, data: { status: "UNCERTAIN", errorCode: "WORKER_OUTCOME_UNCERTAIN" } });
      await tx.learningLessonRun.updateMany({ where: { id: action.runId, version: action.runVersion }, data: { busy: false } });
    }
    // Uncertain work retains capacity until reconciled; never silently start duplicate remote generations.
    const occupied = await tx.learningLessonAction.count({ where: { leaseToken: { not: null } } }) + await tx.revisionGenerationJob.count({ where: { claimToken: { not: null } } }) + await tx.revisionConceptAnalysisJob.count({ where: { claimToken: { not: null } } });
    if (occupied >= 2) return null;
    const row = await tx.learningLessonAction.findFirst({ where: { status: "PENDING", ...(studentId ? { run: { studentId } } : {}) }, orderBy: { createdAt: "asc" } });
    if (!row) return null;
    return tx.learningLessonAction.update({ where: { id: row.id }, data: { status: "PROCESSING", leaseToken: randomUUID(), leaseUntil: new Date(Date.now() + 210_000) } });
  });
}
async function decide(scope: Scope, queued: LearningLessonAction) {
  const info = await lessonState(scope.run), flags = learningAiFlags();
  const evidenceRows = await elearningDb.learningEvaluation.findMany({ where: { studentId: scope.run.studentId, planId: scope.run.planId, conceptId: info.state.current }, select: { evidence: true, evaluation: true }, orderBy: { createdAt: "desc" }, take: 3 });
  const latest = evidenceRows[0]?.evidence as unknown as Evidence | undefined;
  const snapshot = flags.SNAPSHOT_ENABLED ? await preparedLearningSnapshot(scope.run.studentId, scope.run.offeringId) : {};
  const hints = info.attempt ? await elearningDb.learningHintEvent.count({ where: { studentId: scope.run.studentId, attemptId: info.attempt.id } }) : 0;
  const attemptCount = await elearningDb.revisionPracticeAttempt.count({ where: { studentId: scope.run.studentId, conceptId: info.state.current } });
  const current = info.concepts.find(c => c.id === info.state.current)!;
  let body: unknown, transportReason: string | undefined;
  if (info.allowed.length) {
    try {
      body = (await callAi("NEXT_ACTION", { schema_version: "1", operation: "NEXT_ACTION", trigger: queued.trigger, student_context: snapshot,
        current: { course_offering_id: scope.run.offeringId, lesson_run_id: scope.run.id, stage: "LEARNING", concept: { concept_id: current.id, title: current.title, description: current.description, coverage: info.state.explained ? "EXPLAINED" : "NOT_EXPLAINED", mastery: info.state.mastery },
          prerequisites: info.state.prerequisites.map(id => { const c = info.concepts.find(c => c.id === id)!; return { concept_id: id, title: c.title, coverage: info.coverage.some(c => c.conceptId === id) ? "EXPLAINED" : "NOT_EXPLAINED", mastery: info.mastery.find(m => m.conceptId === id)?.status ?? "UNKNOWN" }; }),
          next_concepts: info.state.next ? [{ concept_id: info.state.next, title: info.concepts.find(c => c.id === info.state.next)!.title }] : [],
          activity: { type: info.attempt ? "PRACTICE" : "LESSON", attempt_index: attemptCount, assistance: { hints_used: hints, assisted: hints > 0 } } },
        latest_evidence: evidenceRows.map(r => { const e = r.evidence as unknown as Evidence; return { result: e.correct ? "correct" : "incorrect", reasoning_quality: e.reasoning, misconceptions: isObject(r.evaluation) && Array.isArray(r.evaluation.misconceptions) ? (r.evaluation.misconceptions as unknown[]).filter(isObject).map(m => ({ code: m.code, label: m.label })) : [], needs_review: e.needsReview, assistance: { assisted: e.assistance !== "independent", bucket: e.assistance } }; }),
        allowed_actions: info.allowed, policy: { policy_version: "1", max_consecutive_reinforce: 2 },
      }, { requestId: queued.requestId, studentId: scope.run.studentId, courseId: scope.run.courseId })).body;
    } catch (error) { transportReason = error instanceof LearningAiError ? error.code : "UPSTREAM_UNAVAILABLE"; }
  } else transportReason = "EMPTY_ALLOWED_ACTIONS";
  const guarded = guardDecision(body, info.allowed, info.state);
  const decision = guarded.ok ? guarded.decision : fallback(queued.trigger as Trigger, info.state, info.allowed, latest);
  const signals = isObject(body) && Array.isArray(body.signals) ? body.signals.filter((s): s is string => typeof s === "string").slice(0, 20) : [];
  const shadow = flags.orchestratorMode === "shadow";
  await elearningDb.orchestratorDecision.upsert({ where: { actionId: queued.id }, update: {}, create: { actionId: queued.id, requestId: queued.requestId, mode: flags.orchestratorMode, trigger: queued.trigger, allowed: json(info.allowed), decision: guarded.ok ? json(guarded.decision) : undefined, signals: json(signals), status: guarded.ok ? "ok" : "degraded", guardReason: transportReason ?? (!guarded.ok ? guarded.reason : undefined), fallbackUsed: !guarded.ok && !shadow && !!decision, executedAction: shadow ? undefined : decision?.action } });
  return { decision, shadow, signal: guarded.ok && signals.includes("CONCEPT_READY_FOR_REVISION") };
}
async function publish(scope: Scope, queued: LearningLessonAction, output: Execution) {
  const { run, material } = scope;
  return elearningDb.$transaction(async tx => {
    const currentMaterial = await tx.courseMaterial.findUniqueOrThrow({ where: { id: material.id } });
    if (currentMaterial.aiIngestStatus !== "INGESTED" || sourceFingerprint(currentMaterial) !== run.plan.version.fingerprint) throw new Error("MATERIAL_CHANGED");
    const owned = await tx.learningLessonRun.findFirst({ where: { id: run.id, version: queued.runVersion, studentId: run.studentId, busy: true } });
    if (!owned) throw new Error("RUN_VERSION_CHANGED");
    const fence = await tx.learningLessonAction.updateMany({ where: { id: queued.id, leaseToken: queued.leaseToken, status: "PROCESSING", leaseUntil: { gt: new Date() } }, data: { status: "COMPLETED", completedAt: new Date(), leaseToken: null, leaseUntil: null, action: output.action, conceptId: output.conceptId, result: json(output.result), ...(output.privateResult ? { privateResult: json(output.privateResult) } : {}) } });
    if (!fence.count) throw new Error("ACTION_LEASE_LOST");
    const concept = await tx.revisionConcept.findUniqueOrThrow({ where: { id: output.conceptId } });
    if (output.question) {
      const attempt = await tx.revisionPracticeAttempt.create({ data: { studentId: run.studentId, conceptId: output.conceptId, requestKey: queued.requestId, requestHash: queued.requestHash, question: json({ ...output.question, _sourceFingerprint: sourceFingerprint(material) }) } });
      await tx.learningLessonAction.update({ where: { id: queued.id }, data: { attemptId: attempt.id } });
    }
    if (output.hint && queued.attemptId) await tx.learningHintEvent.create({ data: { studentId: run.studentId, attemptId: queued.attemptId, actionId: queued.id, ...output.hint } });
    let mastery: string | undefined;
    if (output.evaluation && output.evidence && !output.evidence.needsReview && queued.attemptId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`mastery:${run.studentId}:${run.planId}:${output.conceptId}`}))::text`;
      const input = queued.input as Record<string, string>;
      await tx.learningEvaluation.create({ data: { actionId: queued.id, studentId: run.studentId, planId: run.planId, conceptId: output.conceptId, attemptId: queued.attemptId, answer: input.answer, reasoning: input.reasoning, evaluation: json(output.evaluation), evidence: json(output.evidence) } });
      const evaluated = await tx.revisionPracticeAttempt.updateMany({ where: { id: queued.attemptId, studentId: run.studentId, evaluatedAt: null }, data: { evaluation: json(output.evaluation), answerHash: queued.requestHash, evaluatedAt: new Date() } });
      if (!evaluated.count) throw new Error("ATTEMPT_ALREADY_EVALUATED");
      const history = await tx.learningEvaluation.findMany({ where: { studentId: run.studentId, planId: run.planId, conceptId: output.conceptId }, orderBy: { createdAt: "desc" }, take: 100, select: { evidence: true } });
      const covered = await tx.learningCoverage.findUnique({ where: { studentId_planId_conceptId: { studentId: run.studentId, planId: run.planId, conceptId: output.conceptId } } });
      mastery = computeMastery(history.reverse().map(r => r.evidence as unknown as Evidence), !!covered);
      if (covered && teachingPassed(output.evaluation as unknown as Evaluation)) await tx.revisionTeachingEvent.create({ data: { studentId: run.studentId, conceptId: concept.id, practiceAttemptId: queued.attemptId,
        taughtSummary: `${concept.description.slice(0, 1400)}\nLearning objective: ${concept.learningObjective.slice(0, 500)}`,
        context: json({ _learningPlanId: run.planId, _learningCourseId: run.courseId, _sourceFingerprint: sourceFingerprint(material), subject: concept.subject, curriculum: concept.curriculum, level: concept.level, topic: concept.topic, concept_id: concept.id, concept_title: concept.description.slice(0, 2000), language: concept.language }) } });
    }
    if (mastery || output.pause || ["REINFORCE_CONCEPT", "GENERATE_PRACTICE", "SHOW_GUIDED_EXAMPLE"].includes(output.action)) {
      const key = { studentId: run.studentId, planId: run.planId, conceptId: output.conceptId };
      await tx.learningMastery.upsert({ where: { studentId_planId_conceptId: key }, create: { ...key, status: mastery ?? "UNKNOWN", pendingReview: output.pause ?? false, consecutiveReinforce: output.action === "REINFORCE_CONCEPT" ? 1 : 0 }, update: { ...(mastery ? { status: mastery } : {}), ...(output.pause ? { pendingReview: true } : {}), consecutiveReinforce: output.action === "REINFORCE_CONCEPT" ? { increment: 1 } : 0 } });
    }
    await tx.learningLessonRun.update({ where: { id: run.id }, data: { busy: false, ...(output.moveTo ? { currentConceptId: output.moveTo } : {}), ...(output.complete ? { status: "COMPLETED" } : output.pause ? { status: "PAUSED" } : {}) } });
    await dirtySnapshot(tx, run.studentId, run.offeringId);
    // Moving forward queues concept-open content, rather than pretending it was delivered.
    if (output.action === "ADVANCE_TO_NEXT_CONCEPT" && output.moveTo) {
      await tx.learningLessonRun.update({ where: { id: run.id }, data: { busy: true, version: { increment: 1 } } });
      await tx.learningLessonAction.create({ data: { requestId: randomUUID(), requestHash: queued.requestHash, runId: run.id, runVersion: queued.runVersion + 1, conceptId: output.moveTo, command: "explain", trigger: "CONCEPT_OPENED", action: "EXPLAIN_CONCEPT", input: {} } });
    }
  });
}
export async function processLessonAction(queued: LearningLessonAction) {
  try {
    const row = await elearningDb.learningLessonRun.findUniqueOrThrow({ where: { id: queued.runId }, select: { studentId: true } });
    const scope = await ownedRun(row.studentId, queued.runId);
    if (scope.run.version !== queued.runVersion) throw new Error("RUN_VERSION_CHANGED");
    let action: Action | "EVALUATE_PRACTICE" | undefined = queued.command === "answer" ? "EVALUATE_PRACTICE" : actionForCommand(queued.command);
    let target = scope.run.currentConceptId, readiness = false;
    if (queued.command === "next") {
      if (learningAiFlags().orchestratorMode === "off") return problem("ORCHESTRATOR_DISABLED", "The orchestrator was disabled before this activity ran.");
      const selected = await decide(scope, queued);
      if (selected.shadow) {
        await publish(scope, queued, { action: "CONTINUE_CONVERSATION", conceptId: target, result: { message: "Recommendation recorded in shadow mode. Choose an activity to continue.", shadow: true } }); return;
      }
      if (!selected.decision) return problem("NO_SAFE_ACTION", "No safe learning activity is available.");
      action = selected.decision.action; target = selected.decision.target_concept_id; readiness = selected.signal;
    }
    if (!action) throw new Error("UNKNOWN_ACTION");
    const current = await lessonState(scope.run);
    if (action !== "EVALUATE_PRACTICE" && !current.allowed.includes(action)) return problem("ACTION_NOT_ALLOWED", "This activity is no longer permitted.");
    const output = await executeLearningAction(scope, queued, action, target);
    const fresh = await ownedRun(scope.run.studentId, scope.run.id);
    if (fresh.run.version !== queued.runVersion) throw new Error("RUN_VERSION_CHANGED");
    await publish(fresh, queued, output);
    if (readiness || output.complete) await queueEligibleLearningRevision(scope.run.studentId, scope.run.id);
  } catch (error) {
    const uncertain = error instanceof LearningAiError && ["UPSTREAM_UNCERTAIN", "REQUEST_NOT_REPLAYABLE", "REQUEST_IN_PROGRESS"].includes(error.code);
    const code = error instanceof LearningAiError ? error.code : isObject(error) && typeof error.code === "string" ? error.code.slice(0, 80) : "ACTIVITY_REQUIRES_REVIEW";
    await elearningDb.$transaction(async tx => {
      const fenced = await tx.learningLessonAction.updateMany({ where: { id: queued.id, leaseToken: queued.leaseToken, status: "PROCESSING" }, data: { status: uncertain ? "UNCERTAIN" : "FAILED", errorCode: code, ...(!uncertain ? { leaseToken: null, leaseUntil: null } : {}) } });
      if (fenced.count) await tx.learningLessonRun.updateMany({ where: { id: queued.runId, version: queued.runVersion }, data: { busy: false } });
    });
    console.warn("[learning-ai] activity failed", { actionId: queued.id, code });
  }
}
export async function runLearningSweep(studentId?: string) {
  const flags = learningAiFlags();
  if (!flags.AI_V2_ENABLED) return { disabled: true };
  const action = await claimLessonAction(studentId);
  if (action) await processLessonAction(action);
  else {
    const work = flags.AI_INGEST_PIPELINE_ENABLED ? await claimRevisionWork({ analysisOnly: true, learningOnly: true }) : null;
    if (work?.type === "analysis") await processConceptAnalysis(work.job);
    else if (flags.REVISION_PIPELINE_ENABLED) {
      const revision = await claimRevisionWork({ learningOnly: true });
      if (revision?.type === "generation") await processRevisionGeneration(revision.job);
      else if (revision?.type === "analysis") await processConceptAnalysis(revision.job);
    }
  }
  const refreshed = flags.SNAPSHOT_ENABLED ? await refreshLearningSnapshots() : 0;
  return { processed: action ? 1 : 0, snapshotsRefreshed: refreshed };
}
