// src/app/e-learning/student/course-control/registration/page.tsx
//
// Course Registration. Available -> Selected -> "Register Courses". The course list is the
// student's PUBLISHED curriculum (programme + level + session + semester); what the student may
// do depends on the ONE DAPU-controlled registration period:
//   UPCOMING (view only + countdown) · ACTIVE (select / remove / register) · ENDED (view only)
//   · NOT_CONFIGURED (unavailable).
// Selection lives in the browser only (see RegistrationWorkspace); this page never writes.
// Every write is re-checked on the server against the server clock.

import Link from "next/link";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getRegistrationView } from "@/services/e-learning/student/registration";
import RegistrationPeriod from "../../_components/RegistrationPeriod";
import RegistrationWorkspace from "../../_components/RegistrationWorkspace";

const STATUS_LABEL: Record<string, string> = {
  PENDING_LEVEL_ADVISOR: "Pending Level Advisor approval",
  PENDING_HOD: "Pending HOD approval",
  APPROVED: "Approved — registered",
  REJECTED: "Rejected",
};

export default async function CourseRegistrationPage() {
  const session = await requireElearningRole(["student"]);
  const profile = await requireStudentProfile(session);
  const academicContext = await getCurrentAcademicContext();
  const view = await getRegistrationView(profile, academicContext);

  if (view.state === "NO_CONTEXT") {
    return <p className="text-sm text-gray-800">Your academic information is not available yet.</p>;
  }

  const { period, registration, courses, registered, units } = view;
  const status = registration?.status ?? null;
  const inProgress = !!status && status !== "REJECTED";
  const canSelect = period.phase === "ACTIVE" && !inProgress;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Course Registration</h1>
        <p className="text-gray-800 text-sm mt-1">{academicContext!.session!.name} · {academicContext!.semester!.name}</p>
      </div>

      <RegistrationPeriod phase={period.phase} startAt={period.startAt?.toISOString() ?? null} endAt={period.endAt?.toISOString() ?? null} />

      {inProgress && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          You have registered for this semester — <strong>{STATUS_LABEL[status!] ?? status}</strong>.{" "}
          <Link href="/e-learning/student/course-control/registration-status" className="font-semibold underline">View Registration Status →</Link>
        </div>
      )}
      {status === "REJECTED" && (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <strong>Your registration was rejected.</strong>{registration?.decisionNote ? ` “${registration.decisionNote}”` : ""}
          {period.phase === "ACTIVE" ? " Adjust your selection below and register again." : " Registration is not open, so it can't be re-submitted right now."}
        </div>
      )}

      {view.state === "NO_CURRICULUM" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">Course structure is not available yet.</div>
      ) : (
        <RegistrationWorkspace
          // Re-mount on a new registration state so a fresh selection is never mixed with stale state.
          key={`${registration?.id ?? "none"}-${status ?? "none"}-${registration?.submittedAt?.toISOString() ?? ""}`}
          courses={courses}
          registered={inProgress ? registered.map((r) => ({ id: r.courseId, code: r.code, title: r.title, creditUnits: r.creditUnits, courseType: r.courseType })) : []}
          level={profile.level}
          canSelect={canSelect}
          unitsMin={units.min}
          unitsMax={units.max}
          statusLabel={status ? STATUS_LABEL[status] ?? status : null}
          initialSelectedIds={status === "REJECTED" ? registered.map((r) => r.courseId) : []}
        />
      )}
    </div>
  );
}
