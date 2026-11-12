// src/app/e-learning/faculty/level-adviser/approvals/page.tsx
//
// Level Adviser review. For each registration waiting on this adviser (their assigned Programme +
// Level, current session), the student's context, summary counts/units, and a course-by-course
// comparison of the FULL applicable curriculum against what the student submitted. Approve /
// Reject per student, or Approve All. Decisions are only possible while the DAPU-controlled
// registration period is ACTIVE — enforced on the server; the buttons here just reflect it.

import { requireElearningRole, requireLevelAdviserProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getReviewQueue } from "@/services/e-learning/level-adviser/registrations";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import ConfirmSubmitButton from "../../_components/ConfirmSubmitButton";
import { approveAllAction, approveRegistrationAction, rejectRegistrationAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const PHASE_NOTE: Record<string, string> = {
  UPCOMING: "Course registration hasn't opened yet — registrations can't be reviewed until it does.",
  ENDED: "Course registration is closed — registrations can no longer be approved or rejected.",
  NOT_CONFIGURED: "Course registration is not currently available.",
};

export default async function LevelAdviserApprovalsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireElearningRole(["faculty"]);
  const adviser = await requireLevelAdviserProfile(session);
  const q = await searchParams;
  const review = await getReviewQueue(adviser, await getCurrentAcademicContext());

  if (review.state === "NO_CONTEXT") return <p className="text-sm text-gray-800">No current academic session and semester are set yet.</p>;
  if (review.state === "NO_SCOPE") return <p className="text-sm text-gray-800">You have no Level Advisor assignment for the current session.</p>;

  const { context, period, rule, registrations } = review;
  const canDecide = period.phase === "ACTIVE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Level Advisor Approvals</h1>
        <p className="text-sm text-gray-900 mt-1">{context.programme} · <strong>{context.level} Level</strong> · {context.department}</p>
        <p className="text-sm text-gray-800">{context.session} · {context.semester}{rule ? ` · Credit units ${rule.min}–${rule.max}` : ""}</p>
      </div>

      {q.ok && <div role="status" className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">{q.ok}</div>}
      {q.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>}
      {!canDecide && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{PHASE_NOTE[period.phase]}</div>}

      {registrations.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">Nothing waiting on you right now.</div>
      ) : (
        <>
          <form action={approveAllAction} className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">{registrations.length} registration{registrations.length === 1 ? "" : "s"} waiting for your review</p>
            <ConfirmSubmitButton
              disabled={!canDecide}
              message={`Approve all ${registrations.length} pending registration${registrations.length === 1 ? "" : "s"} for ${context.level} Level and send them to the HOD?`}
              className="px-5 py-2.5 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-40"
            >
              Approve All
            </ConfirmSubmitButton>
          </form>

          <div className="space-y-5">
            {registrations.map((r) => (
              <article key={r.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <header className="p-4 sm:p-5 border-b border-gray-200 space-y-0.5">
                  <h2 className="text-base font-bold text-gray-900">{r.studentName}</h2>
                  <p className="text-sm text-gray-900">Matric no: <strong>{r.matricNumber ?? "—"}</strong> · {context.department}</p>
                  <p className="text-sm text-gray-900">{context.programme} · <strong>{r.level} Level</strong> · {context.session} · {context.semester}</p>
                </header>

                <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                  {[
                    ["Applicable courses", r.summary.applicableCourses],
                    ["Submitted", r.summary.submittedCourses],
                    ["Not selected", r.summary.notSelectedCourses],
                    ["Required (core) units", r.summary.requiredCoreUnits],
                    ["Curriculum units", r.summary.curriculumUnits],
                    ["Submitted units", r.summary.submittedUnits],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs font-semibold text-gray-800">{label}</p>
                    </div>
                  ))}
                </div>
                {r.summary.missingCore.length > 0 && (
                  <p className="mx-4 sm:mx-5 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <strong>Core (required) courses not selected:</strong> {r.summary.missingCore.join(", ")}
                  </p>
                )}

                <div className="px-4 sm:px-5 pb-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px] rounded-xl border border-gray-200">
                    <thead className="bg-gray-50 text-gray-800 text-xs uppercase tracking-wide">
                      <tr><th className="text-left font-semibold px-3 py-2">Course</th><th className="text-left font-semibold px-3 py-2">Title</th><th className="text-left font-semibold px-3 py-2">Credit units</th><th className="text-left font-semibold px-3 py-2">Type</th><th className="text-left font-semibold px-3 py-2">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {r.rows.map((row) => (
                        <tr key={row.courseId} className={row.status === "Not Selected" ? "bg-gray-50" : ""}>
                          <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{row.code}</td>
                          <td className="px-3 py-2 text-gray-900">{row.title}</td>
                          <td className="px-3 py-2"><CourseMeta units={row.creditUnits} /></td>
                          <td className="px-3 py-2">{row.courseType ? <CourseMeta type={row.courseType} /> : <span className="text-gray-800">—</span>}</td>
                          <td className="px-3 py-2"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${row.status === "Not Selected" ? "bg-gray-100 text-gray-900 border-gray-400" : "bg-green-100 text-green-900 border-green-300"}`}>{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <footer className="px-4 sm:px-5 pb-5 flex flex-col sm:flex-row gap-2">
                  <form action={approveRegistrationAction}>
                    <input type="hidden" name="registrationId" value={r.id} />
                    <SubmitButton disabled={!canDecide} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-40">Approve</SubmitButton>
                  </form>
                  <form action={rejectRegistrationAction} className="flex flex-1 gap-2">
                    <input type="hidden" name="registrationId" value={r.id} />
                    <input name="note" placeholder="Reason (optional)" disabled={!canDecide} className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900" />
                    <SubmitButton disabled={!canDecide} className="px-4 py-2 rounded-lg border border-red-700 text-red-800 text-sm font-semibold hover:bg-red-50 disabled:opacity-40">Reject</SubmitButton>
                  </form>
                </footer>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
