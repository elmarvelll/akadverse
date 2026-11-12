// src/app/e-learning/student/study-zone/page.tsx
//
// Study Zone entry: a welcome, then the student's registered courses (an APPROVED registration's items for the
// current session/semester — the same courses as My Learning). Choosing one opens its study workspace.

import Link from "next/link";
import styles from "../../_components/student-portal.module.css";
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
    <div className={`space-y-6 ${styles.study}`} >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EEF4FF] text-[#185CFF] shadow-[0_2px_10px_rgba(24,92,255,0.08)]" aria-hidden>
          <Library size={24} />
        </span>
        <div>
          <h1 className="text-[28px] leading-tight tracking-tight font-bold text-[#0F172A]">Welcome to Study Zone</h1>
          <p className="mt-1 text-[14.5px] leading-relaxed text-[#475569]">What would you like to study? Pick a course to read its weekly materials <span className="inline-flex rounded-md border border-[#DBEAFE]/80 bg-gradient-to-r from-[#EEF4FF] via-[#F3E8FF]/80 to-[#EEF4FF] px-2 py-0.5"><span className="bg-gradient-to-r from-[#185CFF] via-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent font-semibold">with Stewart, your AI study assistant.</span></span></p>
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
          <h2 id="study-zone-courses" className="text-sm font-bold text-[#0F172A]">
            Your courses · {courses[0].sessionName} · {courses[0].semesterName}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <li key={course.id} style={{ animationDelay: `${index * 50}ms` }}>
                <Link
                  href={`/e-learning/student/study-zone/${course.id}`}
                  className={`${styles.studyCard} group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-400 hover:shadow-sm transition focus-visible:outline-2 focus-visible:outline-blue-600`}
                >
                  <p className="text-[13px] font-bold uppercase tracking-wide text-[#185CFF]">{course.code}</p>
                  <h3 className="mt-1.5 text-[17px] font-bold text-gray-900">{course.title}</h3>
                  <div className="mt-3"><CourseMeta level={course.level} units={course.creditUnits} type={course.courseType} /></div>
                  <p className="mt-4 text-[13.5px] text-[#1E293B]">Lecturer: {course.lecturerName ?? "Not yet assigned"}</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-[13.5px] font-bold text-[#185CFF]">
                    Start studying <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden />
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
