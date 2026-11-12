// src/app/e-learning/student/classroom/page.tsx
//
// Classroom — the student's registered courses this semester; a course whose lecturer is live shows Join class.

import Link from "next/link";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { listStudentClassrooms } from "@/services/e-learning/classroom/sessions";

export default async function StudentClassroomPage() {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);
  const ctx = await getCurrentAcademicContext();
  if (!ctx?.session || !ctx.semester) return <p className="text-sm text-gray-800">Your academic information is not available yet.</p>;
  const courses = await listStudentClassrooms(session.user.id, ctx);
  // Live classes first, so the one you're probably here for is at the top.
  courses.sort((a, b) => Number(!!b.liveSessionId) - Number(!!a.liveSessionId) || a.code.localeCompare(b.code));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classroom</h1>
        <p className="mt-1 text-sm text-gray-800">Join your lecturers&apos; live classes. {ctx.session.name} · {ctx.semester.name}</p>
      </div>
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">
          You don&apos;t have any registered courses with a lecturer yet.
          <div className="mt-2"><Link href="/e-learning/student/course-control/registration" className="font-semibold text-blue-800 underline">Go to Course Registration →</Link></div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold uppercase tracking-wide text-blue-800">{c.code}</p>
                {c.liveSessionId && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Live now</span>}
              </div>
              <p className="mt-1 text-base font-bold text-gray-900">{c.title}</p>
              <p className="mt-1 text-sm text-gray-900">Lecturer: {c.lecturerName ?? "Not yet assigned"}</p>
              <div className="mt-4">
                {c.liveSessionId ? (
                  <Link href={`/e-learning/student/classroom/${c.liveSessionId}`} className="inline-block rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">Join class</Link>
                ) : (
                  <p className="text-sm text-gray-700">No class in progress</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
