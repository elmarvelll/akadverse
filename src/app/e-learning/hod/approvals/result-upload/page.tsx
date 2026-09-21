// src/app/e-learning/hod/approvals/result-upload/page.tsx
//
// HOD — Result Upload approvals (AGENTS.md §23): each department course
// with SUBMITTED results, approved as a whole sheet (see
// services/e-learning/hod/result-approvals.ts's header comment on why this
// collapses the DRAFT/SUBMITTED/.../PUBLISHED workflow into one HOD gate).

import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getPendingResultApprovals } from "@/services/e-learning/hod/result-approvals";
import { approveResultUploadAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export default async function HodResultUploadApprovalsPage() {
  const session = await requireElearningRole(["hod"]);
  const hod = await requireHodProfile(session);
  const academicContext = await getCurrentAcademicContext();

  const pending = await getPendingResultApprovals(hod, academicContext);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Result Upload Approvals</h1>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No submitted results waiting on your approval right now.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">
          {pending.map(({ course, count }) => (
            <div key={course.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {course.code} — {course.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{count} student result{count === 1 ? "" : "s"} submitted</p>
              </div>
              <form action={approveResultUploadAction}>
                <input type="hidden" name="courseId" value={course.id} />
                <SubmitButton className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                  Approve & Publish
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
