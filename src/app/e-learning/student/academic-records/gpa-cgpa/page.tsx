// src/app/e-learning/student/academic-records/gpa-cgpa/page.tsx
//
// GPA / CGPA (AGENTS.md §14) — computed from published Result rows via
// services/e-learning/shared/grading.ts, never hard-coded.

import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getGpaCgpaSummary } from "@/services/e-learning/student/results";

export default async function GpaCgpaPage() {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);

  const summary = await getGpaCgpaSummary(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">GPA / CGPA</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">
            {summary.currentSemesterName ?? "Latest Semester"} GPA
          </p>
          <p className="text-3xl font-bold text-gray-900">{summary.currentSemesterGpa?.toFixed(2) ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Cumulative GPA (CGPA)</p>
          <p className="text-3xl font-bold text-gray-900">{summary.cgpa?.toFixed(2) ?? "—"}</p>
        </div>
      </div>

      {summary.totalPublishedCourses === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          No published results yet — GPA/CGPA will appear here once results are published.
        </div>
      )}
    </div>
  );
}
