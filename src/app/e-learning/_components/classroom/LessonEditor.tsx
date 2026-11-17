"use client";
import { useEffect, useState } from "react";
import { lessonOptionsAction, setLessonAction } from "./actions";
import type { ClassroomLesson } from "@/services/e-learning/classroom/lesson";
type Options = { lesson: ClassroomLesson | null; totalWeeks: number; materials: { id: string; title: string; startWeek: number; endWeek: number }[] };
export default function LessonEditor({ sessionId, onSaved }: { sessionId: string; onSaved: () => Promise<void> }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [topic, setTopic] = useState(""); const [week, setWeek] = useState(1); const [documentId, setDocumentId] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const result = await lessonOptionsAction(sessionId);
    if (!result.ok) { setError(result.error); return; }
    setOptions(result.options); setTopic(result.options.lesson?.topic ?? ""); setWeek(result.options.lesson?.week ?? 1); setDocumentId(result.options.lesson?.documentId ?? "");
  }
  useEffect(() => { let cancelled = false; void lessonOptionsAction(sessionId).then(result => {
    if (cancelled) return;
    if (!result.ok) { setError(result.error); return; }
    setOptions(result.options); setTopic(result.options.lesson?.topic ?? ""); setWeek(result.options.lesson?.week ?? 1); setDocumentId(result.options.lesson?.documentId ?? "");
  }).catch(() => { if (!cancelled) setError("Couldn't load lesson settings. Your class can continue."); }); return () => { cancelled = true; }; }, [sessionId]);
  return <form className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4" onSubmit={async e => {
    e.preventDefault(); if (!options || busy) return; setBusy(true); setError("");
    try {
      const result = await setLessonAction(sessionId, { topic, week, documentId, version: options.lesson?.version ?? 0 });
      if (!result.ok) { setError(result.error); await load(); } else { await load(); await onSaved(); }
    } catch { setError("Couldn't update the lesson. Your class can continue."); } finally { setBusy(false); }
  }}>
    <h2 className="font-semibold text-gray-900">Current lesson for Stuart</h2>
    <p className="text-xs text-gray-600">Choose what you are teaching. Saving starts a new lesson conversation for students.</p>
    <label className="block text-sm">Topic<input required maxLength={200} value={topic} onChange={e => setTopic(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
    <label className="block text-sm">Week<select value={week} onChange={e => { setWeek(Number(e.target.value)); setDocumentId(""); }} className="mt-1 w-full rounded border p-2">{Array.from({ length: options?.totalWeeks ?? 1 }, (_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}</select></label>
    <label className="block text-sm">Material (optional)<select value={documentId} onChange={e => setDocumentId(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">All materials for this week</option>{options?.materials.filter(m => m.startWeek <= week && m.endWeek >= week).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
    <p className="text-xs text-gray-600">Stuart retrieves materials for this week. It cannot see the live screen or audio.</p>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <button disabled={!options || busy} className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Set current lesson"}</button>
  </form>;
}
