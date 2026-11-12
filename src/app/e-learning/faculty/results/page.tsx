// src/app/e-learning/faculty/results/page.tsx
//
// Results Record (AGENTS.md §19) — pick which assigned course to enter
// results for.

import Link from "next/link";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getAssignedCourses } from "@/services/e-learning/faculty/assigned-courses";

export default async function FacultyResultsPage() {
  const session = await requireElearningRole(["faculty"]);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const courses = await getAssignedCourses(session.user.id, academicContext);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Results Record</h1>
        <p className="text-gray-500 text-sm mt-1">
          {academicContext.session.name} · {academicContext.semester.name}
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No courses assigned to you this semester yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/e-learning/faculty/results/${course.id}`}
              className="flex flex-wrap items-center justify-between px-5 py-4 hover:bg-gray-50 transition gap-2"
            >
              <span className="text-sm text-gray-800">
                <span className="font-medium">{course.code}</span> — {course.title}
              </span>
              <span className="text-xs text-blue-600 font-medium">Enter Results →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
