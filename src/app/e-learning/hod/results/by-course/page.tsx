// src/app/e-learning/hod/results/by-course/page.tsx
//
// HOD — Results by Course (AGENTS.md §24): every student's result for one
// department course, current session/semester.

import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getResultsByCourse } from "@/services/e-learning/hod/results";
import { getDepartmentCourses } from "@/services/e-learning/hod/assignments";

export default async function ResultsByCoursePage({ searchParams }: { searchParams: Promise<{ courseId?: string }> }) {
  const { courseId } = await searchParams;
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const courses = await getDepartmentCourses(hod.departmentId);
  const selectedCourseId = courseId ?? courses[0]?.id;
  const results = selectedCourseId
    ? await getResultsByCourse(selectedCourseId, academicContext.session.id, academicContext.semester.id)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Results by Course</h1>

      <form className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Course</label>
        <select name="courseId" defaultValue={selectedCourseId} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
        <button type="submit" className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium">
          Show
        </button>
      </form>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No results recorded for this course yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Student</th>
                <th className="text-left font-medium px-4 py-3">Total</th>
                <th className="text-left font-medium px-4 py-3">Grade</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{r.studentName}</p>
                    <p className="text-xs text-gray-500">{r.matricNumber ?? "—"}</p>
                  </td>
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
  );
}
