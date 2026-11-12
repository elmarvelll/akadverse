// DAPU — Add Course: create reusable university operational courses (electives, department
// courses, anything not in CCMAS). This only creates the Course record; it is never added
// to a course structure from here — do that from Course Structure → Select Elective Course.

import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getAcademicTree } from "@/services/e-learning/dapu/ccmas-reference";
import { listCourses } from "@/services/e-learning/dapu/course-structure";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { addCourseAction } from "./actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900";

export default async function AddCoursePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const q = await searchParams;
  const [tree, courses] = await Promise.all([getAcademicTree(), listCourses()]);
  const departments = tree.flatMap((c) => c.departments.map((d) => ({ id: d.id, name: d.name, college: c.code })));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Course</h1>
        <p className="text-sm text-gray-700 mt-1">Create a reusable university course. It isn&apos;t added to any course structure until you select it on Course Structure.</p>
      </div>
      {q.ok && <div role="status" className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">{q.ok}</div>}
      {q.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>}

      <form action={addCourseAction} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <label className="text-xs font-semibold text-gray-800 lg:col-span-1">Course code<input name="code" required className={`${input} mt-1`} placeholder="Course code" /></label>
        <label className="text-xs font-semibold text-gray-800 lg:col-span-2">Course title<input name="title" required className={`${input} mt-1`} placeholder="Course title" /></label>
        <label className="text-xs font-semibold text-gray-800">Credit units<input name="creditUnits" type="number" min={1} max={30} required className={`${input} mt-1`} placeholder="Units" /></label>
        <label className="text-xs font-semibold text-gray-800 lg:col-span-2">Department (optional)
          <select name="departmentId" className={`${input} mt-1`} defaultValue=""><option value="">Not tied to a department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.college})</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 sm:col-span-2 lg:col-span-6">Description (optional)<textarea name="description" rows={2} className={`${input} mt-1`} placeholder="Short description" /></label>
        <div className="sm:col-span-2 lg:col-span-6"><SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">Create course</SubmitButton></div>
      </form>

      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <h2 className="px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200">Existing courses ({courses.length})</h2>
        {courses.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-800">No courses have been created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 text-gray-800 text-xs uppercase tracking-wide">
                <tr><th className="text-left font-semibold px-4 py-2.5">Code</th><th className="text-left font-semibold px-4 py-2.5">Title</th><th className="text-left font-semibold px-4 py-2.5">Units</th><th className="text-left font-semibold px-4 py-2.5">Department</th><th className="text-left font-semibold px-4 py-2.5">In structures</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{c.code}</td>
                    <td className="px-4 py-2.5 text-gray-900">{c.title}</td>
                    <td className="px-4 py-2.5"><CourseMeta units={c.creditUnits} /></td>
                    <td className="px-4 py-2.5 text-gray-900">{c.department?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-900">{c._count.curriculumCourses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
