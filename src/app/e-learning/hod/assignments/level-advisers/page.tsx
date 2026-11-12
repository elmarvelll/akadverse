// src/app/e-learning/hod/assignments/level-advisers/page.tsx
//
// HOD — Level Advisors. One card per Department + Programme + Level + Academic Session, showing
// who the Level Advisor is (from the database) and whether one is assigned, with Assign / Change.
// Scope is enforced in the service: a HOD only ever gets their own department's programmes.

import Link from "next/link";
import { requireElearningRole, requireHodProfile } from "@/services/e-learning/shared/auth";
import { listAdvisorContexts } from "@/services/e-learning/hod/level-advisors";
import { assignLevelAdvisorAction } from "./actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const LEVELS = [100, 200, 300, 400, 500, 600];
const control = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 min-w-0";

export default async function LevelAdvisorsPage({ searchParams }: { searchParams: Promise<{ session?: string; programme?: string; level?: string; ok?: string; error?: string }> }) {
  const hod = await requireElearningRole(["hod"]).then(requireHodProfile);
  const q = await searchParams;
  const levelFilter = Number(q.level);
  const { department, session, sessions, programmes, faculty, contexts, levels, totalContexts } = await listAdvisorContexts(hod, q.session, {
    programmeId: q.programme || undefined,
    level: Number.isInteger(levelFilter) && levelFilter > 0 ? levelFilter : undefined,
  });
  const filtered = !!(q.programme || q.level);
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(d);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Level Advisors</h1>
        <p className="text-sm text-gray-800 mt-1">Assign a Level Advisor for each programme and level, per academic session. Faculty who also lecture can be Level Advisors.</p>
      </div>

      {q.ok && <div role="status" className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">{q.ok}</div>}
      {q.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>}

      <form method="get" className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Academic Session
          <select name="session" defaultValue={session?.id ?? ""} className={`${control} block`}>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (current)" : ""}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Programme
          <select name="programme" defaultValue={q.programme ?? ""} className={`${control} block`}>
            <option value="">All programmes</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-800 space-y-1 block">Level
          <select name="level" defaultValue={q.level ?? ""} className={`${control} block`}>
            <option value="">All levels</option>
            {levels.map((l) => <option key={l} value={l}>{l} Level</option>)}
          </select>
        </label>
        <button className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black">Apply filters</button>
        {filtered && <Link href={`/e-learning/hod/assignments/level-advisers?session=${session?.id ?? ""}`} className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-semibold text-gray-900 hover:bg-gray-50">Clear</Link>}
        <p className="text-sm text-gray-900 ml-auto">Department: <strong>{department.name}</strong>{session && contexts.length !== totalContexts ? <> · Showing {contexts.length} of {totalContexts}</> : null}</p>
      </form>

      {!session ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">No academic session exists yet.</div>
      ) : faculty.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">No faculty profiles in your department yet, so no one can be assigned.</div>
      ) : (
        <>
          {contexts.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-800">
              {filtered && totalContexts > 0
                ? "No programme-level matches these filters."
                : `No programme-level has a course structure, students or an advisor in ${session.name} yet. Use the form below to assign one.`}
            </div>
          ) : (
            <ul className="space-y-3">
              {contexts.map((c) => (
                <li key={c.key} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{department.name}</p>
                      <h2 className="text-base font-bold text-gray-900">{c.programme.name} ({c.programme.code})</h2>
                      <p className="text-sm text-gray-900"><strong>{c.level} Level</strong> · Session <strong>{session.name}</strong></p>
                      <p className="text-xs text-gray-700">{c.sources.join(" · ")}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${c.assignment ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{c.assignment ? "Assigned" : "Not assigned"}</span>
                  </div>

                  <p className="mt-3 text-sm text-gray-900">Level Advisor: <strong>{c.assignment ? c.assignment.facultyName : "Not Assigned"}</strong></p>

                  <form action={assignLevelAdvisorAction} className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input type="hidden" name="programme" value={c.programme.id} />
                    <input type="hidden" name="level" value={c.level} />
                    <input type="hidden" name="session" value={session.id} />
                    <input type="hidden" name="fProgramme" value={q.programme ?? ""} />
                    <input type="hidden" name="fLevel" value={q.level ?? ""} />
                    <select name="facultyUserId" required defaultValue={c.assignment?.facultyUserId ?? ""} className={`${control} flex-1`}>
                      <option value="" disabled>Select faculty…</option>
                      {faculty.map((f) => <option key={f.userId} value={f.userId}>{f.name}</option>)}
                    </select>
                    <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">{c.assignment ? "Change Level Advisor" : "Assign Level Advisor"}</SubmitButton>
                  </form>

                  {c.assignment && c.assignment.history.length > 0 && (
                    <details className="mt-3 text-sm text-gray-900">
                      <summary className="cursor-pointer font-semibold text-blue-800">History</summary>
                      <ul className="mt-2 space-y-1">
                        {c.assignment.history.map((h, i) => <li key={i}>{fmt(h.at)} — {h.from === "—" ? "assigned" : `changed from ${h.from} to`} <strong>{h.to}</strong></li>)}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Assign for another programme or level</h2>
            <p className="text-xs text-gray-800 mb-3">For a level that isn&apos;t listed above yet. Department: {department.name}; Session: {session.name}.</p>
            <form action={assignLevelAdvisorAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input type="hidden" name="session" value={session.id} />
              <input type="hidden" name="fProgramme" value={q.programme ?? ""} />
              <input type="hidden" name="fLevel" value={q.level ?? ""} />
              <select name="programme" required defaultValue="" className={control}><option value="" disabled>Programme…</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select>
              <select name="level" required defaultValue="" className={control}><option value="" disabled>Level…</option>{LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}</select>
              <select name="facultyUserId" required defaultValue="" className={control}><option value="" disabled>Select faculty…</option>{faculty.map((f) => <option key={f.userId} value={f.userId}>{f.name}</option>)}</select>
              <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">Assign Level Advisor</SubmitButton>
            </form>
          </section>
        </>
      )}
      <p className="text-xs text-gray-700"><Link className="underline" href="/e-learning/hod/curriculum">View Course Structures</Link></p>
    </div>
  );
}
