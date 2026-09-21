// src/app/e-learning/student/my-learning/page.tsx
//
// My Learning — the student's ACTUAL approved/registered courses (an APPROVED registration's items) as
// cards. Not the curriculum: courses that were only available, selected, pending or rejected never appear.

import Link from "next/link";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getRegisteredCourses } from "@/services/e-learning/student/registered-courses";

export default async function MyLearningPage() {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <EmptyState message="Your academic information is not available yet." />;
  }
  const courses = await getRegisteredCourses(session.user.id, academicContext);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Learning</h1>
        <p className="text-gray-800 text-sm mt-1">{academicContext.session.name} · {academicContext.semester.name} · {courses.length} course{courses.length === 1 ? "" : "s"}</p>
      </div>
      {courses.length === 0 ? (
        <EmptyState message="You don't have any registered courses yet.">
          <Link href="/e-learning/student/course-control/registration" className="text-blue-800 text-sm font-semibold underline">Go to Course Registration →</Link>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/e-learning/student/my-learning/${course.id}`} data-testid="course-card" className="block h-full rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-400 hover:shadow-sm transition">
                <p className="text-sm font-bold uppercase tracking-wide text-blue-800">{course.code}</p>
                <h2 className="mt-1 text-base font-bold text-gray-900">{course.title}</h2>
                <div className="mt-3"><CourseMeta level={course.level} units={course.creditUnits} type={course.courseType} /></div>
                <p className="mt-3 text-sm text-gray-900">{course.semesterName} · {course.sessionName}</p>
                <p className="text-sm text-gray-900">Lecturer: {course.lecturerName ?? "Not yet assigned"}</p>
              </Link>
            </li>
          ))}
        </ul>
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
