import { isObject } from "../learning-ai/capabilities";
import { misconceptionCode } from "../learning-ai/policy";
import { randomInt, randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import { bankQuestionInclude, coveragePool, eligibleFromPool, eligibleBankQuestion, revisionCourses } from "./eligibility";
import { boundedText, validateEvaluation, reviewRevisionCard } from "./students";
import { hash, SCHEDULER_VERSION } from "./policy";
import { initialRevisionCard } from "./scheduler";
import { learningRequest } from "./providers";
import { RevisionWebhookError } from "./errors";
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
export const revisionSelectionPolicy = () => ({ maxQuestions: 20, newLimit: Math.max(0, Math.min(10, Number.parseInt(process.env.REVISION_NEW_QUESTION_LIMIT || "5", 10) || 0)), candidateLimit: 200 });
const unavailable = (): never => { throw new RevisionWebhookError(404, "SESSION_UNAVAILABLE", "This revision session is unavailable."); };
export async function revisionHome(studentId: string) {
  const [courses, sessions, history] = await Promise.all([
    revisionCourses(studentId),
    elearningDb.revisionSession.findMany({ where: { studentId }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, mode: true, offeringId: true, status: true, updatedAt: true, _count: { select: { items: true } } } }),
    elearningDb.revisionSessionItem.findMany({ where: { session: { studentId }, status: "REVIEWED" }, orderBy: { evaluatedAt: "desc" }, take: 20, select: { id: true, question: { select: { stem: true, conceptTitle: true } }, review: { select: { rating: true, reviewedAt: true, nextState: true } }, evaluation: true } }),
  ]);
  return { courses: courses.map(c => ({ id: c.id, offeringId: c.offeringId, code: c.code, title: c.title })), sessions, history: history.map(h => ({ ...h, review: h.review ? { rating: h.review.rating, reviewedAt: h.review.reviewedAt, nextReviewAt: (h.review.nextState as Record<string, unknown>).dueAt } : null })), policy: revisionSelectionPolicy() };
}
export async function startRevisionSession(studentId: string, input: Record<string, unknown>) {
  const mode = input.mode, offeringId = mode === "COURSE" ? boundedText(input.offeringId, "registered course", 200) : undefined;
  if (mode !== "COURSE" && mode !== "RANDOM") throw new RevisionWebhookError(400, "INVALID_MODE", "Choose Course or Random revision.");
  const key = boundedText(input.requestId, "session request identifier", 200), requestHash = hash([mode, offeringId || null]);
  const existing = await elearningDb.revisionSession.findUnique({ where: { studentId_requestKey: { studentId, requestKey: key } } });
  if (existing) { if (existing.requestHash !== requestHash) throw new RevisionWebhookError(409, "SESSION_CONFLICT", "That request identifier belongs to another session."); return revisionSessionView(studentId, existing.id); }
  const pool = await coveragePool(studentId, offeringId), scopes = [...pool.scopes.keys()], policy = revisionSelectionPolicy();
  const available = { scopeKey: { in: scopes }, governance: { publicationStatus: "PUBLISHED" }, concept: { active: true, material: { aiIngestStatus: "INGESTED" as const } } };
  const include = bankQuestionInclude;
  const [due, fresh] = await Promise.all([
    elearningDb.revisionStudentCard.findMany({ where: { studentId, version: { gt: 0 }, dueAt: { lte: new Date() }, question: available }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: policy.candidateLimit, include: { question: { include } } }),
    elearningDb.revisionQuestion.findMany({ where: { ...available, OR: [{ cards: { none: { studentId } } }, { cards: { some: { studentId, version: 0 } } }] }, orderBy: { id: "asc" }, take: policy.candidateLimit, include }),
  ]);
  type Choice = { question: typeof fresh[number]; card?: typeof due[number]; introduction: boolean };
  const valid = (q: typeof fresh[number]) => { try { eligibleFromPool(pool, q); return true; } catch (e) { if (e instanceof RevisionWebhookError && e.status === 404) return false; throw e; } };
  // Randomize within each priority band, then round-robin registered offerings.
  const balanced = (choices: Choice[]) => {
    if (mode === "COURSE") return choices;
    const groups = new Map<string, Choice[]>();
    for (const choice of choices) { const offering = pool.scopes.get(choice.question.scopeKey)!.concept.material.courseOfferingId; const rows = groups.get(offering) || []; rows.push(choice); groups.set(offering, rows); }
    const rows = [...groups.values()]; for (const group of rows) for (let i = group.length - 1; i > 0; i--) { const j = randomInt(i + 1); [group[i], group[j]] = [group[j], group[i]]; }
    for (let i = rows.length - 1; i > 0; i--) { const j = randomInt(i + 1); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    const result: Choice[] = []; while (rows.some(r => r.length)) for (const group of rows) if (group.length) result.push(group.shift()!); return result;
  };
  const dueChoices = balanced(due.filter(c => c.version > 0 && valid(c.question)).map(card => ({ question: card.question, card, introduction: false })));
  const newChoices = balanced(fresh.filter(valid).map(question => ({ question, introduction: true }))).slice(0, policy.newLimit);
  const selected = [...dueChoices, ...newChoices].slice(0, policy.maxQuestions);
  if (!selected.length) throw new RevisionWebhookError(409, "NO_ELIGIBLE_QUESTIONS", "No eligible questions are due. Complete independent practice in Study Zone, or return when your next review is due.");
  const initial = await Promise.all(selected.map(async () => { const id = randomUUID(); return { id, state: await initialRevisionCard(id) }; }));
  const session = await elearningDb.$transaction(async tx => {
    // One student-wide selection lock prevents simultaneous modes duplicating introduction setup.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`revision-session:${studentId}`}, 0))::text`;
    const replay = await tx.revisionSession.findUnique({ where: { studentId_requestKey: { studentId, requestKey: key } } });
    if (replay) { if (replay.requestHash !== requestHash) throw new RevisionWebhookError(409, "SESSION_CONFLICT", "Session request changed."); return replay; }
    const created = await tx.revisionSession.create({ data: { studentId, requestKey: key, requestHash, mode, offeringId } });
    await tx.revisionStudentCard.createMany({ data: selected.map((choice, i) => ({ id: initial[i].id, studentId, questionId: choice.question.id, schedulerVersion: SCHEDULER_VERSION, state: json(initial[i].state), dueAt: initial[i].state.dueAt })), skipDuplicates: true });
    const cards = await tx.revisionStudentCard.findMany({ where: { studentId, questionId: { in: selected.map(c => c.question.id) } } });
    await tx.$queryRaw`SELECT "id" FROM "RevisionStudentCard" WHERE "studentId" = ${studentId} AND "questionId" IN (SELECT jsonb_array_elements_text(${JSON.stringify(selected.map(c => c.question.id))}::jsonb)) ORDER BY "id" FOR UPDATE`;
    const currentCards = await tx.revisionStudentCard.findMany({ where: { id: { in: cards.map(c => c.id) } } });
    const byQuestion = new Map(currentCards.map(c => [c.questionId, c]));
    const currentChoices = selected.filter(c => { const card = byQuestion.get(c.question.id)!; return card.version === 0 || card.dueAt <= new Date(); });
    if (!currentChoices.length) throw new RevisionWebhookError(409, "NO_ELIGIBLE_QUESTIONS", "These questions were just reviewed. Start a new session when reviews are due.");
    await tx.revisionSessionItem.createMany({ data: currentChoices.map((choice, position) => { const card = byQuestion.get(choice.question.id)!; return { sessionId: created.id, position, questionId: choice.question.id, coverageEventId: pool.scopes.get(choice.question.scopeKey)!.id, cardId: card.id, cardVersion: card.version, introduction: choice.introduction }; }) });
    return created;
  }, { timeout: 15000 });
  return revisionSessionView(studentId, session.id);
}
async function ownedItem(studentId: string, id: string) {
  const item = await elearningDb.revisionSessionItem.findFirst({ where: { id, session: { studentId } }, include: { session: true, question: true, card: true, coverageEvent: { include: { concept: true } } } });
  if (!item) return unavailable(); return item;
}
export async function revisionSessionView(studentId: string, id: string) {
  const session = await elearningDb.revisionSession.findFirst({ where: { id, studentId }, include: { items: { orderBy: { position: "asc" }, include: { question: { include: bankQuestionInclude }, card: true } } } });
  if (!session) return unavailable();
  let pool: Awaited<ReturnType<typeof coveragePool>>;
  try { pool = await coveragePool(studentId, session.offeringId || undefined); }
  catch (e) { if (!(e instanceof RevisionWebhookError) || e.code !== "COURSE_UNAVAILABLE") throw e; pool = { courses: [], scopes: new Map() }; }
  let current = null;
  for (const item of session.items) if (["PENDING", "EVALUATED"].includes(item.status)) {
    try {
      const eligible = eligibleFromPool(pool, item.question);
      if (item.card.version !== item.cardVersion) throw new RevisionWebhookError(409, "CARD_CHANGED", "This question was reviewed in another session.");
      current = { id: item.id, position: item.position, status: item.status, introduction: item.introduction, cardVersion: item.cardVersion, course: { code: eligible.course.code, title: eligible.course.title }, question: { type: item.question.type, stem: item.question.stem, options: item.question.options, conceptTitle: item.question.conceptTitle }, answer: item.answer, reasoning: item.reasoning, evaluation: item.evaluation, ...(item.evaluatedAt ? { correctAnswer: item.question.correctAnswer, explanation: item.question.explanation } : {}) }; break;
    } catch (e) {
      if (!(e instanceof RevisionWebhookError) || ![404, 409].includes(e.status)) throw e;
      await elearningDb.revisionSessionItem.updateMany({ where: { id: item.id, status: { in: ["PENDING", "EVALUATED"] } }, data: { status: "SKIPPED" } });
      item.status = "SKIPPED";
    }
  }
  const completed = session.items.filter(i => i.status === "REVIEWED").length;
  if (!current) await elearningDb.revisionSession.updateMany({ where: { id, studentId, status: "ACTIVE" }, data: { status: "COMPLETED", completedAt: new Date() } });
  return { id: session.id, mode: session.mode, offeringId: session.offeringId, status: current ? "ACTIVE" : "COMPLETED", total: session.items.length, completed, skipped: session.items.filter(i => i.status === "SKIPPED").length, current };
}
export async function answerRevisionItem(studentId: string, input: Record<string, unknown>) {
  const id = boundedText(input.itemId, "session question", 200), answer = boundedText(input.answer, "answer", 4000), reasoning = typeof input.reasoning === "string" && input.reasoning.length <= 4000 ? input.reasoning : "";
  const item = await ownedItem(studentId, id), eligible = await eligibleBankQuestion(studentId, item.questionId, item.session.offeringId || undefined);
  if (input.reasoning !== undefined && (typeof input.reasoning !== "string" || input.reasoning.length > 4000)) throw new RevisionWebhookError(400, "INVALID_REASONING", "Provide valid reasoning text.");
  if ((item.question.type === "mcq" && !(item.question.options as { key: string }[]).some(o => o.key === answer)) || (item.question.type === "true_false" && !["true", "false"].includes(answer))) throw new RevisionWebhookError(400, "INVALID_ANSWER", "Choose one of the available answers.");
  const answerHash = hash([answer, reasoning]);
  if (item.evaluatedAt) { if (item.answerHash !== answerHash) throw new RevisionWebhookError(409, "ANSWER_CONFLICT", "This answer has already been evaluated. Complete its review before starting another session."); return revisionSessionView(studentId, item.sessionId); }
  if (item.status !== "PENDING" || item.card.version !== item.cardVersion) throw new RevisionWebhookError(409, "CARD_CHANGED", "Reload the revision session.");
  const token = randomUUID();
  const claimed = await elearningDb.revisionSessionItem.updateMany({ where: { id, status: "PENDING", evaluatedAt: null, OR: [{ evaluationLease: null }, { evaluationLease: { lt: new Date() } }] }, data: { answer, reasoning, answerHash, evaluationToken: token, evaluationLease: new Date(Date.now() + 90000) } });
  if (!claimed.count) throw new RevisionWebhookError(409, "EVALUATION_PROCESSING", "This answer is being evaluated. Reload shortly.");
  try {
    const q = eligible.question, expected = q.type === "mcq" ? (q.options as { key: string; text: string }[]).find(o => o.key === q.correctAnswer)?.text || String(q.correctAnswer) : String(q.correctAnswer);
    const context = eligible.coverage.context as Record<string, unknown>;
    const personalized = typeof context._learningPlanId === "string";
    const conceptId = personalized ? eligible.coverage.concept.id : eligible.coverage.concept.externalId;
    const payload = { concept_id: conceptId, concept_description: eligible.coverage.concept.description, question: q.stem + (q.type === "mcq" ? `\nOptions: ${JSON.stringify(q.options)}` : ""), expected_answer: expected, student_answer: answer, student_reasoning: reasoning, response_type: q.type === "mcq" ? "multiple_choice" : "text" };
    let raw: unknown;
    if (personalized && process.env.AI_V2_ENABLED === "true") {
      const response = await (await import("../learning-ai/client")).callAi("EVALUATE_PRACTICE", payload, { requestId: item.id, studentId, courseId: eligible.course.id });
      if (response.metadata.status === "degraded") throw new RevisionWebhookError(502, "REVISION_EVALUATION_REVIEW", "This evaluation needs review. Your answer was saved; no review was scheduled.");
      raw = response.body;
    } else raw = await learningRequest("/evaluate-practice", payload);
    const evaluated = validateEvaluation(raw, conceptId);
    // Explicit DTO for the new workflow: future provider fields must not expose answer keys.
    const result = personalized ? { concept_id: evaluated.concept_id, answer_correct: evaluated.answer_correct, answer_feedback: evaluated.answer_feedback, reasoning_quality: evaluated.reasoning_quality, reasoning_feedback: evaluated.reasoning_feedback, evidence_strength: evaluated.evidence_strength, needs_review: evaluated.needs_review, recommended_next_step: evaluated.recommended_next_step, misconceptions: isObject(raw) && Array.isArray(raw.misconceptions) ? raw.misconceptions.filter(isObject).flatMap(m => typeof m.label === "string" ? [{ code: typeof m.code === "string" ? m.code.slice(0, 60) : misconceptionCode(m.label), label: m.label.slice(0, 500) }] : []).slice(0, 20) : [] } : evaluated;
    await eligibleBankQuestion(studentId, item.questionId, item.session.offeringId || undefined);
    const saved = await elearningDb.revisionSessionItem.updateMany({ where: { id, evaluationToken: token, status: "PENDING", evaluatedAt: null, evaluationLease: { gt: new Date() }, card: { version: item.cardVersion } }, data: { evaluation: json(result), evaluatedAt: new Date(), status: "EVALUATED", evaluationToken: null, evaluationLease: null } });
    if (!saved.count) throw new RevisionWebhookError(409, "ANSWER_CHANGED", "The session changed during evaluation. Reload it.");
    return revisionSessionView(studentId, item.sessionId);
  } catch (e) { await elearningDb.revisionSessionItem.updateMany({ where: { id, evaluationToken: token }, data: { evaluationToken: null, evaluationLease: null } }).catch(() => {}); throw e; }
}
export async function rateRevisionItem(studentId: string, input: Record<string, unknown>) {
  const item = await ownedItem(studentId, boundedText(input.itemId, "session question", 200));
  if (!item.evaluatedAt) throw new RevisionWebhookError(409, "ANSWER_REQUIRED", "Submit an answer and read its feedback before rating recall.");
  await reviewRevisionCard(studentId, { ...input, cardId: item.cardId, version: item.cardVersion, sessionItemId: item.id, offeringId: item.session.offeringId });
  const view = await revisionSessionView(studentId, item.sessionId);
  const card = await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: item.cardId }, select: { dueAt: true } });
  return { ...view, nextReviewAt: card.dueAt };
}
