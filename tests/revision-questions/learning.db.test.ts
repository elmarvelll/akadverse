import "../helpers/env";
import { signInAs } from "../helpers/session";
import { before, after, afterEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { elearningDb } from "@/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { teachingPassed, conceptKey, EMBEDDING_DIMENSIONS, normalizedVector } from "@/services/e-learning/revision-questions/policy";
import { reserveRevisionDelivery } from "@/services/e-learning/revision-questions/idempotency";
import type { RevisionProviders } from "@/services/e-learning/revision-questions/processing";
let validateTeachingDelivery: typeof import("@/services/e-learning/revision-questions/processing").validateTeachingDelivery, prepareRevisionBatch: typeof import("@/services/e-learning/revision-questions/processing").prepareRevisionBatch, persistRevisionBatch: typeof import("@/services/e-learning/revision-questions/processing").persistRevisionBatch;
import type { RevisionPayload } from "@/services/e-learning/revision-questions/contract";
let academicContext: CurrentAcademicContext | null = null;
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => academicContext } });
let alerts = 0, notifyFail = false;
mock.module("@/services/marketplace/notifications/notification.service", { namedExports: { notifyAdmins: async () => { if (notifyFail) throw new Error("Notification service unavailable"); alerts++; } } });
let students: typeof import("@/services/e-learning/revision-questions/students"), worker: typeof import("@/services/e-learning/revision-questions/worker"), webhook: typeof import("@/app/api/webhooks/tutor/questions/route");
const userIds: string[] = [], materialIds: string[] = [];
const originalFetch = globalThis.fetch;
const valid = { answer_correct: true, reasoning_quality: "strong", evidence_strength: "independent", needs_review: false, recommended_next_step: "progress", answer_feedback: "Correct.", reasoning_feedback: "Independent and clear reasoning." };
const vector = (score = 1) => normalizedVector([score, Math.sqrt(Math.max(0, 1 - score * score)), ...Array(EMBEDDING_DIMENSIONS - 2).fill(0)]);
function question(stem = "What does a negative discriminant imply?") { return { client_ref: "q1", type: "short_answer" as const, stem, correct_answer: "No real roots", explanation: "The square root of a negative discriminant is not real.", difficulty_estimate: 0.4, bloom_level: "understand" as const, tags: ["discriminant"] }; }
before(async () => {
  ({ validateTeachingDelivery, prepareRevisionBatch, persistRevisionBatch } = await import("@/services/e-learning/revision-questions/processing"));
  students = await import("@/services/e-learning/revision-questions/students"); worker = await import("@/services/e-learning/revision-questions/worker"); webhook = await import("@/app/api/webhooks/tutor/questions/route");
  process.env.REVISION_WORKSPACE_ENABLED = "false";
  process.env.REVISION_QUESTIONS_ENABLED = "true"; process.env.AI_WEBHOOK_SECRET = "test-revision-signing-secret";
  process.env.GEMINI_API_KEY = "test-revision-provider-key"; process.env.CONCEPT_EXPLAINER_API_URL = "https://concept.example.test"; process.env.AI_SERVICE_API_KEY = "test-revision-service-key";
});
afterEach(async () => {
  globalThis.fetch = originalFetch; notifyFail = false; process.env.REVISION_WORKSPACE_ENABLED = "false";
  await elearningDb.revisionSessionItem.deleteMany({ where: { session: { studentId: { in: userIds } } } });
  await elearningDb.revisionSession.deleteMany({ where: { studentId: { in: userIds } } });
  await elearningDb.revisionLearningContext.deleteMany({ where: { studentId: { in: userIds } } });
  const analysisJobs = await elearningDb.revisionConceptAnalysisJob.findMany({ where: { materialId: { in: materialIds } }, select: { id: true } });
  const concepts = await elearningDb.revisionConcept.findMany({ where: { materialId: { in: materialIds } }, select: { id: true } }), ids = concepts.map(c => c.id);
  const events = await elearningDb.revisionTeachingEvent.findMany({ where: { studentId: { in: userIds } }, select: { id: true } }), eventIds = events.map(e => e.id);
  await elearningDb.revisionReviewLog.deleteMany({ where: { studentId: { in: userIds } } });
  await elearningDb.revisionStudentCard.deleteMany({ where: { studentId: { in: userIds } } });
  await elearningDb.revisionQuestionProvenance.deleteMany({ where: { teachingEventId: { in: eventIds } } });
  await elearningDb.revisionQuestion.updateMany({ where: { conceptId: { in: ids } }, data: { variantOfId: null } });
  await elearningDb.revisionQuestionGovernance.deleteMany({ where: { question: { conceptId: { in: ids } } } });
  await elearningDb.revisionQuestion.deleteMany({ where: { conceptId: { in: ids } } });
  await elearningDb.revisionWebhookIdempotency.deleteMany({ where: { teachingEventId: { in: eventIds } } });
  await elearningDb.revisionGenerationJob.deleteMany({ where: { teachingEventId: { in: eventIds } } });
  await elearningDb.revisionTeachingEvent.deleteMany({ where: { id: { in: eventIds } } });
  await elearningDb.revisionPracticeAttempt.deleteMany({ where: { studentId: { in: userIds } } });
  await elearningDb.revisionConcept.deleteMany({ where: { id: { in: ids } } });
  await elearningDb.revisionConceptAnalysisJob.deleteMany({ where: { materialId: { in: materialIds } } });
  await elearningDb.courseMaterial.deleteMany({ where: { id: { in: materialIds } } });
  await elearningDb.revisionAdminAlert.deleteMany({ where: { correlationId: { in: [...eventIds, ...analysisJobs.map(job => job.id)] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0; materialIds.length = 0;
});
after(async () => { await elearningDb.$disconnect(); await prisma.$disconnect(); });
async function fixture() {
  const scenario = await courseScenario(); academicContext = scenario.ctx;
  for (const id of [scenario.studentId]) { await prisma.user.create({ data: { id, firstName: "Revision", lastName: "Fixture", email: `${id}@example.test`, password: "unused" } }); userIds.push(id); }
  const material = await elearningDb.courseMaterial.create({ data: { courseOfferingId: scenario.offering.id, uploadedByFacultyUserId: scenario.lecturerId, title: "Quadratics", type: "NOTES", startWeek: 1, endWeek: 3, fileName: "notes.pdf", mimeType: "application/pdf", fileSize: 1234, storageBucket: "test", storagePath: randomUUID(), aiIngestStatus: "INGESTED" } }); materialIds.push(material.id);
  const meta = { subject: scenario.course.title, curriculum: `Test ${scenario.course.id}`, level: "100", title: "Discriminants", learningObjective: "Interpret the sign of a quadratic discriminant." };
  const concept = await elearningDb.revisionConcept.create({ data: { materialId: material.id, externalId: "external-discriminant", title: meta.title, description: "Understand quadratic discriminants.", learningObjective: meta.learningObjective, conceptKey: conceptKey(meta), subject: meta.subject, curriculum: meta.curriculum, level: meta.level, topic: "Quadratics" } });
  return { ...scenario, material, concept, context: { courseId: scenario.course.id, weekNumber: 1, documentId: material.id } };
}
async function eventFor(f: Awaited<ReturnType<typeof fixture>>, studentId = f.studentId) {
  const attempt = await elearningDb.revisionPracticeAttempt.create({ data: { studentId, conceptId: f.concept.id, requestKey: randomUUID(), requestHash: "fixture", question: {}, evaluation: { ...valid, concept_id: f.concept.externalId }, evaluatedAt: new Date() } });
  const context = { subject: f.concept.subject, curriculum: f.concept.curriculum, level: f.concept.level, topic: f.concept.topic, concept_id: f.concept.externalId, concept_title: f.concept.description, language: "en" };
  const event = await elearningDb.revisionTeachingEvent.create({ data: { studentId, conceptId: f.concept.id, practiceAttemptId: attempt.id, context, taughtSummary: "Quadratic discriminant interpretation.", generation: { create: {} } } });
  const payload: RevisionPayload = { event_id: randomUUID(), teaching_event_id: event.id, student_id: studentId, occurred_at: new Date().toISOString(), context, taught_summary: event.taughtSummary, questions: [question()] };
  return { event, payload };
}
const providers = (decision: "duplicate" | "variant" | "different" | "invalid" = "different", score = 1): RevisionProviders => ({ embed: async texts => texts.map(() => vector(score)), judge: async pairs => new Map(pairs.map(p => [p.id, p.id.startsWith("valid:") ? "different" : decision])) });
async function processBatch(payload: RevisionPayload, provider = providers()) {
  const event = await validateTeachingDelivery(payload);
  const prepared = await prepareRevisionBatch(payload, event, provider);
  const reservation = await reserveRevisionDelivery(`teach_${event.id}`, "a".repeat(64), event.id, payload.event_id);
  assert.equal(reservation.kind, "claimed");
  if (reservation.kind !== "claimed") throw Error();
  return JSON.parse(await persistRevisionBatch(payload, event, reservation.claim, prepared));
}
it("requires all five approved pass conditions and never treats assisted or reviewed work as a pass", () => {
  assert.equal(teachingPassed({ ...valid, concept_id: "x" } as never), true);
  for (const patch of [{ answer_correct: false }, { evidence_strength: "assisted" }, { reasoning_quality: "weak" }, { needs_review: true }, { recommended_next_step: "reinforce" }]) assert.equal(teachingPassed({ ...valid, ...patch, concept_id: "x" } as never), false);
});
it("persists a new global question, embedding and library-initialised student card", async () => {
  const f = await fixture(), e = await eventFor(f), result = await processBatch(e.payload);
  assert.equal(result.results[0].outcome, "created");
  const card = await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: result.results[0].student_card_id } });
  const { initialRevisionCard } = await import("@/services/e-learning/revision-questions/scheduler");
  const expected = await initialRevisionCard(card.id, card.dueAt); assert.deepEqual(card.state, JSON.parse(JSON.stringify(expected)));
  const embedded = await elearningDb.$queryRaw<{ dimensions: number }[]>`SELECT vector_dims("vector") AS dimensions FROM "RevisionQuestionEmbedding" WHERE "questionId" = ${result.results[0].question_id}`;
  assert.equal(embedded[0].dimensions, EMBEDDING_DIMENSIONS);
});
it("reuses exact global questions across students with independent cards and unchanged review history", async () => {
  const f = await fixture(), first = await processBatch((await eventFor(f)).payload);
  const cardId = first.results[0].student_card_id;
  const reviewKey = randomUUID(); await students.reviewRevisionCard(f.studentId, { cardId, rating: 3, version: 0, requestId: reviewKey });
  const reviewed = await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: cardId } });
  await students.reviewRevisionCard(f.studentId, { cardId, rating: 3, version: 0, requestId: reviewKey });
  const repeat = await processBatch((await eventFor(f)).payload); assert.equal(repeat.results[0].question_id, first.results[0].question_id); assert.equal(repeat.results[0].student_card_id, cardId);
  assert.deepEqual(await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: cardId } }), reviewed);
  assert.equal(await elearningDb.revisionReviewLog.count({ where: { studentCardId: cardId } }), 1);
  const otherId = await f.makeStudent("APPROVED"); await prisma.user.create({ data: { id: otherId, email: `${otherId}@example.test`, firstName: "Other", lastName: "Fixture", password: "unused" } }); userIds.push(otherId);
  const other = await processBatch((await eventFor(f, otherId)).payload); assert.equal(other.results[0].question_id, first.results[0].question_id); assert.notEqual(other.results[0].student_card_id, cardId);
  await assert.rejects(students.reviewRevisionCard(otherId, { cardId, rating: 3, version: 1, requestId: randomUUID() }));
});
for (const score of [0.85, 0.89, 0.92, 0.98]) it(`uses the LLM judge at similarity ${score} instead of rejecting solely by similarity`, async () => {
  const f = await fixture(), first = await processBatch((await eventFor(f)).payload), second = await eventFor(f);
  second.payload.questions = [question("Explain the consequence of a discriminant below zero.")]; let judged = false;
  const provider = providers("duplicate", score), original = provider.judge;
  provider.judge = async (pairs, signal) => { judged ||= pairs.some(p => !p.id.startsWith("valid:")); return original(pairs, signal); };
  const result = await processBatch(second.payload, provider); assert.ok(judged); assert.equal(result.results[0].outcome, "reused_existing"); assert.equal(result.results[0].question_id, first.results[0].question_id);
});
it("retains useful variants and accepts a different skill even at high similarity", async () => {
  const f = await fixture(), first = await processBatch((await eventFor(f)).payload), variant = await eventFor(f); variant.payload.questions = [question("Apply a negative discriminant to a worked quadratic example.")];
  const result = await processBatch(variant.payload, providers("variant", 0.95)); assert.equal(result.results[0].outcome, "created_variant");
  assert.equal((await elearningDb.revisionQuestion.findUniqueOrThrow({ where: { id: result.results[0].question_id } })).variantOfId, first.results[0].question_id);
  const different = await eventFor(f); different.payload.questions = [question("Calculate the discriminant and interpret a numerical result.")];
  assert.equal((await processBatch(different.payload, providers("different", 0.99))).results[0].outcome, "created");
});
it("rejects invalid content per question while preserving other results", async () => {
  const f = await fixture(), e = await eventFor(f); e.payload.questions.push({ ...question("Unrelated question"), client_ref: "q2" });
  const provider = providers(); provider.judge = async pairs => new Map(pairs.map(p => [p.id, p.id === "valid:1" ? "invalid" : "different"]));
  const result = await processBatch(e.payload, provider); assert.equal(result.results[0].outcome, "created"); assert.equal(result.results[1].outcome, "rejected_invalid"); assert.equal(result.results[1].student_card_id, null);
  assert.equal((await elearningDb.revisionGenerationJob.findUniqueOrThrow({ where: { teachingEventId: e.event.id } })).status, "NEEDS_REVIEW");
  const beforeAlerts = alerts; await worker.flushRevisionAlerts(); assert.equal(alerts, beforeAlerts + 1); await worker.flushRevisionAlerts(); assert.equal(alerts, beforeAlerts + 1);
});
it("never treats unavailable embeddings or judgment as proof of uniqueness", async () => {
  const f = await fixture(), e = await eventFor(f), event = await validateTeachingDelivery(e.payload), provider = providers();
  provider.embed = async () => { throw Error("offline"); }; await assert.rejects(prepareRevisionBatch(e.payload, event, provider));
  const other = providers(); other.judge = async () => { throw Error("judge offline"); }; await assert.rejects(prepareRevisionBatch(e.payload, event, other));
  assert.equal(await elearningDb.revisionQuestion.count({ where: { conceptId: f.concept.id } }), 0);
});
it("fences cross-event candidate races and rejects forged student/context relationships", async () => {
  const f = await fixture(), a = await eventFor(f), b = await eventFor(f), trusted = await validateTeachingDelivery(a.payload);
  const prepared = await prepareRevisionBatch(a.payload, trusted, providers());
  await processBatch(b.payload);
  const reserved = await reserveRevisionDelivery(`teach_${a.event.id}`, "b".repeat(64), a.event.id, a.payload.event_id); assert.equal(reserved.kind, "claimed");
  if (reserved.kind === "claimed") await assert.rejects(persistRevisionBatch(a.payload, trusted, reserved.claim, prepared));
  await assert.rejects(validateTeachingDelivery({ ...a.payload, student_id: "forged-student" }));
  await assert.rejects(validateTeachingDelivery({ ...a.payload, context: { ...a.payload.context, subject: "Unrelated subject" } }));
});
it("executes practice -> passed event -> queued generation -> signed synchronous webhook -> stored replay", async () => {
  const f = await fixture(); let originalBody = "", originalResponse = "";
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname, body = JSON.parse(String(init?.body));
    if (path === "/generate-practice") return Response.json({ concept_id: f.concept.externalId, needs_review: false, questions: [{ concept_id: f.concept.externalId, question_id: "practice-provider-id", difficulty: "medium", question_text: "What does a negative discriminant imply?", question_type: "short_answer", expected_answer: "No real roots", explanation: "A negative value has no real square root.", evaluation_criteria: ["No real roots"] }] });
    if (path === "/evaluate-practice") { assert.equal(body.expected_answer, "No real roots"); return Response.json({ ...valid, concept_id: f.concept.externalId }); }
    if (path.endsWith(":embedContent")) return Response.json({ embedding: { values: vector() } });
    if (path.endsWith(":generateContent")) { const pairs = JSON.parse(body.contents[0].parts[0].text); return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ results: pairs.map((p: { id: string }) => ({ id: p.id, decision: "different" })) }) }] } }] }); }
    assert.equal(path, "/generate-revision-questions");
    originalBody = JSON.stringify({ event_id: randomUUID(), teaching_event_id: body.teaching_event_id, student_id: body.student_id, occurred_at: new Date().toISOString(), context: { subject: body.subject, curriculum: body.curriculum, level: body.level, topic: body.topic, concept_id: body.concept_id, concept_title: body.concept_description, language: body.language }, taught_summary: body.taught_summary, questions: [question()] });
    const response = await webhook.POST(signed(originalBody)); assert.equal(response.status, 200, await response.clone().text()); originalResponse = await response.text();
    return Response.json({ teaching_event_id: body.teaching_event_id, generated_count: 1, webhook_attempted: true, webhook_status: "processed", webhook_results: JSON.parse(originalResponse).results, needs_review: false });
  };
  const requestId = randomUUID(), practice = await students.createPractice(f.studentId, { ...f.context, conceptId: f.concept.id, requestId });
  const evaluated = await students.evaluatePractice(f.studentId, { ...f.context, attemptId: practice.attemptId, answer: "No real roots", reasoning: "The square root would not be real." });
  assert.equal(evaluated.passed, true); assert.ok(evaluated.teachingEventId);
  await students.evaluatePractice(f.studentId, { ...f.context, attemptId: practice.attemptId, answer: "No real roots", reasoning: "The square root would not be real." });
  assert.equal(await elearningDb.revisionTeachingEvent.count({ where: { practiceAttemptId: practice.attemptId } }), 1);
  const work = await worker.claimRevisionWork(); assert.equal(work?.type, "generation"); if (work?.type === "generation") await worker.processRevisionGeneration(work.job);
  assert.equal((await elearningDb.revisionGenerationJob.findUniqueOrThrow({ where: { teachingEventId: evaluated.teachingEventId } })).status, "COMPLETED");
  const repeated = await webhook.POST(signed(originalBody)); assert.equal(repeated.status, 200); assert.equal(await repeated.text(), originalResponse);
  assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 1);
  assert.equal(await elearningDb.revisionQuestion.count({ where: { conceptId: f.concept.id } }), 1);
});
function signed(raw: string) {
  const payload = JSON.parse(raw); return new Request("https://app.test/api/webhooks/tutor/questions", { method: "POST", headers: { "content-type": "application/json", "x-akadverse-signature": createHmac("sha256", process.env.AI_WEBHOOK_SECRET!).update(raw).digest("hex"), "x-akadverse-timestamp": new Date().toISOString(), "idempotency-key": `teach_${payload.teaching_event_id}` }, body: raw });
}

it("reuses exact meaning hashes without calling unavailable embedding or judgment providers", async () => {
  const f = await fixture(), first = await processBatch((await eventFor(f)).payload), next = await eventFor(f);
  const unavailable: RevisionProviders = { embed: async () => { throw Error("Must not call embeddings for an exact match"); }, judge: async () => { throw Error("Must not call judge for an exact match"); } };
  const result = await processBatch(next.payload, unavailable); assert.equal(result.results[0].question_id, first.results[0].question_id);
});
it("rolls back question, embedding, provenance and receipt completion when card persistence fails", async () => {
  const f = await fixture(), first = await processBatch((await eventFor(f)).payload), next = await eventFor(f); next.payload.questions = [question("Interpret a positive discriminant in a different example.")];
  const event = await validateTeachingDelivery(next.payload), prepared = await prepareRevisionBatch(next.payload, event, providers("different", 0.2)); prepared.cards[0].id = first.results[0].student_card_id;
  const reservation = await reserveRevisionDelivery(`teach_${event.id}`, "c".repeat(64), event.id, next.payload.event_id); assert.equal(reservation.kind, "claimed");
  if (reservation.kind === "claimed") await assert.rejects(persistRevisionBatch(next.payload, event, reservation.claim, prepared));
  assert.equal(await elearningDb.revisionQuestion.count({ where: { conceptId: f.concept.id } }), 1);
  assert.equal(await elearningDb.revisionQuestionProvenance.count({ where: { teachingEventId: event.id } }), 0);
  assert.equal((await elearningDb.revisionWebhookIdempotency.findUniqueOrThrow({ where: { idempotencyKey: `teach_${event.id}` } })).status, "PROCESSING");
});
it("queues material analysis and saves only server-verified concepts with academic context", async () => {
  const f = await fixture(); await elearningDb.revisionConcept.delete({ where: { id: f.concept.id } });
  const prepared = await students.prepareConcepts(f.studentId, f.context); assert.equal(prepared.status, "PENDING");
  globalThis.fetch = async (_url, init) => { assert.equal(JSON.parse(String(init?.body)).document_id, f.material.id); return Response.json({ document_id: f.material.id, chunks_analysed: 2, lesson_plan: { document_id: f.material.id, sections: [{ section_id: "section-1", title: "Quadratics", concept_ids: ["verified-concept"] }], concepts: [{ concept_id: "verified-concept", title: "Discriminants", description: "Understand a quadratic discriminant.", learning_objective: "Interpret real roots.", difficulty: "introductory", prerequisite_concept_ids: [], source_chunk_ids: ["chunk-1"] }], missing_prerequisites: [], notes: null } }); };
  const work = await worker.claimRevisionWork(); assert.equal(work?.type, "analysis"); if (work?.type === "analysis") await worker.processConceptAnalysis(work.job);
  const concepts = await elearningDb.revisionConcept.findMany({ where: { materialId: f.material.id } }); assert.equal(concepts.length, 1); assert.equal(concepts[0].externalId, "verified-concept"); assert.equal(concepts[0].subject, f.course.title);
});
it("preserves a passed event and quarantines an uncertain generation instead of blindly regenerating", async () => {
  const f = await fixture(), e = await eventFor(f); globalThis.fetch = async () => { throw Error("Simulated connection loss"); };
  const work = await worker.claimRevisionWork(); assert.equal(work?.type, "generation"); if (work?.type === "generation") await worker.processRevisionGeneration(work.job);
  const job = await elearningDb.revisionGenerationJob.findUniqueOrThrow({ where: { teachingEventId: e.event.id } }); assert.equal(job.status, "NEEDS_REVIEW"); assert.ok(job.claimToken); assert.ok(await elearningDb.revisionTeachingEvent.findUnique({ where: { id: e.event.id } }));
  assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 0);
  assert.equal(await worker.claimRevisionWork(), null);
});
it("keeps failed notification deliveries pending and retries the existing admin outbox", async () => {
  const f = await fixture(), e = await eventFor(f); await worker.queueRevisionAlert("TEST_FAILURE", e.event.id);
  notifyFail = true; assert.equal(await worker.flushRevisionAlerts(), 0);
  const alert = await elearningDb.revisionAdminAlert.findFirstOrThrow({ where: { correlationId: e.event.id } }); assert.equal(alert.status, "PENDING"); assert.equal(alert.attempts, 1);
  notifyFail = false; await elearningDb.revisionAdminAlert.update({ where: { id: alert.id }, data: { nextAttemptAt: new Date(0) } }); assert.equal(await worker.flushRevisionAlerts(), 1);
  assert.equal((await elearningDb.revisionAdminAlert.findUniqueOrThrow({ where: { id: alert.id } })).status, "DELIVERED");
});
it("prevents an expired generation worker from starting a remote dispatch", async () => {
  const f = await fixture(), e = await eventFor(f);
  const work = await worker.claimRevisionWork(); assert.equal(work?.type, "generation");
  if (work?.type !== "generation") return;
  await elearningDb.revisionGenerationJob.update({ where: { id: work.job.id }, data: { leaseUntil: new Date(0) } });
  let calls = 0; globalThis.fetch = async () => { calls++; throw Error("Unexpected remote dispatch"); };
  await worker.processRevisionGeneration(work.job);
  assert.equal(calls, 0);
  assert.equal((await elearningDb.revisionGenerationJob.findUniqueOrThrow({ where: { teachingEventId: e.event.id } })).submittedAt, null);
});
it("returns a retryable synchronous failure and no cards when embeddings fail across sender retries", async () => {
  const f = await fixture(), e = await eventFor(f), raw = JSON.stringify(e.payload); globalThis.fetch = async () => { throw Error("Embedding unavailable"); };
  for (let i = 0; i < 3; i++) { const response = await webhook.POST(signed(raw)); assert.equal(response.status, 503); assert.ok(response.headers.get("retry-after")); }
  assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 0);
  const receipt = await elearningDb.revisionWebhookIdempotency.findUniqueOrThrow({ where: { idempotencyKey: `teach_${e.event.id}` } }); assert.equal(receipt.status, "PROCESSING"); assert.equal(receipt.attempts, 3);
  assert.equal(await elearningDb.revisionAdminAlert.count({ where: { correlationId: e.event.id } }), 1);
});

it("enforces session, student role, record ownership and server-owned expected answers at the student API", async () => {
  const api = await import("@/app/api/e-learning/revision/route"), f = await fixture();
  const get = () => api.GET(new Request("https://app.test/api/e-learning/revision"));
  signInAs(null); assert.equal((await get()).status, 401);
  signInAs({ id: f.studentId, email: "fixture@example.test" });
  await prisma.user.update({ where: { id: f.studentId }, data: { role: "faculty" } }); assert.equal((await get()).status, 403);
  await prisma.user.update({ where: { id: f.studentId }, data: { role: "student" } }); assert.equal((await get()).status, 200);
  process.env.REVISION_QUESTIONS_ENABLED = "false";
  try { assert.equal((await get()).status, 503); } finally { process.env.REVISION_QUESTIONS_ENABLED = "true"; }
  const unknown = await api.POST(new Request("https://app.test/api/e-learning/revision", { method: "POST", headers: { "content-type": "application/json", origin: "https://app.test" }, body: JSON.stringify({ action: "set_passed", passed: true, studentId: f.studentId }) }));
  assert.equal(unknown.status, 400); assert.equal(await elearningDb.revisionTeachingEvent.count({ where: { studentId: f.studentId } }), 0);
  const admin = await import("@/app/api/e-learning/admin/revision-generation/route"); assert.equal((await admin.GET(new Request("https://app.test/api/e-learning/admin/revision-generation"))).status, 403);
});
it("replays the authenticated original delivery through the admin endpoint without provider calls or duplicate cards", async () => {
  const f = await fixture(), e = await eventFor(f), raw = Buffer.from(JSON.stringify(e.payload));
  const event = await validateTeachingDelivery(e.payload);
  const prepared = await prepareRevisionBatch(e.payload, event, providers());
  const reservation = await reserveRevisionDelivery(`teach_${event.id}`, createHash("sha256").update(raw).digest("hex"), event.id, e.payload.event_id, raw);
  assert.equal(reservation.kind, "claimed"); if (reservation.kind !== "claimed") return;
  const original = await persistRevisionBatch(e.payload, event, reservation.claim, prepared);
  globalThis.fetch = async () => { throw Error("A completed replay must not call a provider"); };
  const admin = await import("@/app/api/e-learning/admin/revision-generation/route");
  assert.equal(admin.maxDuration, 300);
  const request = () => new Request("https://app.test/api/e-learning/admin/revision-generation", { method: "POST", headers: { "content-type": "application/json", origin: "https://app.test" }, body: JSON.stringify({ action: "replay_delivery", confirmReplay: true, teachingEventId: event.id }) });
  signInAs({ id: f.studentId, email: "fixture@example.test" }); assert.equal((await admin.POST(request())).status, 403);
  signInAs({ id: f.studentId, email: "fixture@example.test", isAdmin: true });
  const response = await admin.POST(request()); assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result, JSON.parse(original));
  assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 1);
  assert.equal(await elearningDb.revisionQuestionProvenance.count({ where: { teachingEventId: event.id } }), 1);
  assert.equal((await elearningDb.revisionWebhookIdempotency.findUniqueOrThrow({ where: { idempotencyKey: `teach_${event.id}` } })).attempts, 1);
});
it("serializes concurrent card reviews and preserves a single student-specific review history", async () => {
  const f = await fixture(), result = await processBatch((await eventFor(f)).payload), cardId = result.results[0].student_card_id;
  const requestId = randomUUID();
  const results = await Promise.all([students.reviewRevisionCard(f.studentId, { cardId, rating: 3, version: 0, requestId }), students.reviewRevisionCard(f.studentId, { cardId, rating: 3, version: 0, requestId })]);
  assert.equal(results.filter(r => r.replay).length, 1); assert.equal(await elearningDb.revisionReviewLog.count({ where: { studentCardId: cardId } }), 1);
  await assert.rejects(students.reviewRevisionCard(f.studentId, { cardId, rating: 3, version: 0, requestId: randomUUID() }));
  assert.equal((await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: cardId } })).version, 1);
});

it("deduplicates repeated questions inside one batch without creating duplicate student cards", async () => {
  const f = await fixture(), e = await eventFor(f); e.payload.questions.push({ ...question(), client_ref: "q2" });
  const result = await processBatch(e.payload); assert.equal(result.results[0].question_id, result.results[1].question_id); assert.equal(result.results[0].student_card_id, result.results[1].student_card_id);
  assert.equal(result.results[1].outcome, "reused_existing"); assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 1);
});
it("persists a root and useful intra-batch variant atomically using the same canonical family", async () => {
  const f = await fixture(), e = await eventFor(f); e.payload.questions.push({ ...question("Apply the discriminant to a numerical quadratic."), client_ref: "q2" });
  const result = await processBatch(e.payload, providers("variant")); assert.equal(result.results[1].outcome, "created_variant");
  assert.equal((await elearningDb.revisionQuestion.findUniqueOrThrow({ where: { id: result.results[1].question_id } })).variantOfId, result.results[0].question_id);
  assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 2);
});

async function workspaceFixture() {
  process.env.REVISION_WORKSPACE_ENABLED = "true";
  const f = await fixture(), event = await eventFor(f); const result = await processBatch(event.payload);
  const workspace = await import("@/services/e-learning/revision-questions/workspace");
  const access = await import("@/services/e-learning/revision-questions/eligibility");
  const pool = await access.coveragePool(f.studentId);
  assert.equal(pool.courses.length, 1, "fixture registration resolves");
  assert.equal(pool.scopes.size, 3, "fixture coverage resolves");
  assert.ok(await elearningDb.revisionQuestionGovernance.findUnique({ where: { questionId: result.results[0].question_id } }), "fixture governance exists");
  return { f, event, result, workspace };
}
function mockEvaluation(conceptId: string, patch = {}) {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); assert.equal(body.concept_id, conceptId); assert.ok(body.expected_answer);
    return Response.json({ ...valid, concept_id: conceptId, ...patch });
  };
}
it("uses one card in Course and Random sessions, persists evaluated answers and reviews atomically", async () => {
  const { f, result, workspace } = await workspaceFixture();
  const course = await workspace.startRevisionSession(f.studentId, { mode: "COURSE", offeringId: f.offering.id, requestId: randomUUID() });
  const random = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  assert.ok(course.current); assert.ok(random.current); assert.equal(course.current.introduction, true);
  assert.equal("correctAnswer" in course.current, false); assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 1);
  mockEvaluation(f.concept.externalId);
  const evaluated = await workspace.answerRevisionItem(f.studentId, { itemId: course.current.id, answer: "No real roots", reasoning: "Negative square root" });
  assert.equal(evaluated.current?.evaluation && (evaluated.current.evaluation as Record<string, unknown>).answer_correct, true);
  assert.ok(evaluated.current?.correctAnswer);
  const key = randomUUID(); await workspace.rateRevisionItem(f.studentId, { itemId: course.current.id, rating: 3, requestId: key });
  await workspace.rateRevisionItem(f.studentId, { itemId: course.current.id, rating: 3, requestId: key });
  assert.equal(await elearningDb.revisionReviewLog.count({ where: { studentId: f.studentId } }), 1);
  assert.equal((await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: result.results[0].student_card_id } })).version, 1);
  const otherMode = await workspace.revisionSessionView(f.studentId, random.id); assert.equal(otherMode.current, null);
  assert.equal((await elearningDb.revisionSessionItem.findUniqueOrThrow({ where: { id: random.current.id } })).status, "SKIPPED");
});
it("rejects unregistered courses and students without passed coverage even when the bank has questions", async () => {
  const { f, workspace } = await workspaceFixture(), secondId = await f.makeStudent("APPROVED");
  await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "COURSE", offeringId: "other-course", requestId: randomUUID() }), /registered courses/);
  await assert.rejects(workspace.startRevisionSession(secondId, { mode: "RANDOM", requestId: randomUUID() }), /No eligible/);
  await elearningDb.courseRegistration.updateMany({ where: { studentUserId: f.studentId }, data: { status: "PENDING_HOD" } });
  await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }), /No eligible/);
});
it("excludes suspended, retired, changed-source and inactive-concept questions without deleting old sessions", async () => {
  const { f, result, workspace } = await workspaceFixture(), qid = result.results[0].question_id;
  const session = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  for (const status of ["SUSPENDED", "RETIRED"]) {
    await elearningDb.revisionQuestionGovernance.update({ where: { questionId: qid }, data: { publicationStatus: status } });
    await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }), /No eligible/);
  }
  assert.equal((await workspace.revisionSessionView(f.studentId, session.id)).current, null);
  await elearningDb.revisionQuestionGovernance.update({ where: { questionId: qid }, data: { publicationStatus: "PUBLISHED" } });
  await elearningDb.courseMaterial.update({ where: { id: f.material.id }, data: { storagePath: randomUUID() } });
  await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }), /No eligible/);
  assert.equal(await elearningDb.revisionSession.count({ where: { studentId: f.studentId } }), 1);
});
it("blocks reveal and legacy review after a student loses eligibility", async () => {
  const { f, result } = await workspaceFixture(), id = result.results[0].student_card_id;
  await elearningDb.courseRegistration.updateMany({ where: { studentUserId: f.studentId }, data: { status: "PENDING_HOD" } });
  assert.deepEqual(await students.dueRevisionCards(f.studentId), []);
  await assert.rejects(students.revealRevisionCard(f.studentId, id), /eligible/);
  await assert.rejects(students.reviewRevisionCard(f.studentId, { cardId: id, version: 0, rating: 3, requestId: randomUUID() }), /eligible/);
});
it("replays session creation and evaluations while rejecting changed input and cross-student access", async () => {
  const { f, workspace } = await workspaceFixture(), key = randomUUID();
  const one = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: key });
  const replay = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: key }); assert.equal(one.id, replay.id);
  await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "COURSE", offeringId: f.offering.id, requestId: key }), /another session/);
  await assert.rejects(workspace.revisionSessionView("another-student", one.id), /unavailable/);
  await assert.rejects(workspace.rateRevisionItem(f.studentId, { itemId: one.current!.id, rating: 3, requestId: randomUUID() }), /Submit an answer/);
  mockEvaluation(f.concept.externalId); await workspace.answerRevisionItem(f.studentId, { itemId: one.current!.id, answer: "No real roots" });
  globalThis.fetch = async () => { throw Error("Must not infer twice"); };
  assert.ok((await workspace.answerRevisionItem(f.studentId, { itemId: one.current!.id, answer: "No real roots" })).current?.evaluation);
  await assert.rejects(workspace.answerRevisionItem(f.studentId, { itemId: one.current!.id, answer: "Different answer" }), /already been evaluated/);
});
it("keeps answers recoverable after AI failure and never schedules a review before feedback", async () => {
  const { f, workspace } = await workspaceFixture();
  const session = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  globalThis.fetch = async () => { throw Error("Provider unavailable"); };
  await assert.rejects(workspace.answerRevisionItem(f.studentId, { itemId: session.current!.id, answer: "Saved answer" }));
  const resumed = await workspace.revisionSessionView(f.studentId, session.id); assert.equal(resumed.current?.answer, "Saved answer"); assert.equal(resumed.current?.evaluation, null);
  assert.equal(await elearningDb.revisionReviewLog.count({ where: { studentId: f.studentId } }), 0);
});
it("builds bounded learning evidence without granting mastery and recovers a missed context signal", async () => {
  const { f, workspace } = await workspaceFixture();
  const session = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }); mockEvaluation(f.concept.externalId, { answer_correct: false });
  await workspace.answerRevisionItem(f.studentId, { itemId: session.current!.id, answer: "Wrong", reasoning: "My reasoning" });
  await workspace.rateRevisionItem(f.studentId, { itemId: session.current!.id, rating: 1, requestId: randomUUID() });
  const context = await import("@/services/e-learning/revision-questions/learning-context");
  await elearningDb.revisionLearningContext.delete({ where: { studentId: f.studentId } });
  assert.equal(await context.refreshRevisionContexts(), 1);
  const prepared = await context.preparedRevisionContext(f.studentId); assert.ok(prepared);
  const evidence = prepared.evidence as { concepts: { incorrect: number; difficultRecall: number; mastery: string }[] }; assert.equal(evidence.concepts[0].incorrect, 1); assert.equal(evidence.concepts[0].difficultRecall, 1); assert.equal(evidence.concepts[0].mastery, "not_assessed");
});
it("enforces new-question introduction limits on existing unreviewed cards", async () => {
  const { f, workspace } = await workspaceFixture(); process.env.REVISION_NEW_QUESTION_LIMIT = "0";
  try { await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }), /No eligible/); }
  finally { delete process.env.REVISION_NEW_QUESTION_LIMIT; }
});
it("evaluates MCQ, true/false and text answers while keeping the recall rating independent", async () => {
  const { f, workspace } = await workspaceFixture(), e = await eventFor(f);
  e.payload.questions = [
    { ...question("Which conclusion follows?"), client_ref: "mcq", type: "mcq", options: [{ key: "A", text: "No real roots" }, { key: "B", text: "Two real roots" }], correct_answer: "A" },
    { ...question("Does a negative discriminant imply no real roots?"), client_ref: "tf", type: "true_false", correct_answer: true },
  ];
  await processBatch(e.payload); let view = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  const formats = new Set<string>(); mockEvaluation(f.concept.externalId);
  while (view.current) {
    const item = view.current; formats.add(item.question.type);
    if (item.question.type !== "short_answer") await assert.rejects(workspace.answerRevisionItem(f.studentId, { itemId: item.id, answer: "not-an-option" }), /available answers/);
    await workspace.answerRevisionItem(f.studentId, { itemId: item.id, answer: item.question.type === "mcq" ? "A" : item.question.type === "true_false" ? "true" : "No real roots" });
    view = await workspace.rateRevisionItem(f.studentId, { itemId: item.id, rating: 1, requestId: randomUUID() });
  }
  assert.deepEqual([...formats].sort(), ["mcq", "short_answer", "true_false"]);
  assert.equal(await elearningDb.revisionReviewLog.count({ where: { studentId: f.studentId, rating: 1 } }), 3);
});
it("only labels consistent retrieval after independent success on three distinct questions", async () => {
  const { f, workspace } = await workspaceFixture(), e = await eventFor(f);
  e.payload.questions = [question("Explain condition A."), { ...question("Explain condition B."), client_ref: "q2" }]; await processBatch(e.payload);
  let view = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }); mockEvaluation(f.concept.externalId);
  while (view.current) { const id = view.current.id; await workspace.answerRevisionItem(f.studentId, { itemId: id, answer: "Independent answer" }); view = await workspace.rateRevisionItem(f.studentId, { itemId: id, rating: 3, requestId: randomUUID() }); }
  const context = await import("@/services/e-learning/revision-questions/learning-context"); await context.refreshRevisionContexts();
  const value = await context.preparedRevisionContext(f.studentId); const evidence = value!.evidence as { concepts: { mastery: string; retrievalEvidence: string }[] };
  assert.equal(evidence.concepts[0].retrievalEvidence, "consistent_retrieval"); assert.equal(evidence.concepts[0].mastery, "not_assessed"); assert.ok(!JSON.stringify(value).includes('"mastered"'));
});
it("supports all four FSRS ratings without allowing correctness to choose the grade", async () => {
  const { f, workspace } = await workspaceFixture(), e = await eventFor(f);
  e.payload.questions = [question("Recall one."), { ...question("Recall two."), client_ref: "q2" }, { ...question("Recall three."), client_ref: "q3" }]; await processBatch(e.payload);
  mockEvaluation(f.concept.externalId, { answer_correct: false }); let view = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  for (const rating of [1, 2, 3, 4]) { assert.ok(view.current); const id = view.current.id; await workspace.answerRevisionItem(f.studentId, { itemId: id, answer: "Wrong answer" }); view = await workspace.rateRevisionItem(f.studentId, { itemId: id, rating, requestId: randomUUID() }); }
  const reviews = await elearningDb.revisionReviewLog.findMany({ where: { studentId: f.studentId } }); assert.deepEqual(reviews.map(r => r.rating).sort(), [1, 2, 3, 4]);
});
it("mixes registered courses in Random mode and isolates the chosen Course mode", async () => {
  const { f, workspace } = await workspaceFixture();
  const placement = await elearningDb.courseOffering.findUniqueOrThrow({ where: { id: f.offering.id }, include: { curriculumCourse: true } });
  const course = await elearningDb.course.create({ data: { code: `PHY-${randomUUID().slice(0, 8)}`, title: "Physics", creditUnits: 3 } });
  const cc = await elearningDb.curriculumCourse.create({ data: { curriculumId: placement.curriculumCourse.curriculumId, courseId: course.id, level: 100, creditUnits: 3 } });
  const offering = await elearningDb.courseOffering.create({ data: { curriculumCourseId: cc.id } });
  const registration = await elearningDb.courseRegistration.findFirstOrThrow({ where: { studentUserId: f.studentId } }); await elearningDb.courseRegistrationItem.create({ data: { courseRegistrationId: registration.id, courseId: course.id } });
  const material = await elearningDb.courseMaterial.create({ data: { courseOfferingId: offering.id, uploadedByFacultyUserId: f.lecturerId, title: "Physics", type: "NOTES", startWeek: 1, endWeek: 1, fileName: "physics.pdf", mimeType: "application/pdf", fileSize: 1000, storageBucket: "test", storagePath: randomUUID(), aiIngestStatus: "INGESTED" } }); materialIds.push(material.id);
  const meta = { subject: course.title, curriculum: f.concept.curriculum, level: "100", title: "Motion", learningObjective: "Describe motion" };
  const concept = await elearningDb.revisionConcept.create({ data: { materialId: material.id, externalId: "motion", ...meta, description: "Describe motion", conceptKey: conceptKey(meta), topic: "Motion" } });
  await processBatch((await eventFor({ ...f, course, offering, material, concept })).payload);
  const random = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  const items = await elearningDb.revisionSessionItem.findMany({ where: { sessionId: random.id }, include: { coverageEvent: { include: { concept: true } } } }); assert.equal(new Set(items.map(i => i.coverageEvent.concept.materialId)).size, 2);
  const only = await workspace.startRevisionSession(f.studentId, { mode: "COURSE", offeringId: f.offering.id, requestId: randomUUID() });
  const own = await elearningDb.revisionSessionItem.findMany({ where: { sessionId: only.id } }); assert.equal(own.length, 1); assert.equal(own[0].questionId, (await elearningDb.revisionQuestion.findFirstOrThrow({ where: { conceptId: f.concept.id } })).id);
});
it("prioritizes due reviews, excludes future reviews, and retains owned history after registration changes", async () => {
  const { f, workspace, result } = await workspaceFixture();
  const current = await workspace.startRevisionSession(f.studentId, { mode: "COURSE", offeringId: f.offering.id, requestId: randomUUID() }); mockEvaluation(f.concept.externalId);
  await workspace.answerRevisionItem(f.studentId, { itemId: current.current!.id, answer: "No real roots" }); await workspace.rateRevisionItem(f.studentId, { itemId: current.current!.id, rating: 3, requestId: randomUUID() });
  await assert.rejects(workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }), /No eligible/);
  const e = await eventFor(f); e.payload.questions = [question("A genuinely new question")]; await processBatch(e.payload);
  await elearningDb.revisionStudentCard.update({ where: { id: result.results[0].student_card_id }, data: { dueAt: new Date(0) } });
  const next = await workspace.startRevisionSession(f.studentId, { mode: "COURSE", offeringId: f.offering.id, requestId: randomUUID() }); assert.equal(next.current?.introduction, false);
  await elearningDb.courseRegistration.updateMany({ where: { studentUserId: f.studentId }, data: { status: "PENDING_HOD" } });
  assert.equal((await workspace.revisionSessionView(f.studentId, next.id)).current, null);
  assert.equal((await workspace.revisionHome(f.studentId)).history.length, 1);
});
async function failingInsert(table: "RevisionReviewLog" | "RevisionLearningContext", studentId: string, work: () => Promise<void>) {
  const name = `revision_test_${randomUUID().replaceAll("-", "")}`;
  await elearningDb.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."studentId" = '${studentId.replaceAll("'", "''")}' THEN RAISE EXCEPTION 'Simulated revision persistence outage'; END IF; RETURN NEW; END $$`);
  try {
    await elearningDb.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
    try { await work(); } finally { await elearningDb.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`); }
  } finally { await elearningDb.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`); }
}
it("rolls back the card and session item when review-history persistence fails", async () => {
  const { f, workspace, result } = await workspaceFixture(); const session = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }); mockEvaluation(f.concept.externalId);
  await workspace.answerRevisionItem(f.studentId, { itemId: session.current!.id, answer: "No real roots" });
  await failingInsert("RevisionReviewLog", f.studentId, async () => { await assert.rejects(workspace.rateRevisionItem(f.studentId, { itemId: session.current!.id, rating: 3, requestId: randomUUID() })); });
  assert.equal((await elearningDb.revisionStudentCard.findUniqueOrThrow({ where: { id: result.results[0].student_card_id } })).version, 0);
  assert.equal((await elearningDb.revisionSessionItem.findUniqueOrThrow({ where: { id: session.current!.id } })).status, "EVALUATED");
});
it("keeps a completed review successful when learning-context storage fails and recovers later", async () => {
  const { f, workspace } = await workspaceFixture(); const session = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() }); mockEvaluation(f.concept.externalId);
  await workspace.answerRevisionItem(f.studentId, { itemId: session.current!.id, answer: "No real roots" });
  await failingInsert("RevisionLearningContext", f.studentId, async () => { const result = await workspace.rateRevisionItem(f.studentId, { itemId: session.current!.id, rating: 3, requestId: randomUUID() }); assert.equal(result.status, "COMPLETED"); });
  assert.equal(await elearningDb.revisionReviewLog.count({ where: { studentId: f.studentId } }), 1);
  const context = await import("@/services/e-learning/revision-questions/learning-context"); assert.equal(await context.refreshRevisionContexts(), 1); assert.ok(await context.preparedRevisionContext(f.studentId));
});
it("does not infer consistent retrieval from repeated success on only one question", async () => {
  const { f, workspace, result } = await workspaceFixture(); mockEvaluation(f.concept.externalId);
  for (let i = 0; i < 3; i++) {
    await elearningDb.revisionStudentCard.update({ where: { id: result.results[0].student_card_id }, data: { dueAt: new Date(0) } });
    const session = await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
    await workspace.answerRevisionItem(f.studentId, { itemId: session.current!.id, answer: "No real roots" }); await workspace.rateRevisionItem(f.studentId, { itemId: session.current!.id, rating: 3, requestId: randomUUID() });
  }
  const context = await import("@/services/e-learning/revision-questions/learning-context"); await context.refreshRevisionContexts();
  const evidence = (await context.preparedRevisionContext(f.studentId))!.evidence as { concepts: { independentCorrect: number; mastery: string }[] };
  assert.equal(evidence.concepts[0].independentCorrect, 3); assert.equal(evidence.concepts[0].mastery, "not_assessed");
});
it("blocks direct database readers with RLS while the server owner retains access", async () => {
  const { f, workspace } = await workspaceFixture(); await workspace.startRevisionSession(f.studentId, { mode: "RANDOM", requestId: randomUUID() });
  const role = `revision_reader_${randomUUID().replaceAll("-", "")}`;
  await elearningDb.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN`);
  try {
    await elearningDb.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await elearningDb.$executeRawUnsafe(`GRANT SELECT, INSERT ON "RevisionQuestion", "RevisionSession" TO "${role}"`);
    assert.ok(await elearningDb.revisionQuestion.count());
    await elearningDb.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      const rows = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "RevisionQuestion"`; assert.equal(Number(rows[0].count), 0);
      const sessions = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "RevisionSession"`; assert.equal(Number(sessions[0].count), 0);
    });
    await assert.rejects(elearningDb.$transaction(async tx => { await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`); await tx.$executeRaw`INSERT INTO "RevisionSession" (id,"studentId","requestKey","requestHash",mode,"updatedAt") VALUES (${randomUUID()},${f.studentId},${randomUUID()},'test','RANDOM',now())`; }));
  } finally {
    await elearningDb.$executeRawUnsafe(`REVOKE ALL ON "RevisionQuestion", "RevisionSession" FROM "${role}"`);
    await elearningDb.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM "${role}"`);
    await elearningDb.$executeRawUnsafe(`DROP ROLE "${role}"`);
  }
});
it("preserves completed exact webhook replay after provenance changes while stopping new eligibility", async () => {
  const { f, event, result } = await workspaceFixture(), raw = Buffer.from(JSON.stringify(event.payload));
  await elearningDb.revisionWebhookIdempotency.update({ where: { idempotencyKey: `teach_${event.event.id}` }, data: { bodyHash: createHash("sha256").update(raw).digest("hex"), requestBody: raw } });
  await elearningDb.courseMaterial.update({ where: { id: f.material.id }, data: { storagePath: randomUUID() } });
  globalThis.fetch = async () => { throw Error("Completed replay cannot call providers"); };
  const response = await webhook.POST(signed(raw.toString())); assert.equal(response.status, 200); assert.deepEqual(await response.json(), result);
  const access = await import("@/services/e-learning/revision-questions/eligibility"); await assert.rejects(access.eligibleBankQuestion(f.studentId, result.results[0].question_id), /eligible/);
});
it("does not reuse a suspended canonical question or reset its existing card on a new callback", async () => {
  const { f, result } = await workspaceFixture();
  await elearningDb.revisionQuestionGovernance.update({ where: { questionId: result.results[0].question_id }, data: { publicationStatus: "SUSPENDED" } });
  const response = await processBatch((await eventFor(f)).payload);
  assert.equal(response.results[0].outcome, "rejected_invalid"); assert.equal(response.results[0].student_card_id, null);
  assert.equal(await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }), 1);
});
it("prepares complete bounded Stuart reference data without raw answers or internal identifiers", async () => {
  const { revisionContextExcerpt } = await import("@/services/e-learning/revision-questions/learning-context");
  const text = revisionContextExcerpt({ studentId: "PRIVATE_STUDENT", concepts: Array.from({ length: 30 }, () => ({ concept: "A".repeat(2000), conceptId: "PRIVATE_CONCEPT", answer: "PRIVATE_ANSWER", reviews: 4, independentCorrect: 3, incorrect: 1, difficultRecall: 1, retrievalEvidence: "consistent_retrieval" })) });
  assert.ok(text.length <= 900); assert.equal(JSON.parse(text).concepts.length, 3); assert.ok(!text.includes("PRIVATE_")); assert.equal(JSON.parse(text).retentionIsNotMastery, true);
  const escaped = revisionContextExcerpt({ concepts: Array.from({ length: 30 }, () => ({ concept: "\u0000".repeat(2000), reviews: 1 })) }); assert.ok(escaped.length <= 900); assert.ok(JSON.parse(escaped));
});
