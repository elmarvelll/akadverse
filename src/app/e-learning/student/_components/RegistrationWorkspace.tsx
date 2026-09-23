"use client";

// Available Courses / Selected Courses / Register Courses.
//
// `selectedIds` (the "selectedCourses") lives ONLY in this component's memory. Selecting or
// removing a course is a plain state update: no request, no spinner, no database write. The one
// and only request is "Register Courses", which sends the whole selection once. If it fails the
// selection is kept so the student can fix the problem and retry.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { registerCoursesAction } from "../course-control/actions";

export interface WorkspaceCourse { id: string; code: string; title: string; creditUnits: number; courseType: string | null }

export default function RegistrationWorkspace({
  courses, registered, level, canSelect, unitsMin, unitsMax, statusLabel, initialSelectedIds,
}: {
  courses: WorkspaceCourse[];
  registered: WorkspaceCourse[]; // a registration that already exists (read-only)
  level: number;
  canSelect: boolean;            // period ACTIVE and no registration in progress
  unitsMin: number | null;
  unitsMax: number | null;
  statusLabel: string | null;
  initialSelectedIds: string[];  // e.g. a rejected registration's courses, so they can be adjusted
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialSelectedIds.filter((id) => courses.some((c) => c.id === id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = courses.filter((c) => selectedIds.includes(c.id));
  const available = courses.filter((c) => !selectedIds.includes(c.id));
  const units = selected.reduce((n, c) => n + c.creditUnits, 0);
  const overMax = unitsMax !== null && units > unitsMax;

  // Local state only — nothing here talks to the server.
  const select = (id: string) => { if (canSelect) setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id])); };
  const remove = (id: string) => { if (canSelect) setSelectedIds((prev) => prev.filter((x) => x !== id)); };

  const register = () => {
    setError(null);
    startTransition(async () => {
      const result = await registerCoursesAction(selectedIds);
      if (!result.ok) { setError(result.error); return; } // keep the selection so the student can retry
      setSelectedIds([]);
      router.refresh();
    });
  };

  if (registered.length > 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Registered Courses ({registered.length})</h2>
        {statusLabel && <p className="text-xs font-semibold text-blue-900 mb-3">{statusLabel}</p>}
        <ul className="divide-y divide-gray-100">
          {registered.map((c) => (
            <li key={c.id} className="py-2.5 text-sm text-gray-900"><span className="font-semibold">{c.code}</span> — {c.title} <CourseMeta level={level} units={c.creditUnits} type={c.courseType} /></li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="selected-courses">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Selected Courses ({selected.length})</h2>
        <p className="text-xs text-gray-700 mb-3">Selecting a course does not register it. Review your selection, then press Register Courses.</p>
        {selected.length === 0 ? (
          <p className="text-sm text-gray-800">No courses selected yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {selected.map((c) => (
              <li key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3" data-course={c.code}>
                <span className="text-sm text-gray-900"><span className="font-semibold">{c.code}</span> — {c.title} <CourseMeta level={level} units={c.creditUnits} type={c.courseType} /></span>
                <button type="button" data-action="remove" disabled={!canSelect || pending} onClick={() => remove(c.id)} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-40 disabled:no-underline">Remove</button>
              </li>
            ))}
          </ul>
        )}

        {error && <div role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error} Your selection is still here — fix the problem and try again.</div>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className={`text-sm font-bold ${overMax ? "text-red-800" : "text-gray-900"}`}>
            Selected: {units} units
            {unitsMax !== null && <> · Maximum: {unitsMax} · Remaining: {Math.max(0, unitsMax - units)}</>}
            {unitsMin !== null && <> · Minimum: {unitsMin}</>}
          </p>
          {selected.length > 0 && (
            <button type="button" data-action="register" disabled={!canSelect || pending || overMax} onClick={register} className="ml-auto px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-40">
              {pending ? "Registering…" : "Register Courses"}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="available-courses">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Available Courses — {level} Level ({available.length})</h2>
        {available.length === 0 ? (
          <p className="text-sm text-gray-800">{selected.length > 0 ? "You've selected every course in your course structure." : "No courses available."}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {available.map((c) => (
              <li key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3" data-course={c.code}>
                <span className="text-sm text-gray-900"><span className="font-semibold">{c.code}</span> — {c.title} <CourseMeta level={level} units={c.creditUnits} type={c.courseType} /></span>
                <button type="button" data-action="select" disabled={!canSelect || pending} onClick={() => select(c.id)} className="text-xs font-semibold text-blue-800 hover:underline disabled:opacity-40 disabled:no-underline">Select</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
