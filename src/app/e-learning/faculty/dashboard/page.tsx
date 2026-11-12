// src/app/e-learning/faculty/dashboard/page.tsx
//
// Faculty dashboard (AGENTS.md §16/§17): current session/semester, Level
// Adviser responsibility if any, assigned course count, and the approved
// timetable — all from the database, nothing hard-coded (AGENTS.md §12's
// rule applied here too).

import Link from "next/link";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { elearningDb } from "@/lib/db/elearning";
import { getAssignedCourses } from "@/services/e-learning/faculty/assigned-courses";
import { getFacultyTimetable } from "@/services/e-learning/faculty/timetable";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
};

export default async function FacultyDashboardPage() {
  const session = await requireElearningRole(["faculty"]);
  const [academicContext, profile] = await Promise.all([
    getCurrentAcademicContext(),
    elearningDb.facultyProfile.findUnique({ where: { userId: session.user.id }, include: { department: true } }),
  ]);

  const [courses, timetable] = await Promise.all([
    getAssignedCourses(session.user.id, academicContext),
    getFacultyTimetable(session.user.id, academicContext),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.firstName}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {academicContext?.session?.name ?? "No current academic session set"}
          {academicContext?.semester ? ` · ${academicContext.semester.name}` : ""}
        </p>
      </div>

      {profile?.isLevelAdviser && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          You are the Level Adviser for {profile.levelAdviserOf} Level, {profile.department.name}. See the Level
          Adviser section in the sidebar.
        </div>
      )}

      {!profile && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          No faculty profile is set up for this account yet.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/e-learning/faculty/my-subjects" className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-blue-200 transition">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Assigned Courses</p>
          <p className="text-lg font-semibold text-gray-900">{courses.length}</p>
        </Link>
        <Link href="/e-learning/faculty/results" className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-blue-200 transition">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Results Record</p>
          <p className="text-lg font-semibold text-gray-900">Enter / review →</p>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Timetable</h2>
        {timetable.length === 0 ? (
          <p className="text-sm text-gray-500">No approved timetable entries for your assigned courses yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {timetable.map((entry) => (
              <li key={entry.id} className="py-2.5 flex flex-wrap items-center justify-between text-sm gap-2">
                <span className="text-gray-800">
                  <span className="font-medium">{DAY_LABELS[entry.dayOfWeek]}</span> {entry.startTime}–{entry.endTime} ·{" "}
                  {entry.course.code} · {entry.course.department?.name ?? "Shared"}
                </span>
                <span className="text-gray-500">{entry.venue}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
