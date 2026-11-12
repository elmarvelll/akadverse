// src/app/e-learning/student/dashboard/page.tsx
//
// Student dashboard (AGENTS.md §12): current session/semester/level,
// registered courses, registration status, and GPA/CGPA — all read from
// the database (Phase 1's academic calendar, Phase 2's registration/
// results modules), never hard-coded. Deadlines and announcements are
// still later-phase pieces (they need AcademicTimeFrame surfaced generally
// and an announcements model that doesn't exist yet) — flagged below
// rather than faked.

import Link from "next/link";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { elearningDb } from "@/lib/db/elearning";
import { findRegistration } from "@/services/e-learning/student/registration";
import { getRegisteredCourses } from "@/services/e-learning/student/registered-courses";
import { getGpaCgpaSummary } from "@/services/e-learning/student/results";

const STATUS_LABELS: Record<string, string> = {
  PENDING_LEVEL_ADVISOR: "Pending Level Advisor Approval",
  PENDING_HOD: "Pending HOD Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default async function StudentDashboardPage() {
  const session = await requireElearningRole(["student"]);
  const [academicContext, profile] = await Promise.all([
    getCurrentAcademicContext(),
    elearningDb.studentProfile.findUnique({
      where: { userId: session.user.id },
      include: { department: true, programme: true },
    }),
  ]);

  const [registration, registeredCourses, gpaSummary] = profile
    ? await Promise.all([
        findRegistration(session.user.id, academicContext),
        academicContext ? getRegisteredCourses(session.user.id, academicContext) : Promise.resolve([]),
        getGpaCgpaSummary(session.user.id),
      ])
    : [null, [], null];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.firstName}</h1>
        <p className="text-gray-500 text-sm mt-1">Your academic overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Academic Session" value={academicContext?.session?.name ?? "Not set"} />
        <SummaryCard
          label="Semester"
          value={academicContext?.semester ? academicContext.semester.name : "Not set"}
        />
        <SummaryCard label="Level" value={profile ? `${profile.level} Level` : "No profile yet"} />
      </div>

      {!profile && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          No student profile is set up for this account yet — department, program and level will show here once one
          exists.
        </div>
      )}

      {!academicContext && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          No academic session is marked current yet — DAPU sets this once the E-Learning academic calendar is
          configured.
        </div>
      )}

      {profile && academicContext && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Registration Status"
            value={registration ? (STATUS_LABELS[registration.status] ?? registration.status) : "Not registered yet"}
            href="/e-learning/student/course-control/registration-status"
          />
          <SummaryCard label="Registered Courses" value={String(registeredCourses.length)} href="/e-learning/student/my-learning" />
          <SummaryCard label="CGPA" value={gpaSummary?.cgpa?.toFixed(2) ?? "—"} href="/e-learning/student/academic-records/gpa-cgpa" />
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Deadlines & announcements</h2>
        <p className="text-sm text-gray-500">
          Academic deadlines are DAPU-controlled (AGENTS.md §27) and results/registration already check them — a
          dedicated deadlines/announcements widget here is still a later phase.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const card = (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 h-full">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:border-blue-200 rounded-2xl transition">
      {card}
    </Link>
  ) : (
    card
  );
}
