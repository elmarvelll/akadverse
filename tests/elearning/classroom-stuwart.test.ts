import "../helpers/env";
import { after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import { lessonOptions, setLesson, studentLesson } from "@/services/e-learning/classroom/lesson";
import { classroomConversation, classroomHistory, askClassroomStuwart } from "@/services/e-learning/classroom/stuwart";
import { ownedConversation, listConversations, deleteConversation } from "@/services/e-learning/student/stewart/conversations";
let scenario: Awaited<ReturnType<typeof courseScenario>>; let sessionId: string; let calls: Record<string, unknown>[];
const originalFetch = globalThis.fetch;
let fail = false; let onProvider: (() => Promise<void>) | null = null;
beforeEach(async () => {
  scenario = await courseScenario();
  sessionId = (await elearningDb.classroomSession.create({ data: { courseOfferingId: scenario.offering.id, hostUserId: scenario.lecturerId } })).id;
  calls = []; fail = false; onProvider = null;
  process.env.CONCEPT_EXPLAINER_API_URL = "https://concept.example.test"; process.env.AI_SERVICE_API_KEY = "test-key";
  globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(String(init?.body))); if (onProvider) await onProvider(); return Response.json(fail ? {} : { answer: "A clear lesson example.", sources: [{ title: "Foreign private material", document_id: "foreign" }] }, { status: fail ? 503 : 200 }); };
});
after(async () => { globalThis.fetch = originalFetch; await elearningDb.$disconnect(); });
const select = (version = 0, topic = "Newton's laws") => setLesson(scenario.lecturerId, sessionId, { topic, week: 3, version });
const ask = (requestId = randomUUID(), extra = {}) => askClassroomStuwart(scenario.studentId, sessionId, { question: "Explain with an example", requestId, lessonVersion: 1, ...extra });
it("requires an assigned lecturer, valid course week/material and optimistic lesson version", async () => {
  await assert.rejects(lessonOptions(scenario.otherLecturerId, sessionId), { status: 403 });
  await assert.rejects(setLesson(scenario.lecturerId, sessionId, { topic: "Test", week: 999, version: 0 }), { status: 400 });
  await assert.rejects(setLesson(scenario.lecturerId, sessionId, { topic: "Test", week: 3, documentId: "foreign", version: 0 }), { status: 400 });
  await select(); await assert.rejects(select(), { status: 409 });
  assert.equal((await studentLesson(scenario.studentId, sessionId)).lesson?.topic, "Newton's laws");
});
it("does not call the provider without a lesson and rejects unregistered students and ended classes", async () => {
  await assert.rejects(ask(), { status: 409 }); assert.equal(calls.length, 0);
  const outsider = await scenario.makeStudent(null);
  await assert.rejects(classroomHistory(outsider, sessionId), { status: 403 });
  await elearningDb.classroomSession.update({ where: { id: sessionId }, data: { status: "ENDED" } });
  await assert.rejects(classroomHistory(scenario.studentId, sessionId), { status: 403 });
});
it("derives provider scope from the classroom, restores private history and deduplicates retries", async () => {
  await select(); const requestId = randomUUID(); await ask(requestId, { courseOfferingId: "forged", week: 999 }); await ask(requestId);
  assert.equal(calls.length, 1); assert.equal(calls[0].course_offering_id, scenario.offering.id); assert.equal(calls[0].week, 3);
  assert.match(String(calls[0].question), /Newton's laws/); assert.match(String(calls[0].question), /cannot see or hear/);
  const history = await classroomHistory(scenario.studentId, sessionId); assert.equal(history.messages.length, 2);
  assert.deepEqual((history.messages[1].metadata as { sources: unknown[] }).sources, []);
  await ask(randomUUID(), { question: "Explain that again" }); assert.match(String(calls[1].question), /Previous conversation/);
  const other = await scenario.makeStudent("APPROVED"); assert.equal((await classroomHistory(other, sessionId)).messages.length, 0);
  const c = (await classroomConversation(scenario.studentId, sessionId)).conversation!;
  await assert.rejects(ownedConversation(scenario.studentId, c.id), { status: 404 });
  await assert.rejects(deleteConversation(scenario.studentId, c.id), { status: 404 });
  assert.equal((await listConversations(scenario.studentId, {})).conversations.length, 0);
});
it("isolates lesson versions and rejects stale submissions and in-flight lesson changes", async () => {
  await select(); const first = (await classroomConversation(scenario.studentId, sessionId)).conversation!;
  onProvider = async () => { await select(1, "Momentum"); };
  await assert.rejects(ask(), { status: 409 }); assert.equal((await classroomHistory(scenario.studentId, sessionId)).messages.length, 0);
  await assert.rejects(ask(), { status: 409 });
  const next = (await classroomConversation(scenario.studentId, sessionId)).conversation!; assert.notEqual(first.sessionId, next.sessionId);
  assert.equal(await elearningDb.chatMessage.count({ where: { conversationId: first.id, role: "ASSISTANT" } }), 0);
});
it("releases failed provider claims and retries without duplicate messages", async () => {
  await select(); const requestId = randomUUID(); fail = true; await assert.rejects(ask(requestId)); fail = false; await ask(requestId);
  assert.equal((await classroomHistory(scenario.studentId, sessionId)).messages.length, 2);
  await assert.rejects(ask(randomUUID(), { question: "x".repeat(2401) }), { status: 400 });
});

it("validates and grounds selected materials in the current course/week", async () => {
  const material = await elearningDb.courseMaterial.create({ data: { courseOfferingId: scenario.offering.id, uploadedByFacultyUserId: scenario.lecturerId, title: "Mechanics notes", type: "NOTES", startWeek: 3, endWeek: 3, fileName: "notes.pdf", mimeType: "application/pdf", fileSize: 10, storageBucket: "test", storagePath: randomUUID() } });
  await assert.rejects(setLesson(scenario.lecturerId, sessionId, { topic: "Mechanics", week: 2, documentId: material.id, version: 0 }), { status: 400 });
  await setLesson(scenario.lecturerId, sessionId, { topic: "Mechanics", week: 3, documentId: material.id, version: 0 });
  globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return Response.json({ answer: "Material-grounded explanation.", sources: [{ title: "Untrusted title", document_id: material.id }, { title: "Other course", document_id: "foreign" }] }); };
  await ask(); assert.match(String(calls[0].question), /Mechanics notes/);
  const history = await classroomHistory(scenario.studentId, sessionId);
  assert.equal(history.documentTitle, "Mechanics notes");
  assert.deepEqual((history.messages[1].metadata as { sources: unknown[] }).sources, [{ title: "Mechanics notes", document_id: material.id, source_type: "course_material" }]);
});
