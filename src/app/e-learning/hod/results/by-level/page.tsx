// src/app/e-learning/hod/results/by-level/page.tsx
//
// HOD — Results by Level (AGENTS.md §24): a course × student matrix with
// each student's semester GPA, for one level in the HOD's department.

import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getResultsByLevel } from "@/services/e-learning/hod/results";

const LEVELS = [100, 200, 300, 400, 500];

export default async function ResultsByLevelPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const { level: levelParam } = await searchParams;
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);
  const academicContext = await getCurrentAcademicContext();
  const level = Number(levelParam ?? "300");

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const { courses, rows } = await getResultsByLevel(hod.departmentId, level, academicContext.session.id, academicContext.semester.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Results by Level</h1>
        <p className="text-gray-500 text-sm mt-1">
          {academicContext.session.name} · {academicContext.semester.name}
        </p>
      </div>

      <form className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Level</label>
        <select name="level" defaultValue={level} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l} Level
            </option>
          ))}
        </select>
        <button type="submit" className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium">
          Show
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No results recorded for {level} Level yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Student</th>
                {courses.map((c) => (
                  <th key={c.id} className="text-left font-medium px-3 py-3">
                    {c.code}
                  </th>
                ))}
                <th className="text-left font-medium px-4 py-3">GPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.studentUserId}>
                  <td className="px-4 py-2.5 text-gray-900 font-medium">
                    {row.name}
                    <div className="text-xs text-gray-400 font-normal">{row.matricNumber ?? "—"}</div>
                  </td>
                  {courses.map((c) => {
                    const result = row.scoresByCourseId.get(c.id);
                    return (
                      <td key={c.id} className="px-3 py-2.5 text-gray-700">
                        {result?.totalScore ?? "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{row.gpa?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
