"use client";

// The whole selection for one level: CCMAS courses (checkboxes) + university electives
// (Select Elective Course). Everything here is staged in the browser; nothing is stored
// until "Save Courses", which sends the complete selection and updates the existing saved
// structure (or creates it the first time). No draft state.

import { useMemo, useState } from "react";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export interface CcmasCourse {
  id: string; code: string; title: string; creditUnits: number; level: number; statusLetter: string; courseType: string;
  lectureHours: number | null; practicalHours: number | null; duration: string | null; prerequisites: string | null;
  description: string | null; sourcePage: number; alreadySelected: boolean; elsewhere: string[];
}
export interface ElectiveCandidate { id: string; code: string; title: string; creditUnits: number }

const chip = "inline-flex rounded-md border px-2 py-0.5 text-xs font-bold whitespace-nowrap";

export default function StructureEditor({
  courses, electives, initialElectiveIds, editable, action, context, reopensPublished = false,
}: { courses: CcmasCourse[]; electives: ElectiveCandidate[]; initialElectiveIds: string[]; editable: boolean; action: (fd: FormData) => void; context: Record<string, string>; reopensPublished?: boolean }) {
  const [ccmasPicked, setCcmasPicked] = useState<Set<string>>(new Set(courses.filter((c) => c.alreadySelected).map((c) => c.id)));
  const [electivePicked, setElectivePicked] = useState<Set<string>>(new Set(initialElectiveIds));
  const [filter, setFilter] = useState<"all" | "required">("all");
  const [dialog, setDialog] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [dialogPick, setDialogPick] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const shown = useMemo(() => courses.filter((c) => filter === "all" || c.statusLetter === "C"), [courses, filter]);
  const chosenElectives = electives.filter((e) => electivePicked.has(e.id));
  const ccmasUnits = courses.filter((c) => ccmasPicked.has(c.id)).reduce((n, c) => n + c.creditUnits, 0);
  const electiveUnits = chosenElectives.reduce((n, e) => n + e.creditUnits, 0);
  const total = ccmasPicked.size + electivePicked.size;
  const flip = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const requiredIds = courses.filter((c) => c.statusLetter === "C").map((c) => c.id);
  const candidates = electives.filter((e) => !electivePicked.has(e.id) && `${e.code} ${e.title}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <form action={action} className="space-y-6">
      {Object.entries(context).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {[...ccmasPicked].map((id) => <input key={id} type="hidden" name="ccmasCourseId" value={id} />)}
      {[...electivePicked].map((id) => <input key={id} type="hidden" name="electiveCourseId" value={id} />)}

      {/* CCMAS courses */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">2 · CCMAS reference courses</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {(["all", "required"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 ${filter === f ? "bg-blue-700 text-white" : "bg-white text-gray-900"}`}>{f === "all" ? "All CCMAS courses" : "Required only"}</button>
            ))}
          </div>
          {editable && <button type="button" onClick={() => setCcmasPicked((s) => new Set([...s, ...requiredIds]))} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50">Select all required</button>}
          {editable && ccmasPicked.size > 0 && <button type="button" onClick={() => setCcmasPicked(new Set())} className="px-3 py-1.5 text-gray-900 underline">Clear CCMAS selection</button>}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-800">No CCMAS courses available for this programme and level.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 text-gray-800 text-xs uppercase tracking-wide">
                <tr>
                  <th className="w-10 px-3 py-2.5" />
                  {["Code", "Title", "Level", "Units", "Type", "LH / PH", "PDF p.", "In this structure"].map((h) => <th key={h} className="text-left font-semibold px-3 py-2.5">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((c) => (
                  <tr key={c.id} className={c.alreadySelected ? "bg-green-50" : ""}>
                    <td className="px-3 py-2.5 align-top"><input type="checkbox" className="h-4 w-4" disabled={!editable} checked={ccmasPicked.has(c.id)} onChange={() => setCcmasPicked((s) => flip(s, c.id))} aria-label={`Select ${c.code}`} /></td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap align-top">{c.code}</td>
                    <td className="px-3 py-2.5 align-top text-gray-900">
                      {c.title}
                      {(c.prerequisites || c.description) && (
                        <details className="mt-1 text-xs text-gray-800"><summary className="cursor-pointer text-blue-800 font-medium">Details</summary>
                          {c.prerequisites && <p className="mt-1"><strong>Prerequisites:</strong> {c.prerequisites}</p>}
                          {c.description && <p className="mt-1 whitespace-pre-line">{c.description}</p>}
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top"><span className={`${chip} bg-gray-100 text-gray-900 border-gray-400`}>{c.level} Level</span></td>
                    <td className="px-3 py-2.5 align-top"><span className={`${chip} bg-gray-100 text-gray-900 border-gray-400`}>{c.creditUnits} {c.creditUnits === 1 ? "Unit" : "Units"}</span></td>
                    <td className="px-3 py-2.5 align-top"><span className={`${chip} ${c.courseType === "CORE" ? "bg-blue-100 text-blue-900 border-blue-300" : "bg-purple-100 text-purple-900 border-purple-300"}`}>{c.courseType[0] + c.courseType.slice(1).toLowerCase()}</span></td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap text-gray-900">{c.duration ?? `${c.lectureHours ?? "—"} / ${c.practicalHours ?? "—"}`}</td>
                    <td className="px-3 py-2.5 align-top text-gray-900">{c.sourcePage}</td>
                    <td className="px-3 py-2.5 align-top text-xs">
                      {c.alreadySelected ? <span className="font-bold text-green-800">✓ Saved</span> : <span className="text-gray-800">Not saved</span>}
                      {c.elsewhere.map((e) => <span key={e} className="block text-gray-800">Also: {e}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Electives */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">3 · University electives</h2>
          {editable && <button type="button" onClick={() => { setDialogPick(new Set()); setSearch(""); setDialog(true); }} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">Select Elective Course</button>}
        </div>
        {chosenElectives.length === 0 ? (
          <p className="text-sm text-gray-800">No electives selected. Use <strong>Select Elective Course</strong> to choose courses created under Add Course.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {chosenElectives.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="text-gray-900"><strong>{e.code}</strong> — {e.title}</span>
                <span className="flex items-center gap-2">
                  <span className={`${chip} bg-gray-100 text-gray-900 border-gray-400`}>{e.creditUnits} {e.creditUnits === 1 ? "Unit" : "Units"}</span>
                  <span className={`${chip} bg-purple-100 text-purple-900 border-purple-300`}>Elective</span>
                  <span className={`${chip} bg-emerald-100 text-emerald-900 border-emerald-300`}>UNIVERSITY</span>
                  {editable && <button type="button" onClick={() => setElectivePicked((s) => flip(s, e.id))} className="text-xs font-semibold text-red-800 underline">Remove</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Save */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-gray-900">Selected: {total} course{total === 1 ? "" : "s"} <span className="mx-2 text-gray-400">|</span> {ccmasUnits + electiveUnits} credit units <span className="ml-2 font-normal text-gray-800">({ccmasPicked.size} CCMAS + {electivePicked.size} university)</span></p>
        {editable ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-800 hidden sm:inline">Saving doesn&apos;t notify the HOD — publish from Review Saved Courses.</span>
            {reopensPublished ? (
              <button type="button" disabled={total === 0} onClick={() => setConfirmSave(true)} className="px-5 py-2.5 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50">Save Courses</button>
            ) : (
              <SubmitButton disabled={total === 0} className="px-5 py-2.5 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50">Save Courses</SubmitButton>
            )}
          </div>
        ) : <span className="text-sm text-gray-800">This structure has been submitted and can&apos;t be changed here.</span>}
      </section>

      {confirmSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reopen-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl text-gray-900">
            <h2 id="reopen-title" className="text-lg font-bold">Change a published course structure?</h2>
            <ul className="mt-3 list-disc pl-5 text-sm space-y-1 text-gray-900">
              <li>The structure goes back to the HOD to be re-approved.</li>
              <li>Students won&apos;t see it until the HOD re-approves.</li>
              <li>The registrations of the students at this level, for this semester, are cleared, and they must register again.</li>
            </ul>
            <p className="mt-3 text-sm text-gray-800">If your selection is identical to what is published, nothing changes.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSave(false)} className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-medium text-gray-900 hover:bg-gray-50">Cancel</button>
              <SubmitButton className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800">Save and send to HOD</SubmitButton>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="elective-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl text-gray-900">
            <h2 id="elective-title" className="text-lg font-bold">Select Elective Course</h2>
            <p className="mt-1 text-sm text-gray-800">University courses created under Add Course.</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code or title" className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900" />
            <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
              {candidates.length === 0 ? (
                <li className="p-4 text-sm text-gray-800">{electives.length === 0 ? "No university courses exist yet — create one under Add Course." : "No matching courses."}</li>
              ) : candidates.map((e) => (
                <li key={e.id}><label className="flex items-start gap-2 px-3 py-2.5 text-sm cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={dialogPick.has(e.id)} onChange={() => setDialogPick((s) => flip(s, e.id))} /><span><strong>{e.code}</strong> — {e.title} <span className="text-gray-800">({e.creditUnits} {e.creditUnits === 1 ? "unit" : "units"})</span></span></label></li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-medium text-gray-900 hover:bg-gray-50">Cancel</button>
              <button type="button" disabled={dialogPick.size === 0} onClick={() => { setElectivePicked((s) => new Set([...s, ...dialogPick])); setDialog(false); }} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">Add {dialogPick.size || ""} as Elective</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
