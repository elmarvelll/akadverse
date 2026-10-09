// src/app/e-learning/student/study-zone/[courseId]/page.tsx
//
// One course's study workspace (week tabs · document viewer · Stewart). Authorization: the course must be in THIS
// student's APPROVED registration for the current session/semester — otherwise the page doesn't exist for them.

import { notFound } from "next/navigation";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getStudyWorkspace } from "@/services/e-learning/student/study-zone";
import StudyWorkspace from "../_components/StudyWorkspace";
import BackToStudyZone from "../_components/BackToStudyZone";

export default async function StudyWorkspacePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);
  const ctx = await getCurrentAcademicContext();
  if (!ctx?.session || !ctx.semester) notFound();

  const data = await getStudyWorkspace(session.user.id, ctx, courseId);
  if (!data) notFound();
  const { course, weeks } = data;

  if (weeks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackToStudyZone />
          <h1 className="min-w-0 truncate text-base font-semibold text-gray-900">
            <span className="font-bold text-blue-800">{course.code}</span> — {course.title}
          </h1>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">This course has no study materials yet.</p>
          <p className="mt-1 text-sm text-gray-800">Materials will appear here once lecturers are assigned and upload them.</p>
        </div>
      </div>
    );
  }

  return <StudyWorkspace course={course} weeks={weeks} />;
}
