// src/app/e-learning/hod/approvals/course-registration/page.tsx
//
// HOD — Course Registration approvals (AGENTS.md §23): the last step,
// after Level Adviser approval (PENDING_HOD -> APPROVED/REJECTED).

import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getPendingRegistrationApprovals } from "@/services/e-learning/hod/registration-approvals";
import { approveRegistrationAction, rejectRegistrationAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export default async function HodCourseRegistrationApprovalsPage() {
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);
  const academicContext = await getCurrentAcademicContext();

  const pending = await getPendingRegistrationApprovals(hod, academicContext);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Course Registration Approvals</h1>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          Nothing waiting on your approval right now.
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((registration) => (
            <div key={registration.id} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{registration.studentName}</p>
                  <p className="text-xs text-gray-500">{registration.matricNumber ?? "—"}</p>
                </div>
                <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">Pending HOD Approval</span>
              </div>

              <ul className="text-sm text-gray-700 mb-4 space-y-0.5">
                {registration.items.map((item) => (
                  <li key={item.id}>
                    {item.course.code} — {item.course.title} ({item.course.creditUnits} CU)
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <form action={approveRegistrationAction}>
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <SubmitButton className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                    Approve
                  </SubmitButton>
                </form>
                <form action={rejectRegistrationAction} className="flex items-center gap-2">
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <input name="note" placeholder="Reason (optional)" className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm" />
                  <SubmitButton className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition">
                    Reject
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
