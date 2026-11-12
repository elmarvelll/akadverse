// HOD — View Course Structures: everything DAPU has submitted for this department, with each
// structure's programme, session, semester and the level(s) it covers. Filter by programme
// and level. Department scope is enforced in the service, not here.

import Link from "next/link";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { listCurriculaForHod } from "@/services/e-learning/hod/curriculum-review";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_HOD: { label: "Pending your review", cls: "bg-amber-100 text-amber-900" },
  RETURNED: { label: "Returned to DAPU", cls: "bg-red-100 text-red-900" },
  PUBLISHED: { label: "Approved · published to students", cls: "bg-green-200 text-green-950" },
};
const select = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900";

export default async function ViewCourseStructuresPage({ searchParams }: { searchParams: Promise<{ programme?: string; level?: string }> }) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  const q = await searchParams;
  const level = Number(q.level);
  const { structures, programmes, levels } = await listCurriculaForHod(hod, {
    programmeId: q.programme || undefined,
    level: Number.isInteger(level) && level > 0 ? level : undefined,
  });
  const filtered = !!(q.programme || q.level);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">View Course Structures</h1>
        <p className="text-sm text-gray-800 mt-1">Course structures submitted to your department by DAPU. Open one to review, assign Level Advisors, and approve or return it.</p>
      </div>

      <form method="get" className="rounded-2xl border border-gray-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <label className="block text-xs font-semibold text-gray-800 space-y-1">Programme
          <select name="programme" defaultValue={q.programme ?? ""} className={select}>
            <option value="">All programmes</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-800 space-y-1">Level
          <select name="level" defaultValue={q.level ?? ""} className={select}>
            <option value="">All levels</option>
            {levels.map((l) => <option key={l} value={l}>{l} Level</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black">Apply filters</button>
          {filtered && <Link href="/e-learning/hod/curriculum" className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-semibold text-gray-900 hover:bg-gray-50">Clear</Link>}
        </div>
      </form>

      {structures.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">
          {filtered ? "No course structures match these filters." : "No course structures have been submitted for your department yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {structures.map((c) => {
            const st = STATUS[c.status] ?? { label: c.status, cls: "bg-gray-200 text-gray-900" };
            return (
              <li key={c.id}>
                <Link href={`/e-learning/hod/curriculum/${c.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 hover:border-blue-400">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-gray-900">{c.programme.name} ({c.programme.code})</p>
                      <p className="text-sm text-gray-900">Session <strong>{c.academicSession.name}</strong> · Semester <strong>{c.semester.name}</strong></p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.byLevel.map((lv) => (
                      <span key={lv.level} className={`rounded-md border px-2.5 py-1 text-xs font-bold ${lv.level === level ? "bg-blue-100 text-blue-900 border-blue-400" : "bg-gray-100 text-gray-900 border-gray-400"}`}>
                        {lv.level} Level · {lv.courses} course{lv.courses === 1 ? "" : "s"} · {lv.units} units
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900">Total: {c.totalCourses} courses · {c.totalUnits} credit units</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
