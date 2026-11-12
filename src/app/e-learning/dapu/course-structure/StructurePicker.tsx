"use client";

// Six dependent selectors (College -> Department -> Programme, Level, Session ->
// Semester). Options come from the database via props; the chosen ids go in the
// URL and the server re-validates the whole chain before showing anything.

import { useRouter } from "next/navigation";
import { useState } from "react";

type Tree = { id: string; code: string; name: string; departments: { id: string; name: string; programmes: { id: string; code: string; name: string }[] }[] }[];
type Sessions = { id: string; name: string; semesters: { id: string; name: string; sequence: number }[] }[];
type Ctx = { collegeId: string; departmentId: string; programmeId: string; level: string; sessionId: string; semesterId: string };

const LEVELS = [100, 200, 300, 400, 500, 600];
const sel = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-xs font-semibold text-gray-700 space-y-1">
      {label}
      {children}
      {hint && <span className="block font-normal text-gray-500">{hint}</span>}
    </label>
  );
}

export default function StructurePicker({ tree, sessions, initial }: { tree: Tree; sessions: Sessions; initial: Ctx }) {
  const router = useRouter();
  const [c, setC] = useState<Ctx>(initial);
  const college = tree.find((x) => x.id === c.collegeId);
  const department = college?.departments.find((x) => x.id === c.departmentId);
  const session = sessions.find((x) => x.id === c.sessionId);

  const go = (next: Ctx) => {
    setC(next);
    const done = next.collegeId && next.departmentId && next.programmeId && next.level && next.sessionId && next.semesterId;
    router.push(
      done
        ? `/e-learning/dapu/course-structure?college=${next.collegeId}&department=${next.departmentId}&programme=${next.programmeId}&level=${next.level}&session=${next.sessionId}&semester=${next.semesterId}`
        : "/e-learning/dapu/course-structure"
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <Field label="College">
        <select className={sel} value={c.collegeId} onChange={(e) => go({ ...c, collegeId: e.target.value, departmentId: "", programmeId: "" })}>
          <option value="">Select a college…</option>
          {tree.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.code})</option>)}
        </select>
      </Field>
      <Field label="Department" hint={college && college.departments.length === 0 ? "No departments available yet." : undefined}>
        <select className={sel} value={c.departmentId} disabled={!college} onChange={(e) => go({ ...c, departmentId: e.target.value, programmeId: "" })}>
          <option value="">{college ? "Select a department…" : "Choose a college first"}</option>
          {college?.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Programme" hint={department && department.programmes.length === 0 ? "No programmes available yet." : undefined}>
        <select className={sel} value={c.programmeId} disabled={!department} onChange={(e) => go({ ...c, programmeId: e.target.value })}>
          <option value="">{department ? "Select a programme…" : "Choose a department first"}</option>
          {department?.programmes.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.code})</option>)}
        </select>
      </Field>
      <Field label="Level">
        <select className={sel} value={c.level} onChange={(e) => go({ ...c, level: e.target.value })}>
          <option value="">Select a level…</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}
        </select>
      </Field>
      <Field label="Academic Session" hint={sessions.length === 0 ? "No sessions yet — add one on the dashboard." : undefined}>
        <select className={sel} value={c.sessionId} onChange={(e) => go({ ...c, sessionId: e.target.value, semesterId: "" })}>
          <option value="">Select a session…</option>
          {sessions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Semester" hint={session && session.semesters.length === 0 ? "This session has no semesters yet." : undefined}>
        <select className={sel} value={c.semesterId} disabled={!session} onChange={(e) => go({ ...c, semesterId: e.target.value })}>
          <option value="">{session ? "Select a semester…" : "Choose a session first"}</option>
          {[...(session?.semesters ?? [])].sort((a, b) => a.sequence - b.sequence).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
