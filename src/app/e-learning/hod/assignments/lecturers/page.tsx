// src/app/e-learning/hod/assignments/lecturers/page.tsx
//
// HOD — Assign Lecturers. The courses of APPROVED (published) course structures in this HOD's
// department, filterable by academic session, semester, programme and level. Per course: the
// coordinator, any number of lecturers, and controls to add/remove them. Everything is saved to
// the database (CourseOffering -> CourseOfferingLecturer); scope is enforced in the service.

import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { listAssignableCourses } from "@/services/e-learning/hod/course-offerings";
import { assignLecturerAction, removeLecturerAction, setCoordinatorAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const control = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 min-w-0";

export default async function AssignLecturersPage({ searchParams }: { searchParams: Promise<{ session?: string; semester?: string; programme?: string; level?: string; ok?: string; error?: string }> }) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  const q = await searchParams;
  const level = Number(q.level);
  const d = await listAssignableCourses(hod, { sessionId: q.session, semesterId: q.semester, programmeId: q.programme || undefined, level: Number.isInteger(level) && level > 0 ? level : undefined });
  const filters = (
    <>
      <input type="hidden" name="f_session" value={d.session?.id ?? ""} />
      <input type="hidden" name="f_semester" value={d.semester?.id ?? ""} />
      <input type="hidden" name="f_programme" value={q.programme ?? ""} />
      <input type="hidden" name="f_level" value={q.level ?? ""} />
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assign Lecturers</h1>
        <p className="text-sm text-gray-800 mt-1">Courses from approved course structures. Each course can have several lecturers and one coordinator (who is also a lecturer).</p>
      </div>
      {q.ok && <div role="status" className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">{q.ok}</div>}
      {q.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>}

      <form method="get" className="rounded-2xl border border-gray-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Academic Session
          <select name="session" defaultValue={d.session?.id ?? ""} className={`${control} w-full`}>{d.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (current)" : ""}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Semester
          <select name="semester" defaultValue={d.semester?.id ?? ""} className={`${control} w-full`}><option value="">All semesters</option>{(d.session?.semesters ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Programme
          <select name="programme" defaultValue={q.programme ?? ""} className={`${control} w-full`}><option value="">All programmes</option>{d.programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Level
          <select name="level" defaultValue={q.level ?? ""} className={`${control} w-full`}><option value="">All levels</option>{d.levels.map((l) => <option key={l} value={l}>{l} Level</option>)}</select>
        </label>
        <button className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black">Apply filters</button>
      </form>

      {d.faculty.length === 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">No faculty profiles exist in your department yet, so no one can be assigned.</div>}

      {d.courses.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">No approved courses match these filters. Only courses from a published course structure appear here.</div>
      ) : (
        <ul className="space-y-4">
          {d.courses.map((c) => {
            const coordinator = c.lecturers.find((l) => l.role === "COORDINATOR");
            return (
              <li key={c.curriculumCourseId} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" data-course={c.code}>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-800">{c.code}</p>
                <h2 className="text-base font-bold text-gray-900">{c.title}</h2>
                <div className="mt-2"><CourseMeta level={c.level} units={c.creditUnits} type={c.courseType} /></div>
                <p className="mt-2 text-sm text-gray-900">{c.programme} · {c.semester} · {c.session}</p>

                <p className="mt-3 text-sm text-gray-900">Course Coordinator: <strong>{coordinator ? coordinator.name : "Not assigned"}</strong></p>
                <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {c.lecturers.length === 0 ? <li className="px-3 py-2 text-sm text-gray-800">No lecturers assigned yet.</li> : c.lecturers.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-gray-900"><strong>{l.name}</strong>{l.role === "COORDINATOR" && <span className="ml-2 rounded-md border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">Coordinator</span>}</span>
                      <span className="flex items-center gap-3">
                        {l.role !== "COORDINATOR" && (
                          <form action={setCoordinatorAction}>{filters}<input type="hidden" name="curriculumCourseId" value={c.curriculumCourseId} /><input type="hidden" name="facultyUserId" value={l.facultyUserId} /><SubmitButton className="text-xs font-semibold text-blue-800 underline">Make coordinator</SubmitButton></form>
                        )}
                        <form action={removeLecturerAction}>{filters}<input type="hidden" name="lecturerId" value={l.id} /><SubmitButton className="text-xs font-semibold text-red-800 underline">Remove</SubmitButton></form>
                      </span>
                    </li>
                  ))}
                </ul>

                <form action={assignLecturerAction} className="mt-3 flex flex-col sm:flex-row gap-2">
                  {filters}<input type="hidden" name="curriculumCourseId" value={c.curriculumCourseId} />
                  <select name="facultyUserId" required defaultValue="" className={`${control} flex-1`}>
                    <option value="" disabled>Select faculty…</option>
                    {d.faculty.filter((f) => !c.lecturers.some((l) => l.facultyUserId === f.userId)).map((f) => <option key={f.userId} value={f.userId}>{f.name}</option>)}
                  </select>
                  <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">+ Assign Lecturer</SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
