// src/app/e-learning/dapu/timetable/review/page.tsx
//
// DAPU — Review timetable (AGENTS.md §28): create new entries and see
// what's still unapproved. Nothing else in this system currently creates
// TimetableEntry rows (the seed script aside) — DAPU is the practical
// owner of entering the raw schedule before approving it.

import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { listPendingTimetableEntries } from "@/services/e-learning/dapu/timetable";
import { listCourses } from "@/services/e-learning/dapu/course-structure";
import { createTimetableEntryAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export default async function TimetableReviewPage() {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const [pending, courses] = await Promise.all([
    listPendingTimetableEntries(academicContext.session.id, academicContext.semester.id),
    listCourses(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Review Timetable</h1>

      <form action={createTimetableEntryAction} className="rounded-2xl border border-gray-100 bg-white p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select name="courseId" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2">
          <option value="">Course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
        <select name="dayOfWeek" className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d[0] + d.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <input name="startTime" type="time" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input name="endTime" type="time" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input name="venue" placeholder="Venue" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <SubmitButton className="sm:col-span-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
          Add Entry
        </SubmitButton>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Awaiting Approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing pending.</p>
        ) : (
          <ul className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100">
            {pending.map((entry) => (
              <li key={entry.id} className="px-5 py-3 text-sm text-gray-700">
                {entry.dayOfWeek} {entry.startTime}–{entry.endTime} · {entry.course.code} · {entry.venue}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
