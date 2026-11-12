// src/app/e-learning/faculty/classroom/page.tsx
//
// Classroom — the lecturer's subjects this semester, each with Start class (or Rejoin if one is already live).
// Starting is re-checked server-side against CourseOfferingLecturer; the offering id here is routing only.

import Link from "next/link";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { listTeacherClassrooms } from "@/services/e-learning/classroom/sessions";
import StartClassButton from "@/app/e-learning/_components/classroom/StartClassButton";

export default async function FacultyClassroomPage() {
  const session = await requireElearningRole(["faculty"]);
  const ctx = await getCurrentAcademicContext();
  if (!ctx?.session || !ctx.semester) return <p className="text-sm text-gray-800">No current academic session/semester is set yet.</p>;
  const subjects = await listTeacherClassrooms(session.user.id, ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classroom</h1>
        <p className="mt-1 text-sm text-gray-800">Teach a live class for one of your subjects. {ctx.session.name} · {ctx.semester.name}</p>
      </div>
      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">No subjects have been assigned to you this semester yet.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.offeringId} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">{s.code}</p>
                {s.liveSessionId && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Live now</span>}
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-900">{s.title}</p>
              <p className="mt-1 text-xs text-gray-700">{s.programmeName} · {s.level} Level</p>
              <div className="mt-4">
                {s.liveSessionId ? (
                  <Link href={`/e-learning/faculty/classroom/${s.liveSessionId}`} className="inline-block rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">Rejoin class</Link>
                ) : (
                  <StartClassButton offeringId={s.offeringId} hrefBase="/e-learning/faculty/classroom" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
