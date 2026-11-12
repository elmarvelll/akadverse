// HOD — review one submitted course structure, confirm Level Advisors, approve.

import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getCurriculumForHod } from "@/services/e-learning/hod/curriculum-review";
import { levelAdvisorChecklist } from "@/services/e-learning/shared/curriculum/level-advisor-checklist";
import { elearningDb } from "@/lib/db/elearning";
import { resolveIdentities, fullName } from "@/services/e-learning/shared/identity";
import { ServiceError } from "@/lib/service-error";
import { approveCurriculumAction, assignLevelAdvisorAction, returnCurriculumAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900";

export default async function HodCurriculumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  const { id } = await params;
  const q = await searchParams;
  let c;
  try {
    c = await getCurriculumForHod(hod, id);
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{e.message}</div>;
  }
  const checklist = await levelAdvisorChecklist(c.id);
  const faculty = await elearningDb.facultyProfile.findMany({ where: { departmentId: hod.departmentId }, select: { userId: true } });
  const names = await resolveIdentities([...faculty.map((f) => f.userId), ...checklist.flatMap((x) => (x.facultyUserId ? [x.facultyUserId] : []))]);
  const units = c.courses.reduce((n, x) => n + x.creditUnits, 0);
  const pending = c.status === "PENDING_HOD";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{c.programme.name} ({c.programme.code})</h1>
        <p className="text-sm text-gray-900">Session <strong>{c.academicSession.name}</strong> · Semester <strong>{c.semester.name}</strong> · {c.programme.department.name}</p>
        <p className="mt-1 text-sm font-bold text-gray-900">Total Courses: {c.courses.length} <span className="mx-2 text-gray-400">|</span> Total Units: {units} <span className="mx-2 text-gray-400">|</span> Status: {c.status.replaceAll("_", " ")}</p>
      </div>
      {pending && c.hodNote && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>Changed after publication:</strong> {c.hodNote}</div>
      )}
      {q.ok && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{q.ok}</div>}
      {q.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>}

      <section className="rounded-2xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr><th className="text-left font-semibold px-3 py-2.5">Code</th><th className="text-left font-semibold px-3 py-2.5">Title</th><th className="text-left font-semibold px-3 py-2.5" colSpan={3}>Level · Units · Type</th><th className="text-left font-semibold px-3 py-2.5">Source</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {c.courses.map((x) => (
              <tr key={x.id}>
                <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{x.course.code}</td><td className="px-3 py-2.5 text-gray-800">{x.course.title}</td>
                <td className="px-3 py-2.5" colSpan={3}><CourseMeta level={x.level} units={x.creditUnits} type={x.courseType} /></td>
                <td className="px-3 py-2.5"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${x.source === "CCMAS" ? "bg-indigo-100 text-indigo-900 border-indigo-300" : "bg-emerald-100 text-emerald-900 border-emerald-300"}`}>{x.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Level Advisors</h2>
        {checklist.map((row) => (
          <form key={row.level} action={assignLevelAdvisorAction} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input type="hidden" name="curriculumId" value={c.id} /><input type="hidden" name="level" value={row.level} />
            <span className="w-28 text-sm font-medium text-gray-800">{row.level} Level</span>
            <span className={`w-32 text-xs font-semibold ${row.assigned ? "text-green-700" : "text-red-700"}`}>{row.assigned ? "Assigned" : "Not Assigned"}</span>
            <select name="facultyUserId" required disabled={!pending} defaultValue={row.facultyUserId ?? ""} className={`${input} flex-1 min-w-0`}>
              <option value="">Select faculty…</option>
              {faculty.map((f) => <option key={f.userId} value={f.userId}>{fullName(names.get(f.userId))}</option>)}
            </select>
            <SubmitButton disabled={!pending} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50">{row.assigned ? "Change" : "Assign"}</SubmitButton>
          </form>
        ))}
        {faculty.length === 0 && <p className="text-sm text-gray-600">No faculty in your department yet.</p>}
      </section>

      {pending && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
          <form action={approveCurriculumAction}>
            <input type="hidden" name="curriculumId" value={c.id} />
            <SubmitButton className="px-5 py-2.5 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800">Approve &amp; publish to students</SubmitButton>
          </form>
          <form action={returnCurriculumAction} className="space-y-2">
            <input type="hidden" name="curriculumId" value={c.id} />
            <label className="block text-xs font-semibold text-gray-800">Return to DAPU — what needs to change?
              <textarea name="note" required rows={2} className={`${input} w-full mt-1`} placeholder="Reason for returning" />
            </label>
            <SubmitButton className="px-5 py-2.5 rounded-lg border border-red-700 text-red-800 text-sm font-semibold hover:bg-red-50">Reject / Return to DAPU</SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
