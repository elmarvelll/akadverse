// src/app/e-learning/student/course-control/registration-status/page.tsx
//
// Registration Status + Registration History. Shows the current semester's registration and where
// it is in Student -> Level Advisor -> HOD -> Approved, plus every registration the student has
// ever made. Approved registrations are history: they stay here after registration closes, after
// the session changes and after the student moves up a level. Viewing never creates a record.

import Link from "next/link";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { findRegistration, getRegistrationHistory } from "@/services/e-learning/student/registration";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";

const STATUS_LABELS: Record<string, string> = {
  PENDING_LEVEL_ADVISOR: "Pending Level Advisor approval",
  PENDING_HOD: "Pending HOD approval",
  APPROVED: "Approved — registered",
  REJECTED: "Rejected",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING_LEVEL_ADVISOR: "bg-amber-100 text-amber-900",
  PENDING_HOD: "bg-amber-100 text-amber-900",
  APPROVED: "bg-green-100 text-green-900",
  REJECTED: "bg-red-100 text-red-900",
};
const STEPS = [
  { label: "Registered", reached: ["PENDING_LEVEL_ADVISOR", "PENDING_HOD", "APPROVED"] },
  { label: "Level Advisor", reached: ["PENDING_HOD", "APPROVED"] },
  { label: "HOD", reached: ["APPROVED"] },
];

export default async function RegistrationStatusPage() {
  const session = await requireElearningRole(["student"]);
  const profile = await requireStudentProfile(session);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-800">Your academic information is not available yet.</p>;
  }

  const [registration, history] = await Promise.all([findRegistration(session.user.id, academicContext), getRegistrationHistory(session.user.id)]);
  const past = history.filter((h) => h.id !== registration?.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Registration Status</h1>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">{academicContext.session.name} · {academicContext.semester.name}</p>
        {!registration ? (
          <>
            <p className="text-sm text-gray-900">You haven&apos;t registered any courses for this semester yet.</p>
            <Link href="/e-learning/student/course-control/registration" className="mt-2 inline-block text-sm font-semibold text-blue-800 underline">Go to Course Registration →</Link>
          </>
        ) : (
          <>
            <span className={`inline-block text-sm font-bold px-3 py-1.5 rounded-full ${STATUS_COLORS[registration.status] ?? "bg-gray-200 text-gray-900"}`}>{STATUS_LABELS[registration.status] ?? registration.status}</span>
            {registration.status !== "REJECTED" && (
              <ol className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                {STEPS.map((s) => (
                  <li key={s.label} className={`rounded-md border px-2.5 py-1 ${s.reached.includes(registration.status) ? "border-green-400 bg-green-100 text-green-900" : "border-gray-400 bg-gray-100 text-gray-900"}`}>
                    {s.reached.includes(registration.status) ? "✓ " : ""}{s.label}
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5 space-y-1 text-sm text-gray-900">
              <p>{registration.items.length} course{registration.items.length === 1 ? "" : "s"} on this registration.</p>
              {registration.submittedAt && <p>Registered {registration.submittedAt.toLocaleDateString()}.</p>}
              {registration.decidedAt && <p>Decided {registration.decidedAt.toLocaleDateString()}.</p>}
              {registration.decisionNote && <p className="italic">&ldquo;{registration.decisionNote}&rdquo;</p>}
            </div>
            {registration.items.length > 0 && (
              <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                {registration.items.map((i) => (
                  <li key={i.id} className="py-2 text-sm text-gray-900"><span className="font-semibold">{i.course.code}</span> — {i.course.title} <CourseMeta level={profile.level} units={i.course.creditUnits} /></li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Registration History</h2>
        {past.length === 0 ? (
          <p className="mt-2 text-sm text-gray-800">No earlier registrations.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {past.map((h) => (
              <li key={h.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{h.academicSession.name} · {h.semester.name}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[h.status] ?? "bg-gray-200 text-gray-900"}`}>{STATUS_LABELS[h.status] ?? h.status}</span>
                </div>
                <p className="mt-1 text-sm text-gray-900">{h.items.length} course{h.items.length === 1 ? "" : "s"}: {h.items.map((i) => i.course.code).join(", ") || "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
