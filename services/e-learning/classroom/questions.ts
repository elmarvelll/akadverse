// services/e-learning/classroom/questions.ts
//
// The question queue. A student raises a hand and types a question (text only for the MVP);
// other students can "me too" it; the lecturer marks it answered or dismisses it.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, tooManyRequests } from "@/lib/service-error";
import { requireLiveStudentClassroom, requireTeacher } from "@/services/e-learning/classroom/access";

export const MAX_QUESTION_LENGTH = 300;
// Stops one student flooding the lecturer's queue; they can ask again once one is answered.
const MAX_OPEN_PER_STUDENT = 3;

export async function askQuestion(studentUserId: string, sessionId: string, rawBody: string) {
  const body = rawBody.trim();
  if (!body) throw badRequest("Type your question first.");
  if (body.length > MAX_QUESTION_LENGTH) throw badRequest(`Keep your question under ${MAX_QUESTION_LENGTH} characters.`);
  await requireLiveStudentClassroom(studentUserId, sessionId);

  const open = await elearningDb.classroomQuestion.count({ where: { sessionId, studentUserId, status: "OPEN" } });
  if (open >= MAX_OPEN_PER_STUDENT) throw tooManyRequests("You already have a few questions waiting. Let the lecturer answer those first.");
  await elearningDb.classroomQuestion.create({ data: { sessionId, studentUserId, body } });
}

// Toggles the student's "me too". Not on your own question (it already counts as yours).
export async function toggleVote(studentUserId: string, sessionId: string, questionId: string) {
  await requireLiveStudentClassroom(studentUserId, sessionId);
  const question = await elearningDb.classroomQuestion.findFirst({ where: { id: questionId, sessionId, status: "OPEN" } });
  if (!question) throw badRequest("That question is no longer open.");
  if (question.studentUserId === studentUserId) throw badRequest("You can't vote on your own question.");

  const key = { questionId_studentUserId: { questionId, studentUserId } };
  const existing = await elearningDb.classroomQuestionVote.findUnique({ where: key });
  if (existing) await elearningDb.classroomQuestionVote.delete({ where: key });
  else await elearningDb.classroomQuestionVote.create({ data: { questionId, studentUserId } });
}

export async function resolveQuestion(facultyUserId: string, sessionId: string, questionId: string, status: "ANSWERED" | "DISMISSED") {
  await requireTeacher({ id: facultyUserId, role: "faculty" }, sessionId);
  // The sessionId in the where is what ties the question to a class this lecturer actually teaches.
  await elearningDb.classroomQuestion.updateMany({ where: { id: questionId, sessionId, status: "OPEN" }, data: { status, resolvedAt: new Date() } });
}
