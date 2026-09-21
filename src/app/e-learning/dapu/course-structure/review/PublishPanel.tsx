"use client";

// Bulk publishing with a confirmation dialog. The server re-checks eligibility
// (status SAVED, department has a HOD); this list is only what the user sees.

import { useState } from "react";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

type Item = { id: string; label: string; detail: string };

export default function PublishPanel({ items, action }: { items: Item[]; action: (fd: FormData) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { mode: "selected" | "all"; ids: string[] }>(null);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const byId = new Map(items.map((i) => [i.id, i]));

  if (items.length === 0) return <p className="text-sm text-gray-700">No saved course structures are waiting to be published.</p>;

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex items-start gap-2 text-sm text-gray-900">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
              <span><strong>{i.label}</strong> <span className="text-gray-700">— {i.detail}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={picked.size === 0} onClick={() => setConfirm({ mode: "selected", ids: [...picked] })} className="px-4 py-2 rounded-lg border border-blue-700 text-blue-800 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50">
          Publish Selected to HOD(s)
        </button>
        <button type="button" onClick={() => setConfirm({ mode: "all", ids: items.map((i) => i.id) })} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">
          Publish to All HODs
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="publish-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl text-gray-900">
            <h2 id="publish-title" className="text-lg font-bold">Publish Course Structures?</h2>
            <p className="mt-2 text-sm text-gray-800">You are about to submit the following saved course structures to their respective HODs for review:</p>
            <ul className="mt-3 max-h-56 overflow-y-auto list-disc pl-5 text-sm space-y-1">
              {confirm.ids.map((id) => <li key={id}>{byId.get(id)?.label} <span className="text-gray-700">— {byId.get(id)?.detail}</span></li>)}
            </ul>
            <p className="mt-3 text-sm text-gray-800">HODs will be notified and will be able to review and approve or return the submitted structures.</p>
            <form action={action} className="mt-5 flex justify-end gap-2">
              {confirm.ids.map((id) => <input key={id} type="hidden" name="curriculumId" value={id} />)}
              <button type="button" onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-medium text-gray-900 hover:bg-gray-50">Cancel</button>
              <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">{confirm.mode === "all" ? "Publish to All HODs" : "Publish Selected"}</SubmitButton>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Single-structure "Publish to HOD(s)" with the same confirm-first behaviour as the bulk buttons.
export function PublishOne({ item, action }: { item: { id: string; programme: string; levels: string; session: string; semester: string; courses: number; units: number; department: string }; action: (fd: FormData) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">Publish to HOD(s)</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={`pub-${item.id}`}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl text-gray-900">
            <h2 id={`pub-${item.id}`} className="text-lg font-bold">Publish Course Structure?</h2>
            <dl className="mt-3 text-sm space-y-1">
              <div><dt className="inline font-semibold">Programme: </dt><dd className="inline">{item.programme}</dd></div>
              <div><dt className="inline font-semibold">Department: </dt><dd className="inline">{item.department}</dd></div>
              <div><dt className="inline font-semibold">Level(s): </dt><dd className="inline">{item.levels || "—"}</dd></div>
              <div><dt className="inline font-semibold">Academic Session: </dt><dd className="inline">{item.session}</dd></div>
              <div><dt className="inline font-semibold">Semester: </dt><dd className="inline">{item.semester}</dd></div>
              <div><dt className="inline font-semibold">Courses: </dt><dd className="inline">{item.courses}</dd></div>
              <div><dt className="inline font-semibold">Credit Units: </dt><dd className="inline">{item.units}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-gray-800">This will submit the saved course structure to the responsible HOD for review.</p>
            <form action={action} className="mt-5 flex justify-end gap-2">
              <input type="hidden" name="curriculumId" value={item.id} />
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-gray-400 text-sm font-medium text-gray-900 hover:bg-gray-50">Cancel</button>
              <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">Publish to HOD</SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
