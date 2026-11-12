// src/app/e-learning/student/academic-records/results/page.tsx
//
// Results by academic session and semester (AGENTS.md §14). Only
// PUBLISHED results are ever shown to the student — see
// services/e-learning/student/results.ts's header comment.

import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getAllResultsGrouped } from "@/services/e-learning/student/results";

export default async function ResultsPage() {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);

  const groups = await getAllResultsGrouped(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Results</h1>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No published results yet.
        </div>
      ) : (
        groups.map((group) => (
          <div key={`${group.academicSession}-${group.semester}`} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                {group.academicSession} · {group.semester}
              </p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Course</th>
                  <th className="text-left font-medium px-4 py-2.5">CA</th>
                  <th className="text-left font-medium px-4 py-2.5">Exam</th>
                  <th className="text-left font-medium px-4 py-2.5">Total</th>
                  <th className="text-left font-medium px-4 py-2.5">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.results.map((result) => (
                  <tr key={result.id}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{result.course.code}</td>
                    <td className="px-4 py-2.5 text-gray-700">{result.fullCA ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700">{result.exam ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700">{result.totalScore ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700">{result.grade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
