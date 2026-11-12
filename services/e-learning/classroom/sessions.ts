// services/e-learning/classroom/sessions.ts
//
// Starting/ending a live class and listing the classes a user can see.

import { elearningDb } from "@/lib/db/elearning";
import { requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";
import { getMySubjects } from "@/services/e-learning/faculty/my-subjects";
import { getRegisteredCourses } from "@/services/e-learning/student/registered-courses";
import { requireTeacher } from "@/services/e-learning/classroom/access";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

// A class left LIVE (lecturer closed the tab) shouldn't block the offering forever.
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export async function startClass(facultyUserId: string, courseOfferingId: string) {
  await requireLecturer(facultyUserId, courseOfferingId);

  await elearningDb.classroomSession.updateMany({
    where: { courseOfferingId, status: "LIVE", startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
    data: { status: "ENDED", endedAt: new Date() },
  });
  const live = await elearningDb.classroomSession.findFirst({ where: { courseOfferingId, status: "LIVE" } });
  if (live) {
    // Starting again while it's already running (double click, second tab, co-lecturer) just joins it.
    return live;
  }
  return elearningDb.classroomSession.create({ data: { courseOfferingId, hostUserId: facultyUserId } });
}

export async function endClass(facultyUserId: string, sessionId: string) {
  const classroom = await requireTeacher({ id: facultyUserId, role: "faculty" }, sessionId);
  if (classroom.status === "ENDED") return;
  const now = new Date();
  await elearningDb.$transaction([
    elearningDb.classroomSession.update({ where: { id: sessionId }, data: { status: "ENDED", endedAt: now } }),
    // Anything still open when the class ends is closed with it.
    elearningDb.classroomPoll.updateMany({ where: { sessionId, status: "OPEN" }, data: { status: "CLOSED", closedAt: now } }),
  ]);
  // Deliberately NOT deleting the LiveKit room here. Deleting it tears every connection down from the server side,
  // which livekit-client reports as "data channel closed unexpectedly" errors in every browser. Instead each client
  // leaves cleanly itself: the lecturer's page navigates away, students' next state poll sees live=false and unmounts
  // the room. The token route refuses ended classes, so nobody can rejoin, and LiveKit closes the empty room.
}

export async function listTeacherClassrooms(facultyUserId: string, ctx: CurrentAcademicContext | null) {
  const subjects = await getMySubjects(facultyUserId, ctx);
  const live = await elearningDb.classroomSession.findMany({
    where: { status: "LIVE", courseOfferingId: { in: subjects.map((s) => s.offeringId) } },
  });
  const liveByOffering = new Map(live.map((l) => [l.courseOfferingId, l]));
  return subjects.map((s) => ({ ...s, liveSessionId: liveByOffering.get(s.offeringId)?.id ?? null }));
}

export async function listStudentClassrooms(studentUserId: string, ctx: CurrentAcademicContext) {
  const courses = (await getRegisteredCourses(studentUserId, ctx)).filter((c) => c.offeringId);
  const live = await elearningDb.classroomSession.findMany({
    where: { status: "LIVE", courseOfferingId: { in: courses.map((c) => c.offeringId!) } },
  });
  const liveByOffering = new Map(live.map((l) => [l.courseOfferingId, l]));
  return courses.map((c) => ({ ...c, offeringId: c.offeringId!, liveSessionId: liveByOffering.get(c.offeringId!)?.id ?? null }));
}

