// src/app/e-learning/student/academic-records/academic-history/page.tsx
//
// Academic History (AGENTS.md §14) — one row per session/semester the
// student has published results for, with that semester's GPA and the
// running CGPA as of that point.

import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getAcademicHistory } from "@/services/e-learning/student/results";

export default async function AcademicHistoryPage() {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);

  const history = await getAcademicHistory(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Academic History</h1>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No academic history yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Session</th>
                <th className="text-left font-medium px-4 py-3">Semester</th>
                <th className="text-left font-medium px-4 py-3">Courses</th>
                <th className="text-left font-medium px-4 py-3">Semester GPA</th>
                <th className="text-left font-medium px-4 py-3">CGPA as of then</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((row) => (
                <tr key={`${row.academicSession}-${row.semester}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.academicSession}</td>
                  <td className="px-4 py-3 text-gray-700">{row.semester}</td>
                  <td className="px-4 py-3 text-gray-700">{row.courseCount}</td>
                  <td className="px-4 py-3 text-gray-700">{row.semesterGpa?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{row.cgpaAsOf?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
