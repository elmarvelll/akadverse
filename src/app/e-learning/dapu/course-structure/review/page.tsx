// src/app/e-learning/dapu/course-structure/review/page.tsx
//
// DAPU — Review Course: every saved course structure (Curriculum), with ALL of its
// courses, straight from the database. One card per Programme + Session + Semester,
// courses grouped by level. Publishing acts on the whole structure, never a course.

import Link from "next/link";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getAcademicTree } from "@/services/e-learning/dapu/ccmas-reference";
import { listSessions } from "@/services/e-learning/dapu/academic-calendar";
import { listStructuresForReview } from "@/services/e-learning/dapu/curriculum/list-structures-for-review";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import PublishPanel, { PublishOne } from "./PublishPanel";
import { publishStructuresAction } from "./actions";

type Params = { department?: string; programme?: string; session?: string; semester?: string; curriculum?: string; ok?: string; error?: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  SAVED: { label: "Saved", cls: "bg-blue-100 text-blue-900" },
  PENDING_HOD: { label: "Pending HOD", cls: "bg-amber-100 text-amber-900" },
  RETURNED: { label: "Returned by HOD", cls: "bg-red-100 text-red-900" },
  PUBLISHED: { label: "Published to students", cls: "bg-green-200 text-green-950" },
  VALIDATED: { label: "Validated", cls: "bg-gray-200 text-gray-900" },
};
const select = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 min-w-0";

// Continue Editing target: the exact saved structure (same programme, session, semester) at the given level.
function editHref(s: { programme: { department: { collegeId: string }; departmentId?: string }; programmeId: string; academicSessionId: string; semesterId: string; byLevel: { level: number }[] }, level?: number) {
  const lv = level ?? s.byLevel[0]?.level ?? 100;
  return `/e-learning/dapu/course-structure?college=${s.programme.department.collegeId}&department=${(s.programme as { departmentId: string }).departmentId}&programme=${s.programmeId}&level=${lv}&session=${s.academicSessionId}&semester=${s.semesterId}`;
}

export default async function ReviewSavedCoursesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const q = await searchParams;
  const [tree, sessions] = await Promise.all([getAcademicTree(), listSessions()]);
  const departments = tree.flatMap((c) => c.departments.map((d) => ({ ...d, college: c.code })));
  const programmes = departments.flatMap((d) => d.programmes.map((p) => ({ ...p, departmentId: d.id })));
  const structures = await listStructuresForReview({ departmentId: q.department || undefined, programmeId: q.programme || undefined, academicSessionId: q.session || undefined, semesterId: q.semester || undefined });
  const shown = q.curriculum ? structures.filter((s) => s.id === q.curriculum) : structures;
  const saved = structures.filter((s) => s.status === "SAVED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Saved Courses</h1>
        <p className="text-sm text-gray-700 mt-1">Every saved course structure, exactly as it will go to the HOD. Continue Editing to change one; Publish to HOD(s) sends it for approval.</p>
      </div>

      {q.ok && <div role="status" className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">{q.ok}</div>}
      {q.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>}

      <form method="get" className="rounded-2xl border border-gray-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Department
          <select name="department" defaultValue={q.department ?? ""} className={`${select} w-full`}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Programme
          <select name="programme" defaultValue={q.programme ?? ""} className={`${select} w-full`}><option value="">All programmes</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Session
          <select name="session" defaultValue={q.session ?? ""} className={`${select} w-full`}><option value="">All sessions</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Semester
          <select name="semester" defaultValue={q.semester ?? ""} className={`${select} w-full`}><option value="">All semesters</option>{sessions.flatMap((s) => s.semesters.map((m) => <option key={m.id} value={m.id}>{s.name} · {m.name}</option>))}</select>
        </label>
        <button className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black">Apply filters</button>
      </form>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Ready to publish ({saved.length})</h2>
        <PublishPanel
          action={publishStructuresAction}
          items={saved.map((s) => ({ id: s.id, label: `${s.programme.code} — ${s.academicSession.name} ${s.semester.name}`, detail: `${s.totalCourses} courses · ${s.totalUnits} units · ${s.programme.department.name}` }))}
        />
      </section>

      {q.curriculum && <p className="text-sm"><Link className="text-blue-800 underline font-medium" href="/e-learning/dapu/course-structure/review">Show all saved structures</Link></p>}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">No saved course structures yet. Select courses under Course Structure and press Save Courses.</div>
      ) : (
        shown.map((s) => {
          const st = STATUS[s.status] ?? { label: s.status, cls: "bg-gray-200 text-gray-900" };
          return (
            <article key={s.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <header className="p-4 sm:p-5 border-b border-gray-200 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{s.programme.department.college.name} · {s.programme.department.name}</p>
                  <h2 className="text-lg font-bold text-gray-900">{s.programme.name} ({s.programme.code})</h2>
                  <p className="text-sm text-gray-900">Session <strong>{s.academicSession.name}</strong> · Semester <strong>{s.semester.name}</strong> · Levels: <strong>{s.byLevel.map((l) => l.level).join(", ") || "—"}</strong></p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
              </header>

              {s.status === "RETURNED" && s.hodNote && <div className="mx-4 sm:mx-5 mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"><strong>Returned by the HOD:</strong> {s.hodNote}</div>}

              {s.byLevel.length === 0 ? (
                <p className="p-6 text-sm text-gray-800">No courses in this structure yet.</p>
              ) : (
                s.byLevel.map((lv) => (
                  <div key={lv.level} className="p-4 sm:p-5 pb-0">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-gray-900">{lv.level} Level <span className="font-semibold text-gray-800">· {lv.rows.length} course{lv.rows.length === 1 ? "" : "s"} · {lv.units} units</span></h3>
                      {(s.status === "SAVED" || s.status === "RETURNED" || s.status === "PUBLISHED") && <Link href={editHref(s, lv.level)} className="text-xs font-semibold text-blue-800 underline">Edit {lv.level} Level</Link>}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm min-w-[600px]">
                        <thead className="bg-gray-50 text-gray-800 text-xs uppercase tracking-wide">
                          <tr><th className="text-left font-semibold px-3 py-2">Course Code</th><th className="text-left font-semibold px-3 py-2">Course Title</th><th className="text-left font-semibold px-3 py-2">Units</th><th className="text-left font-semibold px-3 py-2">Type</th><th className="text-left font-semibold px-3 py-2">Source</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lv.rows.map((r) => (
                            <tr key={r.id}>
                              <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{r.course.code}</td>
                              <td className="px-3 py-2 text-gray-900">{r.course.title}</td>
                              <td className="px-3 py-2"><CourseMeta units={r.creditUnits} /></td>
                              <td className="px-3 py-2"><CourseMeta type={r.courseType} /></td>
                              <td className="px-3 py-2"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${r.source === "CCMAS" ? "bg-indigo-100 text-indigo-900 border-indigo-300" : "bg-emerald-100 text-emerald-900 border-emerald-300"}`}>{r.source}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}

              <footer className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-gray-900">Total Courses: {s.totalCourses} <span className="mx-2 text-gray-400">|</span> Total Credit Units: {s.totalUnits}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(s.status === "SAVED" || s.status === "RETURNED" || s.status === "PUBLISHED") && <Link href={editHref(s)} className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-semibold text-gray-900 hover:bg-gray-50">Continue Editing</Link>}
                  {s.status === "SAVED" && (
                    <PublishOne
                      action={publishStructuresAction}
                      item={{ id: s.id, programme: `${s.programme.name} (${s.programme.code})`, levels: s.byLevel.map((l) => l.level).join(", "), session: s.academicSession.name, semester: s.semester.name, courses: s.totalCourses, units: s.totalUnits, department: s.programme.department.name }}
                    />
                  )}
                  {s.status === "PENDING_HOD" && <span className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">Awaiting HOD Review</span>}
                  {s.status === "PUBLISHED" && <span className="rounded-lg bg-green-200 px-4 py-2 text-sm font-semibold text-green-950">Approved by HOD — published to students</span>}
                  {s.status === "PENDING_HOD" && s.hodNote && <span className="basis-full text-xs text-amber-900">{s.hodNote}</span>}
                </div>
              </footer>
            </article>
          );
        })
      )}
    </div>
  );
}
