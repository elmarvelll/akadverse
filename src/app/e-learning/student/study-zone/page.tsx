// src/app/e-learning/student/study-zone/page.tsx
//
// Study Zone entry: a welcome, then the student's registered courses (an APPROVED registration's items for the
// current session/semester — the same courses as My Learning). Choosing one opens its study workspace.

import Link from "next/link";
import { ArrowRight, Library } from "lucide-react";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getStudyCourses } from "@/services/e-learning/student/study-zone";

export default async function StudyZonePage() {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);
  const ctx = await getCurrentAcademicContext();
  const courses = ctx?.session && ctx.semester ? await getStudyCourses(session.user.id, ctx) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:flex" aria-hidden>
          <Library size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Study Zone</h1>
          <p className="mt-1 text-sm text-gray-800">What would you like to study? Pick a course to read its weekly materials with Stewart, your AI study assistant.</p>
        </div>
      </div>

      {courses === null ? (
        <EmptyState message="Your academic information is not available yet." />
      ) : courses.length === 0 ? (
        <EmptyState message="You don't have any registered courses yet. Once your course registration is approved, your courses will appear here.">
          <Link href="/e-learning/student/course-control/registration" className="text-blue-800 text-sm font-semibold underline">Go to Course Registration →</Link>
        </EmptyState>
      ) : (
        <section aria-labelledby="study-zone-courses" className="space-y-3">
          <h2 id="study-zone-courses" className="text-sm font-semibold text-gray-800">
            Your courses · {courses[0].sessionName} · {courses[0].semesterName}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/e-learning/student/study-zone/${course.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-400 hover:shadow-sm transition focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <p className="text-sm font-bold uppercase tracking-wide text-blue-800">{course.code}</p>
                  <h3 className="mt-1 text-base font-bold text-gray-900">{course.title}</h3>
                  <div className="mt-3"><CourseMeta level={course.level} units={course.creditUnits} type={course.courseType} /></div>
                  <p className="mt-3 text-sm text-gray-900">Lecturer: {course.lecturerName ?? "Not yet assigned"}</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-blue-700">
                    Start studying <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <p className="text-gray-800 text-sm mb-2">{message}</p>
      {children}
    </div>
  );
}
