// services/e-learning/classroom/polls.ts
//
// The "Do you understand?" check. The lecturer fires it; it pops up for every student in the
// class; each answers Yes/No once; the lecturer sees live counts (individual answers are never
// shown to other students).

import { elearningDb } from "@/lib/db/elearning";
import { badRequest } from "@/lib/service-error";
import { requireLiveStudentClassroom, requireTeacher } from "@/services/e-learning/classroom/access";

export async function startPoll(facultyUserId: string, sessionId: string) {
  const classroom = await requireTeacher({ id: facultyUserId, role: "faculty" }, sessionId);
  if (classroom.status !== "LIVE") throw badRequest("This class has ended.");
  const now = new Date();
  // One poll at a time: asking again replaces the previous round rather than stacking pop-ups.
  await elearningDb.$transaction([
    elearningDb.classroomPoll.updateMany({ where: { sessionId, status: "OPEN" }, data: { status: "CLOSED", closedAt: now } }),
    elearningDb.classroomPoll.create({ data: { sessionId } }),
  ]);
}

export async function closePoll(facultyUserId: string, sessionId: string, pollId: string) {
  await requireTeacher({ id: facultyUserId, role: "faculty" }, sessionId);
  await elearningDb.classroomPoll.updateMany({ where: { id: pollId, sessionId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
}

export async function respondToPoll(studentUserId: string, sessionId: string, pollId: string, answer: "YES" | "NO") {
  if (answer !== "YES" && answer !== "NO") throw badRequest("Pick Yes or No.");
  await requireLiveStudentClassroom(studentUserId, sessionId);
  const poll = await elearningDb.classroomPoll.findFirst({ where: { id: pollId, sessionId, status: "OPEN" } });
  if (!poll) throw badRequest("This poll has closed.");
  // Answering again just changes the answer; never a second vote.
  await elearningDb.classroomPollResponse.upsert({
    where: { pollId_studentUserId: { pollId, studentUserId } },
    create: { pollId, studentUserId, answer },
    update: { answer },
  });
}
