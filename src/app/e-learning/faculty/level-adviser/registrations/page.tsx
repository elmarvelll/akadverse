// src/app/e-learning/faculty/level-adviser/registrations/page.tsx
//
// Level Adviser — Course Registrations (AGENTS.md §20): every registration
// in this adviser's department+level scope, any status, read-only (the
// actionable subset lives on the Approvals page).

import { requireElearningRole, requireLevelAdviserProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getRegistrationsInScope } from "@/services/e-learning/level-adviser/registrations";

const STATUS_LABELS: Record<string, string> = {
  PENDING_LEVEL_ADVISOR: "Pending your review",
  PENDING_HOD: "Pending HOD Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default async function LevelAdviserRegistrationsPage() {
  const session = await requireElearningRole(["faculty"]);
  const adviser = await requireLevelAdviserProfile(session);
  const academicContext = await getCurrentAcademicContext();

  const registrations = await getRegistrationsInScope(adviser, academicContext);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Course Registrations</h1>
        <p className="text-gray-500 text-sm mt-1">{adviser.levelAdviserOf} Level</p>
      </div>

      {registrations.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No registrations submitted yet this semester.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Student</th>
                <th className="text-left font-medium px-4 py-3">Courses</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrations.map((registration) => (
                <tr key={registration.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{registration.studentName}</p>
                    <p className="text-xs text-gray-500">{registration.matricNumber ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{registration.items.map((i) => i.course.code).join(", ")}</td>
                  <td className="px-4 py-3 text-gray-700">{STATUS_LABELS[registration.status] ?? registration.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
