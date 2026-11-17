import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import type { RevisionPayload, RevisionResult } from "./contract";
import { RevisionWebhookError } from "./errors";
import { canonicalQuestion, scopeKey, hash, normalizedVector, JUDGE_MODEL, EMBEDDING_MODEL, EMBEDDING_VERSION, EMBEDDING_DIMENSIONS, SCHEDULER_VERSION, teachingPassed, type Evaluation } from "./policy";
import { embedQuestions, judgePairs, type JudgePair, type Judgment } from "./providers";
import { commitRevisionDelivery, type RevisionClaim } from "./idempotency";
import { initialRevisionCard } from "./scheduler";
import { sourceFingerprint, sourceSnapshot, workspaceEnabled, revisionCourses } from "./eligibility";
const usesGovernance = (event: { context: unknown }) => workspaceEnabled() || (!!event.context && typeof event.context === "object" && typeof (event.context as Record<string, unknown>)._learningPlanId === "string");
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export async function validateTeachingDelivery(payload: RevisionPayload) {
  const event = await elearningDb.revisionTeachingEvent.findUnique({ where: { id: payload.teaching_event_id }, include: { concept: { include: { material: true } }, practiceAttempt: true, generation: true } });
  if (!event || event.studentId !== payload.student_id || event.practiceAttempt.studentId !== payload.student_id || event.practiceAttempt.conceptId !== event.conceptId || !teachingPassed(event.practiceAttempt.evaluation as unknown as Evaluation)) throw new RevisionWebhookError(400, "TEACHING_EVENT_MISMATCH", "The student, concept and passed teaching event do not match.");
  const user = await prisma.user.findUnique({ where: { id: payload.student_id }, select: { role: true } });
  if (user?.role !== "student") throw new RevisionWebhookError(400, "STUDENT_UNAVAILABLE", "The teaching event's student account is unavailable.");
  const expected = event.context as Record<string, unknown>;
  if (typeof expected._learningPlanId === "string") {
    const [coverage, plan, courses] = await Promise.all([
      elearningDb.learningCoverage.findUnique({ where: { studentId_planId_conceptId: { studentId: event.studentId, planId: expected._learningPlanId, conceptId: event.conceptId } } }),
      elearningDb.learningPlan.findUnique({ where: { id: expected._learningPlanId }, include: { version: true } }), revisionCourses(event.studentId),
    ]);
    if (!coverage || !plan || plan.status !== "READY" || plan.version.fingerprint !== sourceFingerprint(event.concept.material) || !courses.some(c => c.offeringId === coverage.offeringId)) throw new RevisionWebhookError(409, "LEARNING_COVERAGE_REQUIRED", "This revision delivery no longer has eligible course coverage.");
  }
  for (const [key, value] of Object.entries(payload.context)) if (expected[key] !== value) throw new RevisionWebhookError(400, "CONCEPT_CONTEXT_MISMATCH", "The submission context does not match the trusted teaching event.");
  if (payload.taught_summary !== event.taughtSummary || Date.parse(payload.occurred_at) < +event.passedAt - 30000 || Date.parse(payload.occurred_at) > Date.now() + 30000) throw new RevisionWebhookError(400, "TEACHING_EVENT_MISMATCH", "The submission does not match the taught summary or event timing.");
  if (!event.generation) throw new RevisionWebhookError(400, "GENERATION_NOT_REQUESTED", "No generation was requested for this teaching event.");
  return event;
}
export type TrustedEvent = Awaited<ReturnType<typeof validateTeachingDelivery>>;
interface Candidate { id: string; canonicalText: string; canonicalHash: string; variantOfId: string | null; similarity: number }
interface Plan { scope: string; text: string; canonicalHash: string; vector: number[]; exact?: string; exactRoot?: string; candidates: Candidate[]; duplicateBatch?: number }
export interface RevisionProviders { embed: typeof embedQuestions; judge: typeof judgePairs }
const defaults: RevisionProviders = { embed: embedQuestions, judge: judgePairs };
const cosine = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
async function scopeSnapshot(scope: string, tx: Pick<Prisma.TransactionClient, "revisionQuestion"> = elearningDb) {
  const rows = await tx.revisionQuestion.findMany({ where: { scopeKey: scope }, select: { id: true, canonicalHash: true, variantOfId: true }, orderBy: { id: "asc" }, take: 2001 });
  if (rows.length > 2000) throw new RevisionWebhookError(503, "DENSE_SCOPE_REVIEW", "This question cluster requires administrator review before insertion.", 60);
  return hash(rows);
}
export async function prepareRevisionBatch(payload: RevisionPayload, event: TrustedEvent, providers: RevisionProviders = defaults, signal = AbortSignal.timeout(8500)) {
  const expected = event.context as Record<string, unknown>;
  if (usesGovernance(event) && (!event.concept.active || event.concept.material.aiIngestStatus !== "INGESTED" || (expected._sourceFingerprint ? expected._sourceFingerprint !== sourceFingerprint(event.concept.material) : event.passedAt < event.concept.material.updatedAt))) throw new RevisionWebhookError(409, "SOURCE_CHANGED", "The teaching material changed; this event requires review.");
  const texts = payload.questions.map(q => canonicalQuestion(payload, q, event.concept.learningObjective));
  const snapshots = new Map<string, string>(), plans: Plan[] = [], pairs: JudgePair[] = [];
  const uniqueNew = new Map<string, string>();
  for (const [i, question] of payload.questions.entries()) {
    const scope = scopeKey(payload, question, event.concept.conceptKey), text = texts[i], canonicalHash = hash(text);
    if (!snapshots.has(scope)) snapshots.set(scope, await scopeSnapshot(scope));
    const exact = await elearningDb.revisionQuestion.findUnique({ where: { scopeKey_canonicalHash: { scopeKey: scope, canonicalHash } }, select: { id: true, variantOfId: true } });
    const duplicateBatch = plans.findIndex(plan => plan.scope === scope && plan.canonicalHash === canonicalHash);
    plans.push({ scope, text, canonicalHash, vector: [], exact: exact?.id, exactRoot: exact ? exact.variantOfId || exact.id : undefined, candidates: [], ...(duplicateBatch >= 0 ? { duplicateBatch } : {}) });
    if (!exact && duplicateBatch < 0) uniqueNew.set(`${scope}:${canonicalHash}`, text);
  }
  // Exact meaning hashes reuse existing embeddings and never require a provider call.
  const keys = [...uniqueNew.keys()], embedded = keys.length ? (await providers.embed([...uniqueNew.values()], signal)).map(normalizedVector) : [];
  if (embedded.length !== keys.length) throw new RevisionWebhookError(503, "EMBEDDING_UNAVAILABLE", "The embedding batch is incomplete.", 5);
  const vectors = new Map(keys.map((key, i) => [key, embedded[i]]));
  for (const [i, plan] of plans.entries()) {
    if (plan.exact) continue;
    if (plan.duplicateBatch !== undefined) { plan.vector = plans[plan.duplicateBatch].vector; continue; }
    const { scope, text } = plan, vector = vectors.get(`${scope}:${plan.canonicalHash}`)!; plan.vector = vector;
    plan.candidates = await elearningDb.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL search_path = public, extensions`;
      return tx.$queryRaw<Candidate[]>`
        SELECT q."id", q."canonicalText", q."canonicalHash", q."variantOfId", (1 - (e."vector" <=> ${JSON.stringify(vector)}::vector))::float8 AS similarity
        FROM "RevisionQuestionEmbedding" e JOIN "RevisionQuestion" q ON q."id" = e."questionId"
        WHERE q."scopeKey" = ${scope} AND e."model" = ${EMBEDDING_MODEL} AND e."version" = ${EMBEDDING_VERSION}
          AND e."dimensions" = ${EMBEDDING_DIMENSIONS} AND (1 - (e."vector" <=> ${JSON.stringify(vector)}::vector)) >= 0.85
        ORDER BY e."vector" <=> ${JSON.stringify(vector)}::vector LIMIT 9`;
    });
    if (plan.candidates.length > 8) throw new RevisionWebhookError(503, "DENSE_SCOPE_REVIEW", "Too many similar questions require a reviewed deduplication decision.", 60);
    pairs.push({ id: `valid:${i}`, incoming: text, candidate: `VALIDITY CHECK ONLY: ${event.concept.description}\nLearning objective: ${event.concept.learningObjective}. Return different if valid, invalid if incoherent or unrelated.`, similarity: 0 });
    for (const candidate of plan.candidates) pairs.push({ id: `${i}:${candidate.id}`, incoming: text, candidate: candidate.canonicalText, similarity: candidate.similarity });
    for (let j = 0; j < i; j++) if (plans[j].scope === scope && !plans[j].exact && plans[j].vector.length) {
      const similarity = cosine(vector, plans[j].vector);
      if (similarity >= 0.85) pairs.push({ id: `batch:${i}:${j}`, incoming: text, candidate: plans[j].text, similarity });
    }
  }
  if (pairs.length > 40) throw new RevisionWebhookError(503, "DENSE_SCOPE_REVIEW", "The batch needs a reviewed semantic comparison.", 60);
  const judgments = pairs.length ? await providers.judge(pairs, signal) : new Map<string, Judgment>();
  if (pairs.some(pair => !judgments.has(pair.id))) throw new RevisionWebhookError(503, "JUDGE_UNAVAILABLE", "Duplicate judgment was incomplete.", 5);
  const cards = await Promise.all(plans.map(() => { const id = randomUUID(); return initialRevisionCard(id).then(state => ({ id, state })); }));
  return { plans, snapshots, judgments, cards };
}
export async function persistRevisionBatch(payload: RevisionPayload, event: TrustedEvent, claim: RevisionClaim, prepared: Awaited<ReturnType<typeof prepareRevisionBatch>>) {
  const { plans, judgments, snapshots, cards } = prepared;
  const ids: (string | null)[] = [], roots: (string | undefined)[] = [], outcomes: RevisionResult["outcome"][] = [];
  const newQuestions: Prisma.RevisionQuestionCreateManyInput[] = [], embeddings: { questionId: string; vector: string }[] = [];
  for (const [i, question] of payload.questions.entries()) {
    const plan = plans[i]; let resolved = plan.exact, resolvedRoot = plan.exactRoot, variantId: string | undefined, invalid = judgments.get(`valid:${i}`) === "invalid";
    if (plan.duplicateBatch !== undefined) { resolved = ids[plan.duplicateBatch] || undefined; resolvedRoot = roots[plan.duplicateBatch]; invalid ||= !resolved; }
    for (const candidate of plan.candidates) {
      const decision = judgments.get(`${i}:${candidate.id}`);
      invalid ||= decision === "invalid";
      if (!resolved && decision === "duplicate") { resolved = candidate.id; resolvedRoot = candidate.variantOfId || candidate.id; }
      if (!variantId && decision === "variant") variantId = candidate.variantOfId || candidate.id;
    }
    for (let j = 0; j < i && !resolved; j++) if (ids[j]) {
      const decision = judgments.get(`batch:${i}:${j}`);
      if (decision === "duplicate") { resolved = ids[j]!; resolvedRoot = roots[j] || ids[j]!; }
      else if (!variantId && decision === "variant") variantId = roots[j] || ids[j]!;
    }
    if (invalid) { ids.push(null); roots.push(undefined); outcomes.push("rejected_invalid"); continue; }
    if (resolved) { ids.push(resolved); roots.push(resolvedRoot || resolved); outcomes.push("reused_existing"); continue; }
    const id = randomUUID(); ids.push(id); roots.push(variantId || id); outcomes.push(variantId ? "created_variant" : "created");
    newQuestions.push({ id, conceptId: event.conceptId, scopeKey: plan.scope, canonicalHash: plan.canonicalHash, canonicalText: plan.text, type: question.type, stem: question.stem, options: json(question.options || []), correctAnswer: json(question.correct_answer), explanation: question.explanation, difficulty: question.difficulty_estimate, bloomLevel: question.bloom_level, tags: question.tags, subject: payload.context.subject, curriculum: payload.context.curriculum, level: payload.context.level, topic: payload.context.topic, language: payload.context.language, conceptTitle: payload.context.concept_title, learningObjective: event.concept.learningObjective, variantOfId: variantId });
    embeddings.push({ questionId: id, vector: JSON.stringify(plan.vector) });
  }
  let committedCards = 0;
  const response = await commitRevisionDelivery(claim, async tx => {
    await tx.$executeRaw`SET LOCAL search_path = public, extensions`;
    const learningContext = event.context as Record<string, unknown>;
    if (typeof learningContext._learningPlanId === "string") {
      const material = await tx.courseMaterial.findUniqueOrThrow({ where: { id: event.concept.materialId } });
      const coverage = await tx.learningCoverage.findUnique({ where: { studentId_planId_conceptId: { studentId: event.studentId, planId: learningContext._learningPlanId, conceptId: event.conceptId } } });
      if (!coverage || material.aiIngestStatus !== "INGESTED" || sourceFingerprint(material) !== learningContext._sourceFingerprint) throw new RevisionWebhookError(409, "SOURCE_CHANGED", "Learning coverage changed before this delivery committed.");
    }
    for (const scope of [...snapshots.keys()].sort()) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
      if (await scopeSnapshot(scope, tx) !== snapshots.get(scope)) throw new RevisionWebhookError(503, "CANDIDATES_CHANGED", "The question bank changed during preparation. Retry the same delivery.", 1);
    }
    if (newQuestions.length) {
      await tx.revisionQuestion.createMany({ data: newQuestions });
      if (usesGovernance(event)) await tx.revisionQuestionGovernance.createMany({ data: newQuestions.map(q => ({ questionId: q.id!, publicationStatus: "PUBLISHED", sourceFingerprint: sourceFingerprint(event.concept.material), sourceSnapshot: json(sourceSnapshot(event.concept.material)) })) });
      await tx.$executeRaw`INSERT INTO "RevisionQuestionEmbedding" ("questionId", "model", "version", "dimensions", "vector") SELECT x."questionId", ${EMBEDDING_MODEL}, ${EMBEDDING_VERSION}, ${EMBEDDING_DIMENSIONS}, x."vector"::vector FROM jsonb_to_recordset(${JSON.stringify(embeddings)}::jsonb) AS x("questionId" text, "vector" text)`;
    }
    let resolvedIds = ids.filter((id): id is string => !!id);
    if (usesGovernance(event) && resolvedIds.length) {
      await tx.$queryRaw`SELECT "questionId" FROM "RevisionQuestionGovernance" WHERE "questionId" IN (SELECT jsonb_array_elements_text(${JSON.stringify(resolvedIds)}::jsonb)) ORDER BY "questionId" FOR SHARE`;
      const policies = await tx.revisionQuestionGovernance.findMany({ where: { questionId: { in: resolvedIds } }, include: { question: { include: { concept: { include: { material: true } } } } } });
      const available = new Set(policies.filter(p => p.publicationStatus === "PUBLISHED" && p.question.concept.active && p.question.concept.material.aiIngestStatus === "INGESTED" && p.sourceFingerprint === sourceFingerprint(p.question.concept.material)).map(p => p.questionId));
      for (const [i, id] of ids.entries()) if (id && !available.has(id)) {
        if (newQuestions.some(q => q.id === id)) throw new RevisionWebhookError(409, "SOURCE_CHANGED", "Question provenance changed before commit.");
        ids[i] = null; outcomes[i] = "rejected_invalid";
      }
      resolvedIds = ids.filter((id): id is string => !!id);
    }
    const existingCards = await tx.revisionStudentCard.findMany({ where: { studentId: payload.student_id, questionId: { in: resolvedIds } }, select: { id: true, questionId: true } });
    const cardIds = new Map(existingCards.map(card => [card.questionId, card.id]));
    const newCards: Prisma.RevisionStudentCardCreateManyInput[] = [];
    for (const [i, id] of ids.entries()) if (id && !cardIds.has(id)) {
      cardIds.set(id, cards[i].id);
      newCards.push({ id: cards[i].id, studentId: payload.student_id, questionId: id, schedulerVersion: SCHEDULER_VERSION, state: json(cards[i].state), dueAt: cards[i].state.dueAt });
    }
    if (newCards.length) await tx.revisionStudentCard.createMany({ data: newCards });
    committedCards = newCards.length;
    const results: RevisionResult[] = payload.questions.map((question, i) => ({ client_ref: question.client_ref, question_id: ids[i], student_card_id: ids[i] ? cardIds.get(ids[i]!)! : null, outcome: outcomes[i] }));
    const provenance = results.flatMap((result, i) => result.question_id ? [{ teachingEventId: event.id, questionId: result.question_id, clientRef: result.client_ref, outcome: result.outcome, dedupMetadata: json({ embeddingModel: EMBEDDING_MODEL, embeddingVersion: EMBEDDING_VERSION, judgeModel: JUDGE_MODEL, canonicalHash: plans[i].canonicalHash, exact: !!plans[i].exact, candidates: plans[i].candidates.map(c => ({ questionId: c.id, similarity: c.similarity, decision: judgments.get(`${i}:${c.id}`) })), batchDuplicate: plans[i].duplicateBatch ?? null }) }] : []);
    if (provenance.length) await tx.revisionQuestionProvenance.createMany({ data: provenance });
    const rejected = results.filter(r => r.outcome === "rejected_invalid").length;
    await tx.revisionGenerationJob.update({ where: { teachingEventId: event.id }, data: { status: rejected ? "NEEDS_REVIEW" : "COMPLETED", generatedCount: results.length, acceptedCount: results.length - rejected, rejectedCount: rejected, createdCount: results.filter(r => r.outcome === "created" || r.outcome === "created_variant").length, reusedCount: results.filter(r => r.outcome === "reused_existing").length, cardsCreated: committedCards, webhookStatus: "processed", completedAt: new Date(), needsReview: rejected > 0, claimToken: null, leaseUntil: null, errorCode: null } });
    if (rejected) await tx.revisionAdminAlert.upsert({ where: { dedupeKey: `review:${event.id}` }, update: {}, create: { dedupeKey: `review:${event.id}`, category: "BATCH_NEEDS_REVIEW", correlationId: event.id } });
    return { teaching_event_id: payload.teaching_event_id, status: "processed", results };
  });
  console.info("[revision-questions] cards committed", { teachingEventId: event.id, cardsCreated: committedCards });
  return response;
}
