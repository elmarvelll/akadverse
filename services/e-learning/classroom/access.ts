// services/e-learning/classroom/access.ts
//
// Who may do what in a live class. Two kinds of participant, both derived from the
// signed-in user's own records — never from an id the client sent:
//   - teacher: a lecturer/coordinator assigned to the class's CourseOffering (the same
//     rule as uploading materials). Only teachers present and run polls/questions.
//   - student: an APPROVED registration for the offering's course this session/semester
//     (the same rule as opening a course document).

import { elearningDb } from "@/lib/db/elearning";
import { forbidden, notFound } from "@/lib/service-error";
import { assertStudentRegistered } from "@/services/e-learning/shared/course-materials/resolve-download";
import { loadOffering, requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";

export type ClassroomParticipant = { id: string; role: string };
export type ClassroomRole = "teacher" | "student";

export async function loadClassroom(sessionId: string) {
  const classroom = await elearningDb.classroomSession.findUnique({ where: { id: sessionId } });
  if (!classroom) throw notFound("That class doesn't exist.");
  return classroom;
}

// Resolves the caller's role in this class or throws. Faculty must be assigned to the
// offering; students must be registered for it; every other role is refused.
export async function requireClassroomRole(user: ClassroomParticipant, sessionId: string) {
  const classroom = await loadClassroom(sessionId);
  if (user.role === "faculty") {
    await requireLecturer(user.id, classroom.courseOfferingId);
    return { classroom, role: "teacher" as const };
  }
  if (user.role === "student") {
    await assertStudentRegistered(user.id, await loadOffering(classroom.courseOfferingId));
    return { classroom, role: "student" as const };
  }
  throw forbidden("Classroom is only available to students and faculty.");
}

export async function requireTeacher(user: ClassroomParticipant, sessionId: string) {
  const res = await requireClassroomRole(user, sessionId);
  if (res.role !== "teacher") throw forbidden("Only the lecturer can do that.");
  return res.classroom;
}

// For actions students take: the class must exist, be one they belong to, and still be live.
export async function requireLiveStudentClassroom(studentUserId: string, sessionId: string) {
  const res = await requireClassroomRole({ id: studentUserId, role: "student" }, sessionId);
  if (res.classroom.status !== "LIVE") throw forbidden("This class has ended.");
  return res.classroom;
}
