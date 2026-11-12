// src/app/e-learning/hod/dashboard/page.tsx
//
// HOD dashboard (AGENTS.md §21): department, current session/semester, and
// what's actually waiting on this HOD right now — pending registration and
// result-upload approvals — all from the database.

import Link from "next/link";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { elearningDb } from "@/lib/db/elearning";
import { getPendingRegistrationApprovals } from "@/services/e-learning/hod/registration-approvals";
import { getPendingResultApprovals } from "@/services/e-learning/hod/result-approvals";

export default async function HodDashboardPage() {
  const session = await requireElearningRole(["hod"]);
  const [academicContext, profile] = await Promise.all([
    getCurrentAcademicContext(),
    elearningDb.hodProfile.findUnique({ where: { userId: session.user.id }, include: { department: true } }),
  ]);

  const [pendingRegistrations, pendingResults] = profile
    ? await Promise.all([getPendingRegistrationApprovals(profile, academicContext), getPendingResultApprovals(profile, academicContext)])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.firstName}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile ? `Head of Department — ${profile.department.name}` : "No HOD profile set up for this account yet"}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Academic Session</p>
        <p className="text-lg font-semibold text-gray-900">
          {academicContext?.session?.name ?? "Not set"}
          {academicContext?.semester ? ` · ${academicContext.semester.name}` : ""}
        </p>
      </div>

      {profile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/e-learning/hod/approvals/course-registration" className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-blue-200 transition">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Pending Registration Approvals</p>
            <p className="text-lg font-semibold text-gray-900">{pendingRegistrations.length}</p>
          </Link>
          <Link href="/e-learning/hod/approvals/result-upload" className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-blue-200 transition">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Pending Result Approvals</p>
            <p className="text-lg font-semibold text-gray-900">{pendingResults.length} course{pendingResults.length === 1 ? "" : "s"}</p>
          </Link>
        </div>
      )}
    </div>
  );
}
