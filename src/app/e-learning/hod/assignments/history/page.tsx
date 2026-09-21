// src/app/e-learning/hod/assignments/history/page.tsx
//
// Assignment History — every lecturer assignment (CourseOfferingLecturer) ever made in
// this department, across sessions/semesters, most recent first. Never
// overwritten (AGENTS.md §40), so this is a real historical record, not
// just the current state.

import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getAssignmentHistory } from "@/services/e-learning/hod/assignments";

export default async function AssignmentHistoryPage() {
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);

  const history = await getAssignmentHistory(hod.departmentId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Assignment History</h1>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No lecturer assignments recorded yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Course</th>
                <th className="text-left font-medium px-4 py-3">Programme · Level</th>
                <th className="text-left font-medium px-4 py-3">Lecturer</th>
                <th className="text-left font-medium px-4 py-3">Role</th>
                <th className="text-left font-medium px-4 py-3">Session</th>
                <th className="text-left font-medium px-4 py-3">Semester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.course.code}</td>
                  <td className="px-4 py-3 text-gray-900">{a.programme.code} · {a.level}L</td>
                  <td className="px-4 py-3 text-gray-900">{a.facultyName}</td>
                  <td className="px-4 py-3 text-gray-900">{a.role === "COORDINATOR" ? "Coordinator" : "Lecturer"}</td>
                  <td className="px-4 py-3 text-gray-700">{a.academicSession.name}</td>
                  <td className="px-4 py-3 text-gray-700">{a.semester.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
