// src/app/e-learning/dapu/dashboard/page.tsx
//
// DAPU dashboard (AGENTS.md §25): the academic calendar itself (AGENTS.md
// §31) lives here — creating sessions/semesters and marking one of each
// current, since DAPU is who's meant to set it and every other role's
// dashboard depends on it. Course structure/timeframe/timetable have their
// own sidebar sections.

import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { listSessions } from "@/services/e-learning/dapu/academic-calendar";
import { createSessionAction, setCurrentSessionAction, createSemesterAction, setCurrentSemesterAction } from "./actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export default async function DapuDashboardPage() {
  const session = await requireElearningRole(["dapu"]);
  const [academicContext, sessions] = await Promise.all([getCurrentAcademicContext(), listSessions()]);
  const currentSession = sessions.find((s) => s.isCurrent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.firstName}</h1>
        <p className="text-gray-500 text-sm mt-1">Academic-wide administration.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">Current Academic Session</p>
        <p className="text-lg font-semibold text-gray-900">
          {academicContext?.session?.name ?? "None set"}
          {academicContext?.semester ? ` · ${academicContext.semester.name}` : ""}
        </p>
        {!academicContext && (
          <p className="text-sm text-amber-700 mt-2">
            No session is marked current yet — every other role&apos;s dashboard depends on this being set.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Academic Sessions</h2>

        {sessions.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <li key={s.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-gray-800">
                  {s.name} {s.isCurrent && <span className="text-xs text-green-700 font-medium ml-1">(current)</span>}
                </span>
                {!s.isCurrent && (
                  <form action={setCurrentSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <SubmitButton className="text-xs font-medium text-blue-600 hover:underline">
                      Make current
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={createSessionAction} className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input name="name" placeholder="YYYY/YYYY" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" />
          </div>
          <SubmitButton className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
            Add Session
          </SubmitButton>
        </form>
      </div>

      {currentSession && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Semesters — {currentSession.name}</h2>

          {currentSession.semesters.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {currentSession.semesters.map((sem) => (
                <li key={sem.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-gray-800">
                    {sem.name}{" "}
                    {sem.isCurrent && <span className="text-xs text-green-700 font-medium ml-1">(current)</span>}
                  </span>
                  {!sem.isCurrent && (
                    <form action={setCurrentSemesterAction}>
                      <input type="hidden" name="semesterId" value={sem.id} />
                      <SubmitButton className="text-xs font-medium text-blue-600 hover:underline">
                        Make current
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form action={createSemesterAction} className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-100">
            <input type="hidden" name="academicSessionId" value={currentSession.id} />
            <input type="text" name="name" required placeholder="Name (e.g. Alpha)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" name="sequence" required min={1} placeholder="Order" className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="date" name="startDate" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="date" name="endDate" required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <SubmitButton className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
              Add Semester
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
