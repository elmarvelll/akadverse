// src/app/e-learning/faculty/my-subjects/page.tsx
//
// My Subjects — every course offering this lecturer is assigned to this semester, with their role
// (Coordinator / Lecturer). Read from CourseOfferingLecturer (the HOD's assignments).

import Link from "next/link";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getMySubjects } from "@/services/e-learning/faculty/my-subjects";

export default async function MySubjectsPage() {
  const session = await requireElearningRole(["faculty"]);
  const ctx = await getCurrentAcademicContext();
  if (!ctx?.session || !ctx.semester) return <p className="text-sm text-gray-800">No current academic session/semester is set yet.</p>;
  const subjects = await getMySubjects(session.user.id, ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Subjects</h1>
        <p className="text-gray-800 text-sm mt-1">{ctx.session.name} · {ctx.semester.name}</p>
      </div>
      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">No subjects have been assigned to you this semester yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map((s) => (
            <Link key={s.offeringId} href={`/e-learning/faculty/my-subjects/${s.offeringId}`} className="rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-300 transition">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">{s.code}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.role === "COORDINATOR" ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-900"}`}>
                  {s.role === "COORDINATOR" ? "Coordinator" : "Lecturer"}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">{s.title}</p>
              <p className="mt-1 text-xs text-gray-700">{s.programmeName} · {s.level} Level · {s.creditUnits} CU</p>
              <p className="mt-2 text-xs text-gray-700">{s.materialCount} material{s.materialCount === 1 ? "" : "s"} uploaded</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
