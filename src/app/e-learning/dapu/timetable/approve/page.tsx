// src/app/e-learning/dapu/timetable/approve/page.tsx
//
// DAPU — Approve timetable (AGENTS.md §28): flips `isApproved`, which is
// what makes an entry visible to faculty/students (AGENTS.md §17/§28).

import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { listPendingTimetableEntries } from "@/services/e-learning/dapu/timetable";
import { approveTimetableEntryAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export default async function TimetableApprovePage() {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const pending = await listPendingTimetableEntries(academicContext.session.id, academicContext.semester.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Approve Timetable</h1>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          Nothing waiting on approval.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">
          {pending.map((entry) => (
            <div key={entry.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-800">
                <span className="font-medium">{entry.course.code}</span> · {entry.dayOfWeek} {entry.startTime}–
                {entry.endTime} · {entry.venue} · {entry.course.department?.name ?? "Shared"}
              </p>
              <form action={approveTimetableEntryAction}>
                <input type="hidden" name="entryId" value={entry.id} />
                <SubmitButton className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                  Approve
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
