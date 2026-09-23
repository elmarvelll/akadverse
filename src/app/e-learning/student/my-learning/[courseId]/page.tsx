// src/app/e-learning/student/my-learning/[courseId]/page.tsx
//
// One registered course: Overview · Syllabus / Learning Outcomes (real CCMAS data only, each block shown
// only if it exists) · Weekly Course Content. Authorization: the course must be in THIS student's
// APPROVED registration for the current session/semester (getRegisteredCourses enforces it), and the
// materials come from that course's own offering — never from another offering or session.

import Link from "next/link";
import { notFound } from "next/navigation";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getRegisteredCourses } from "@/services/e-learning/student/registered-courses";
import { getOfferingDetail } from "@/services/e-learning/shared/offering-detail";
import { MATERIAL_LABELS, MATERIAL_TYPES, weekRangeLabel } from "@/lib/course-materials/config";
import WeekSlider, { type WeekData } from "../WeekSlider";

export default async function MyLearningCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);
  const ctx = await getCurrentAcademicContext();
  if (!ctx?.session || !ctx.semester) notFound();

  const course = (await getRegisteredCourses(session.user.id, ctx)).find((c) => c.id === courseId);
  if (!course) notFound(); // not registered (or not approved): the page doesn't exist for this student

  const d = course.offeringId ? await getOfferingDetail(course.offeringId) : null;
  const weeks: WeekData[] = d
    ? Array.from({ length: d.totalWeeks }, (_, i) => {
        const week = i + 1;
        const inWeek = d.materials.filter((m) => m.startWeek <= week && week <= m.endWeek);
        return {
          week,
          groups: MATERIAL_TYPES.map((type) => ({
            type,
            label: MATERIAL_LABELS[type].plural,
            icon: MATERIAL_LABELS[type].icon,
            items: inWeek.filter((m) => m.type === type).map((m) => ({ id: m.id, title: m.title, description: m.description, fileName: m.fileName, mimeType: m.mimeType, fileSize: m.fileSize, rangeLabel: weekRangeLabel(m.startWeek, m.endWeek) })),
          })).filter((g) => g.items.length > 0),
        };
      })
    : [];
  const ccmas = d?.ccmas;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/e-learning/student/my-learning" className="text-sm text-blue-800 underline">← My Learning</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{course.code} — {course.title}</h1>
        <div className="mt-2"><CourseMeta level={course.level} units={course.creditUnits} type={course.courseType} /></div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-gray-700">Programme</dt><dd className="font-medium text-gray-900">{d?.programme.name ?? "—"}</dd></div>
          <div><dt className="text-gray-700">Session · Semester</dt><dd className="font-medium text-gray-900">{course.sessionName} · {course.semesterName}</dd></div>
          <div><dt className="text-gray-700">Department</dt><dd className="font-medium text-gray-900">{course.departmentName}</dd></div>
        </dl>
        {course.description && <p className="text-sm text-gray-900">{course.description}</p>}
        <div>
          <p className="text-sm text-gray-700">Lecturers</p>
          {d && d.lecturers.length > 0 ? (
            <ul className="text-sm text-gray-900">{d.lecturers.map((l) => <li key={l.userId}>{l.name}{l.role === "COORDINATOR" ? " (Course Coordinator)" : ""}</li>)}</ul>
          ) : (
            <p className="text-sm text-gray-900">Not yet assigned.</p>
          )}
        </div>
      </section>

      {ccmas?.contents && (
        <section data-testid="syllabus" className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Syllabus</h2>
          <p className="text-sm text-gray-900 whitespace-pre-line">{ccmas.contents}</p>
          {ccmas.prerequisites && <p className="text-sm text-gray-900"><strong>Prerequisites:</strong> {ccmas.prerequisites}</p>}
          <p className="text-xs text-gray-700">Source: CCMAS, page {ccmas.sourcePage}</p>
        </section>
      )}
      {ccmas && ccmas.outcomes.length > 0 && (
        <section data-testid="outcomes" className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">{ccmas.contents ? "Learning Outcomes" : "What You Will Learn"}</h2>
          <ul className="list-disc pl-5 text-sm text-gray-900 space-y-1">{ccmas.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
          {!ccmas.contents && <p className="text-xs text-gray-700">Source: CCMAS, page {ccmas.sourcePage}</p>}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Weekly Course Content</h2>
        {d ? <WeekSlider weeks={weeks} /> : <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-800">Course content will appear here once lecturers are assigned and upload materials.</p>}
      </section>
    </div>
  );
}
