// src/app/e-learning/dapu/timetable/send-to-hods/page.tsx
//
// DAPU — "Send timetable to HODs" (AGENTS.md §28). Same simplification as
// course structure's send-to-hod page: an approved entry is immediately
// visible to the relevant faculty (services/e-learning/faculty/timetable.ts
// only reads isApproved:true rows), so there's no separate distribution
// step to model — this page is the confirmation view of what's already
// out.

import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { listApprovedTimetableEntries } from "@/services/e-learning/dapu/timetable";

export default async function SendTimetableToHodsPage() {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const approved = await listApprovedTimetableEntries(academicContext.session.id, academicContext.semester.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Send to HODs</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every approved entry below is already visible to its department&apos;s faculty — approval is what makes it
          available, so there&apos;s nothing further to send.
        </p>
      </div>

      {approved.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No approved timetable entries yet.
        </div>
      ) : (
        <ul className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100">
          {approved.map((entry) => (
            <li key={entry.id} className="px-5 py-3 text-sm text-gray-700">
              {entry.course.department?.name ?? "Shared"} · {entry.course.code} · {entry.dayOfWeek} {entry.startTime}–{entry.endTime} ·{" "}
              {entry.venue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
