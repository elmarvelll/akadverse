import { elearningDb } from "@/lib/db/elearning";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getRegisteredCourses } from "@/services/e-learning/student/registered-courses";
import { addDays, localNow, validDate, type OfficialClass } from "@/features/productivity/schedule/domain";
import { localInstant } from "@/features/productivity/analytics/periods";
import { slotTouchesDates } from "@/features/productivity/schedule/timetable";
import { badRequest } from "@/lib/service-error";
import { OfficialTimetableError } from "./errors";
import { timed } from "./diagnostics";

async function loadTimetable(ownerId: string, includeLecturerNames = true) {
  try {
  const context = await timed("academic.context", () => getCurrentAcademicContext());
  const courses = context?.session && context.semester ? await timed("academic.registrations", () => getRegisteredCourses(ownerId, context, { includeLecturerNames })) : [];
  const sessionId = context?.session?.id, semesterId = context?.semester?.id;
  const entries = courses.length && sessionId && semesterId ? await timed("academic.timetable", () => elearningDb.timetableEntry.findMany({ where: {
    courseId: { in: courses.map(c => c.id) }, academicSessionId: sessionId, semesterId, isApproved: true,
  } })) : [];
  return { context, courses, entries };
  } catch (error) { throw new OfficialTimetableError(error); }
}
export interface AcademicRequestCache { source?: ReturnType<typeof loadTimetable>; conflictSource?: ReturnType<typeof loadTimetable> }

// Uses the host's APPROVED registration resolver and current academic context.
// User/programme/department scope is resolved server-side, never from request IDs.
export async function officialClasses(ownerId: string, date: string, timezone: string, cache: AcademicRequestCache = {}, options: { includeLecturerNames?: boolean } = {}): Promise<OfficialClass[]> {
  if (!validDate(date)) throw badRequest("Choose a valid timetable date.");
  const { context, courses, entries } = await (options.includeLecturerNames === false
    ? cache.conflictSource ||= loadTimetable(ownerId, false)
    : cache.source ||= loadTimetable(ownerId));
  if (!context?.session || !context.semester) return [];
  // The current host timetable has campus wall times but no timezone column.
  // Its Nigeria campus convention is Africa/Lagos; convert projected instants
  // to the user's zone without changing the timetable or registration records.
  const dates = [addDays(date, -1), date, addDays(date, 1)].filter(day => day >= context.semester!.startDate.toISOString().slice(0, 10) && day <= context.semester!.endDate.toISOString().slice(0, 10));
  if (!dates.length) return [];
  if (!courses.length) return [];
  const weekday = (day: string) => ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][new Date(day + "T12:00:00Z").getUTCDay()];
  return dates.flatMap(campusDate => entries.filter(entry => entry.dayOfWeek === weekday(campusDate)).flatMap(entry => {
    const course = courses.find(c => c.id === entry.courseId)!;
    const start = localInstant(campusDate, entry.startTime, "Africa/Lagos");
    const end = localInstant(entry.endTime < entry.startTime ? addDays(campusDate, 1) : campusDate, entry.endTime, "Africa/Lagos");
    if (start === undefined || end === undefined || end <= start) return [];
    const localStart = localNow(timezone, new Date(start)), localEnd = localNow(timezone, new Date(end));
    const slot = { date: localStart.date, start: localStart.time, end: localEnd.time, timezone };
    if (!slotTouchesDates(slot, [date])) return [];
    return [{ id: `official:${entry.id}:${campusDate}`, sourceId: `${entry.id}:${campusDate}`, registrationId: `${ownerId}:${context.session!.id}:${context.semester!.id}`,
      courseCode: course.code, courseName: course.title, lecturer: course.lecturerName || "Not assigned", venue: entry.venue,
      semester: context.semester!.name, classGroup: "Registered course", state: "scheduled" as const, registrationState: "registered" as const, slot }];
  }));
}
