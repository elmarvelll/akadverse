"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import LearningMarkdown from "./LearningMarkdown";
type Activity = { id: string; status: string; action: string | null; result: { text?: string; message?: string; hint?: string; level?: number; shadow?: boolean; sourceLabel?: string; sources?: { title: string }[]; evaluation?: { correct: boolean; answerFeedback: string; reasoningFeedback: string; assistance: string } } | null; errorCode: string | null; delivered: boolean };
type View = { id: string; status: string; busy: boolean; mode: string; currentConceptId: string; concepts: { id: string; title: string; coverage: string; mastery: string }[]; allowedActions: string[]; activeQuestion: { id: string; text: string; type: string } | null; actions: Activity[] };
const endpoint = "/api/e-learning/learning";
async function request<T>(body?: Record<string, unknown>, runId?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(body ? endpoint : `${endpoint}?run=${encodeURIComponent(runId!)}`, { method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not complete this activity."); return result.result;
}
export default function LearningJourney({ courseId, documentId, weekNumber }: { courseId: string; documentId: string; weekNumber: number }) {
  const [view, setView] = useState<View>(), [preparing, setPreparing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [answer, setAnswer] = useState(""), [reasoning, setReasoning] = useState(""), [question, setQuestion] = useState(""), [explicit, setExplicit] = useState(false);
  const lastAttempt = useRef<string | null>(null);
  const locked = useRef(false), acknowledged = useRef(new Set<string>());
  const showView = useCallback((next: View) => {
    const attempt = next.activeQuestion?.id ?? null;
    if (attempt !== lastAttempt.current) { lastAttempt.current = attempt; setAnswer(""); setReasoning(""); setExplicit(false); }
    setView(next);
  }, []);
  const context = { courseId, documentId, weekNumber };
  async function start() {
    const result = await request<{ status: string; run?: View }>({ action: "start", ...context });
    setPreparing(result.status === "PREPARING"); if (result.run) showView(result.run);
  }
  async function act(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "This activity could not finish."); }
    finally { locked.current = false; setBusy(false); }
  }
  // Poll only active work; abort on context change and stop after a bounded interval.
  const runId = view?.id, pending = preparing || view?.busy;
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController(); let count = 0, timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (runId) showView(await request<View>(undefined, runId, controller.signal));
        else {
          const result = await request<{ status: string; run?: View }>({ action: "start", courseId, documentId, weekNumber }, undefined, controller.signal);
          if (result.run) { showView(result.run); setPreparing(false); }
        }
        if (!controller.signal.aborted && ++count < 48) timeout = setTimeout(poll, 5000);
        else if (!controller.signal.aborted) { setError("This activity is taking longer than expected. Refresh its status before repeating it."); setPreparing(false); }
      } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Could not refresh this activity."); setPreparing(false); } }
    };
    timeout = setTimeout(poll, 2000);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [pending, runId, courseId, documentId, weekNumber, showView]);
  // This runs after the rendered result commits. It sends no mastery/coverage assertions.
  useEffect(() => {
    if (!view) return;
    const candidates = view.actions.filter(a => a.status === "COMPLETED" && !a.delivered && !a.result?.shadow && !acknowledged.current.has(a.id));
    if (!candidates.length) return;
    void (async () => {
      try {
        for (const activity of candidates) {
          acknowledged.current.add(activity.id);
          try { await request({ action: "deliver", runId: view.id, actionId: activity.id }); }
          catch (e) { acknowledged.current.delete(activity.id); throw e; }
        }
        showView(await request<View>(undefined, view.id));
      } catch { setError("Your activity is visible, but its receipt was not saved. Refresh the status before continuing."); }
    })();
  }, [view, showView]);
  const disabled = busy || !!view?.busy || preparing;
  async function command(name: string) {
    if (!view) return;
    await request({ action: "command", runId: view.id, command: name, requestId: crypto.randomUUID(), ...(name === "answer" || name === "hint" ? { answer, reasoning, explicit } : {}), ...(name === "question" ? { question } : {}) });
    showView(await request<View>(undefined, view.id));
    if (name === "question") setQuestion("");
  }
  const current = view?.concepts.find(c => c.id === view.currentConceptId);
  return <section aria-label="Personalized learning" className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Learn this material</h2><p className="mt-1 text-sm text-slate-600">Read an explanation, try a question, and build understanding at your pace.</p></div><Link href="/e-learning/student/revisions" className="text-sm font-semibold text-blue-700 underline">Open Revisions</Link></div>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {!view ? <button type="button" disabled={disabled} onClick={() => void act(start)} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{preparing ? "Preparing learning plan…" : busy ? "Opening lesson…" : "Start or resume lesson"}</button> : <>
      <div className="my-4 flex flex-wrap gap-2 text-xs">{view.concepts.map(c => <span key={c.id} aria-current={c.id === view.currentConceptId ? "step" : undefined} className={`rounded-lg border px-3 py-2 ${c.id === view.currentConceptId ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>{c.title} · {c.mastery.replaceAll("_", " ").toLowerCase()} · {c.coverage === "EXPLAINED" ? "Studied" : "Not studied"}</span>)}</div>
      <h3 className="font-semibold">{current?.title}</h3>
      {view.status === "PAUSED" && <p className="my-2 text-sm text-amber-800">Progression is paused for review. You can still ask Stuart a question.</p>}
      {view.status === "COMPLETED" && <p role="status" className="my-2 text-sm text-green-800">Lesson completed. Your revision schedule is available in Revisions.</p>}
      <div className="my-3 max-h-[32rem] space-y-3 overflow-y-auto" aria-live="polite" aria-busy={view.busy}>
        {view.actions.map(a => <article key={a.id} className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold text-slate-500">{a.action?.replaceAll("_", " ").toLowerCase() || "Choosing the next activity"}</p>
          {["PENDING", "PROCESSING"].includes(a.status) ? <p role="status">Preparing this activity…</p> : ["FAILED", "UNCERTAIN"].includes(a.status) ? <p className="text-amber-800">{a.status === "UNCERTAIN" ? "The service did not confirm this activity. Review its status before requesting it again." : "This activity could not finish. Your learning progress was preserved."} Reference: {a.id}</p> : <>
            {a.result?.message && <p>{a.result.message}</p>}{a.result?.sourceLabel && <p className="mb-2 text-xs text-slate-500">{a.result.sourceLabel}</p>}
            {a.result?.text && <LearningMarkdown text={a.result.text} />}
            {a.result?.hint && <><p className="mb-2 font-semibold">Hint {a.result.level}</p><LearningMarkdown text={a.result.hint} /></>}
            {a.result?.sources?.length ? <p className="mt-2 text-xs text-slate-500">Lecturer material: {a.result.sources.map(s => s.title).join(", ")}</p> : null}
            {a.result?.evaluation && <div><p className="font-semibold">{a.result.evaluation.correct ? "Correct" : "Keep practicing"}</p><p>{a.result.evaluation.answerFeedback}</p><p>{a.result.evaluation.reasoningFeedback}</p><p className="mt-2 text-xs">{a.result.evaluation.assistance === "independent" ? "Independent attempt" : "Assisted attempt"}</p></div>}
          </>}
        </article>)}
      </div>
      {view.activeQuestion && <form className="my-4 space-y-3 rounded-xl bg-slate-50 p-3" onSubmit={e => { e.preventDefault(); void act(() => command("answer")); }}>
        <p className="font-semibold">{view.activeQuestion.text}</p>
        <label className="block text-sm">Your answer<textarea disabled={disabled} value={answer} onChange={e => setAnswer(e.target.value)} maxLength={4000} required className="mt-1 block min-h-20 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Explain your reasoning<textarea disabled={disabled} value={reasoning} onChange={e => setReasoning(e.target.value)} maxLength={4000} className="mt-1 block min-h-20 w-full rounded-lg border p-2" /></label>
        <div className="flex flex-wrap gap-2"><button disabled={disabled || !answer.trim()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">Check my answer</button>{view.allowedActions.includes("GIVE_HINT") && <button type="button" disabled={disabled || !answer.trim()} onClick={() => void act(() => command("hint"))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Get a hint</button>}</div>
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={explicit} onChange={e => setExplicit(e.target.checked)} disabled={disabled} />Allow solution-level help after the earlier hints. This counts as assisted work.</label>
      </form>}
      <div className="flex flex-wrap gap-2">{view.status !== "COMPLETED" && view.allowedActions.includes("EXPLAIN_CONCEPT") && <button type="button" disabled={disabled} onClick={() => void act(() => command("explain"))} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-800 disabled:opacity-50">Explain</button>}{view.status !== "COMPLETED" && view.allowedActions.includes("SHOW_GUIDED_EXAMPLE") && <button type="button" disabled={disabled} onClick={() => void act(() => command("guided"))} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-800 disabled:opacity-50">Guided example</button>}{view.status !== "COMPLETED" && view.allowedActions.includes("GENERATE_PRACTICE") && <button type="button" disabled={disabled} onClick={() => void act(() => command("practice"))} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-800 disabled:opacity-50">Try practice</button>}{view.status !== "COMPLETED" && view.allowedActions.includes("RECAP") && <button type="button" disabled={disabled} onClick={() => void act(() => command("recap"))} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-800 disabled:opacity-50">Recap</button>}{view.status !== "COMPLETED" && view.mode !== "off" && <button type="button" disabled={disabled} onClick={() => void act(() => command("next"))} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">Continue lesson</button>}<button type="button" disabled={busy} onClick={() => void act(async () => showView(await request<View>(undefined, view.id)))} className="rounded-lg border px-3 py-2 text-sm">Refresh status</button></div>
      {view.status !== "COMPLETED" && <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); void act(() => command("question")); }}><label className="sr-only" htmlFor="lesson-question">Ask about this concept</label><input id="lesson-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={4000} disabled={disabled} placeholder="Ask about this concept…" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><button disabled={disabled || !question.trim()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Ask Stuart</button></form>}
    </>}
  </section>;
}
