// Opt-in live embedding/judge smoke test. Application records are loopback-only disposable fixtures.
import "../tests/helpers/env";
import { readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { courseScenario } from "../tests/helpers/elearning-fixtures";
import { prisma } from "../src/lib/prisma";
import { elearningDb } from "../src/lib/db/elearning";
import { conceptKey } from "../services/e-learning/revision-questions/policy";
import { POST } from "../src/app/api/webhooks/tutor/questions/route";

async function main() {
  if (process.env.REVISION_LIVE_PROVIDER_TEST !== "true") throw new Error("OPT_IN_REQUIRED");
  const local = dotenv.parse(readFileSync('.env.local'));
  if (!local.GEMINI_API_KEY || !local.AI_WEBHOOK_SECRET) throw new Error("PROVIDER_CONFIGURATION_REQUIRED");
  process.env.GEMINI_API_KEY = local.GEMINI_API_KEY; process.env.AI_WEBHOOK_SECRET = local.AI_WEBHOOK_SECRET; process.env.REVISION_QUESTIONS_ENABLED = "true";
  const f = await courseScenario(); let materialId: string | undefined, conceptId: string | undefined, eventId: string | undefined;
  try {
    await prisma.user.create({ data: { id: f.studentId, email: `${f.studentId}@example.test`, firstName: "Live", lastName: "Fixture", password: "unused" } });
    const material = await elearningDb.courseMaterial.create({ data: { courseOfferingId: f.offering.id, uploadedByFacultyUserId: f.lecturerId, title: "Synthetic quadratics", type: "NOTES", startWeek: 1, endWeek: 1, fileName: "synthetic.pdf", mimeType: "application/pdf", fileSize: 1000, storageBucket: "test", storagePath: randomUUID(), aiIngestStatus: "INGESTED" } }); materialId = material.id;
    const meta = { subject: "Algebra", curriculum: "Synthetic test", level: "SS2", title: "Quadratic discriminants", learningObjective: "Interpret real roots from the sign of a discriminant." };
    const concept = await elearningDb.revisionConcept.create({ data: { materialId, externalId: "synthetic-discriminant", ...meta, description: "A quadratic has no real roots when its discriminant is negative.", topic: "Quadratics", conceptKey: conceptKey(meta) } }); conceptId = concept.id;
    const attempt = await elearningDb.revisionPracticeAttempt.create({ data: { studentId: f.studentId, conceptId, requestKey: randomUUID(), requestHash: "synthetic-fixture", question: {}, evaluation: { concept_id: concept.externalId, answer_correct: true, evidence_strength: "independent", reasoning_quality: "strong", needs_review: false, recommended_next_step: "progress" }, evaluatedAt: new Date() } });
    const context = { subject: meta.subject, curriculum: meta.curriculum, level: meta.level, topic: "Quadratics", concept_id: concept.externalId, concept_title: concept.description, language: "en" };
    const event = await elearningDb.revisionTeachingEvent.create({ data: { studentId: f.studentId, conceptId, practiceAttemptId: attempt.id, context, taughtSummary: concept.description, generation: { create: {} } } }); eventId = event.id;
    const raw = JSON.stringify({ event_id: randomUUID(), teaching_event_id: eventId, student_id: f.studentId, occurred_at: new Date().toISOString(), context, taught_summary: event.taughtSummary, questions: [{ client_ref: "q1", type: "short_answer", stem: "What does a negative discriminant imply about the roots of a real quadratic?", correct_answer: "There are no real roots.", explanation: "The quadratic formula would require the square root of a negative number.", difficulty_estimate: 0.4, bloom_level: "understand", tags: ["discriminant"] }] });
    const request = () => new Request("https://fixture.test/api/webhooks/tutor/questions", { method: "POST", headers: { "content-type": "application/json", "x-akadverse-signature": createHmac("sha256", local.AI_WEBHOOK_SECRET).update(raw).digest("hex"), "x-akadverse-timestamp": new Date().toISOString(), "idempotency-key": `teach_${eventId}` }, body: raw });
    const start = Date.now(), response = await POST(request()), elapsedMs = Date.now() - start, text = await response.text(), result = JSON.parse(text);
    console.log(JSON.stringify({ liveEmbeddingAndJudge: response.status === 200, httpStatus: response.status, elapsedMs, failureCode: result.error?.code ?? null, outcomes: result.results?.map((r: { outcome: string }) => r.outcome) ?? [] }));
    if (response.status !== 200) process.exitCode = 1;
    else {
      const replayStart = Date.now(), replay = await POST(request());
      console.log(JSON.stringify({ replayStatus: replay.status, identicalResponse: await replay.text() === text, replayMs: Date.now() - replayStart, studentCards: await elearningDb.revisionStudentCard.count({ where: { studentId: f.studentId } }) }));
    }
  } finally {
    await elearningDb.revisionReviewLog.deleteMany({ where: { studentId: f.studentId } });
    await elearningDb.revisionStudentCard.deleteMany({ where: { studentId: f.studentId } });
    if (eventId) { await elearningDb.revisionQuestionProvenance.deleteMany({ where: { teachingEventId: eventId } }); await elearningDb.revisionGenerationJob.deleteMany({ where: { teachingEventId: eventId } }); await elearningDb.revisionWebhookIdempotency.deleteMany({ where: { teachingEventId: eventId } }); await elearningDb.revisionAdminAlert.deleteMany({ where: { correlationId: eventId } }); await elearningDb.revisionTeachingEvent.deleteMany({ where: { id: eventId } }); }
    await elearningDb.revisionPracticeAttempt.deleteMany({ where: { studentId: f.studentId } });
    if (conceptId) { await elearningDb.revisionQuestion.deleteMany({ where: { conceptId } }); await elearningDb.revisionConcept.delete({ where: { id: conceptId } }); }
    if (materialId) await elearningDb.courseMaterial.delete({ where: { id: materialId } });
    await prisma.user.deleteMany({ where: { id: f.studentId } });
  }
}
main().catch(() => { console.error("Live revision smoke check failed; no credentials or provider internals printed."); process.exitCode = 1; }).finally(async () => { await elearningDb.$disconnect(); await prisma.$disconnect(); });
