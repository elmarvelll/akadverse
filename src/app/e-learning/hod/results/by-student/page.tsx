// src/app/e-learning/hod/results/by-student/page.tsx
//
// HOD — Results by Student (AGENTS.md §24): search a department student by
// matric number, see their full result history across sessions/semesters.

import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { findStudentsByQuery, getResultsByStudent } from "@/services/e-learning/hod/results";

export default async function ResultsByStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; studentUserId?: string }>;
}) {
  const { q, studentUserId } = await searchParams;
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);

  const matches = q ? await findStudentsByQuery(hod.departmentId, q) : [];
  const results = studentUserId ? await getResultsByStudent(studentUserId) : [];
  const selectedStudent = matches.find((m) => m.userId === studentUserId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Results by Student</h1>

      <form className="flex items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by matric number…"
          className="flex-1 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium">
          Search
        </button>
      </form>

      {q && matches.length === 0 && <p className="text-sm text-gray-400">No matching students in your department.</p>}

      {matches.length > 0 && !studentUserId && (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">
          {matches.map((m) => (
            <a
              key={m.userId}
              href={`?q=${encodeURIComponent(q ?? "")}&studentUserId=${m.userId}`}
              className="block px-5 py-3 text-sm hover:bg-gray-50 transition"
            >
              <span className="font-medium text-gray-900">{m.name}</span>{" "}
              <span className="text-gray-500">{m.matricNumber}</span>
            </a>
          ))}
        </div>
      )}

      {studentUserId && (
        <div className="space-y-3">
          {selectedStudent && <p className="text-sm text-gray-600">{selectedStudent.name} — {selectedStudent.matricNumber}</p>}
          {results.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
              No results recorded for this student yet.
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Session</th>
                    <th className="text-left font-medium px-4 py-3">Course</th>
                    <th className="text-left font-medium px-4 py-3">Total</th>
                    <th className="text-left font-medium px-4 py-3">Grade</th>
                    <th className="text-left font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 text-gray-700">
                        {r.academicSession.name} · {r.semester.name}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.course.code}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.totalScore ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.grade ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
