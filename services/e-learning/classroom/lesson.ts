import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict } from "@/lib/service-error";
import { requireTeacher, requireLiveStudentClassroom } from "./access";
import { loadOffering } from "@/services/e-learning/shared/course-materials/offering-access";
import { weeksInSemester } from "@/lib/course-materials/config";

export interface ClassroomLesson { topic: string; week: number; documentId: string | null; version: number }
export function lessonView(c: { lessonTopic: string | null; lessonWeekNumber: number | null; lessonDocumentId: string | null; lessonVersion: number }): ClassroomLesson | null {
  return c.lessonTopic && c.lessonWeekNumber ? { topic: c.lessonTopic, week: c.lessonWeekNumber, documentId: c.lessonDocumentId, version: c.lessonVersion } : null;
}
export async function lessonOptions(userId: string, sessionId: string) {
  const c = await requireTeacher({ id: userId, role: "faculty" }, sessionId);
  const offering = await loadOffering(c.courseOfferingId);
  const semester = offering.curriculumCourse.curriculum.semester;
  const materials = await elearningDb.courseMaterial.findMany({ where: { courseOfferingId: c.courseOfferingId }, select: { id: true, title: true, startWeek: true, endWeek: true }, orderBy: { title: "asc" } });
  return { lesson: lessonView(c), totalWeeks: Math.min(366, Math.max(weeksInSemester(semester.startDate, semester.endDate), ...materials.map(m => m.endWeek))), materials };
}
export async function setLesson(userId: string, sessionId: string, input: { topic: unknown; week: unknown; documentId?: unknown; version: unknown }) {
  const options = await lessonOptions(userId, sessionId);
  if (typeof input.topic !== "string" || !input.topic.trim() || input.topic.trim().length > 200) throw badRequest("Enter a lesson topic of up to 200 characters.");
  if (!Number.isInteger(input.week) || Number(input.week) < 1 || Number(input.week) > options.totalWeeks) throw badRequest("Choose a week in this course.");
  const documentId = input.documentId === "" || input.documentId === null || input.documentId === undefined ? null : input.documentId;
  if (documentId !== null && (typeof documentId !== "string" || !options.materials.some(m => m.id === documentId && m.startWeek <= Number(input.week) && m.endWeek >= Number(input.week)))) throw badRequest("Choose a material belonging to this course and week.");
  if (!Number.isInteger(input.version)) throw badRequest("Reload the lesson before saving.");
  const changed = await elearningDb.classroomSession.updateMany({ where: { id: sessionId, status: "LIVE", lessonVersion: Number(input.version) }, data: { lessonTopic: input.topic.trim(), lessonWeekNumber: Number(input.week), lessonDocumentId: documentId as string | null, lessonVersion: { increment: 1 } } });
  if (!changed.count) throw conflict("This lesson changed or the class ended. Reload before saving.");
}
export async function studentLesson(userId: string, sessionId: string) {
  const classroom = await requireLiveStudentClassroom(userId, sessionId);
  const lesson = lessonView(classroom);
  const offering = await loadOffering(classroom.courseOfferingId);
  const materials = lesson ? await elearningDb.courseMaterial.findMany({ where: { courseOfferingId: classroom.courseOfferingId, startWeek: { lte: lesson.week }, endWeek: { gte: lesson.week } }, select: { id: true, title: true } }) : [];
  return { classroom, lesson, offering, materials };
}
