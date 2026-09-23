"use client";

// Start/End date AND time inputs in the DAPU's own timezone. The browser converts each value to
// an exact ISO instant (UTC) in a hidden field, so the server never has to guess a timezone.

import { useState, useSyncExternalStore } from "react";

const toLocalValue = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");
const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900";

const noopSubscribe = () => () => {};
const fmt = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

// Rendered in the viewer's own timezone, only after hydration (server snapshot is empty).
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(noopSubscribe, () => fmt(iso), () => "");
  return <>{text || "…"}</>;
}

export default function DateTimeRange({ start, end }: { start: string | null; end: string | null }) {
  // Initial values come from the saved timestamps in the browser's timezone; edits override them.
  const initialStart = useSyncExternalStore(noopSubscribe, () => (start ? toLocalValue(start) : ""), () => "");
  const initialEnd = useSyncExternalStore(noopSubscribe, () => (end ? toLocalValue(end) : ""), () => "");
  const [editedStart, setS] = useState<string | null>(null);
  const [editedEnd, setE] = useState<string | null>(null);
  const s = editedStart ?? initialStart;
  const e = editedEnd ?? initialEnd;

  return (
    <>
      <input type="hidden" name="startDate" value={toIso(s)} />
      <input type="hidden" name="endDate" value={toIso(e)} />
      <div>
        <label className="block text-xs font-semibold text-gray-800 mb-1">Start date &amp; time</label>
        <input type="datetime-local" value={s} onChange={(ev) => setS(ev.target.value)} required className={input} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-800 mb-1">End date &amp; time</label>
        <input type="datetime-local" value={e} onChange={(ev) => setE(ev.target.value)} required className={input} />
      </div>
    </>
  );
}
