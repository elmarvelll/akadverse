"use client";
import { useEffect, useRef, useState } from "react";
type Course = { id: string; offeringId: string | null; code: string; title: string };
type Evaluation = { answer_correct: boolean; answer_feedback: string; reasoning_feedback: string; needs_review: boolean };
type Item = { id: string; position: number; status: string; introduction: boolean; course: { code: string; title: string }; question: { type: string; stem: string; options: { key: string; text: string }[]; conceptTitle: string }; answer: string | null; reasoning: string | null; evaluation: Evaluation | null; correctAnswer?: string | boolean; explanation?: string };
type Session = { id: string; mode: string; status: string; total: number; completed: number; skipped?: number; current: Item | null; nextReviewAt?: string };
type Home = { courses: Course[]; sessions: { id: string; mode: string; status: string; updatedAt: string }[]; history: { id: string; question: { stem: string }; evaluation: Evaluation; review: { rating: number; reviewedAt: string; nextReviewAt: string } | null }[] };
const endpoint = "/api/e-learning/revision";
export default function RevisionsWorkspace() {
  const [home, setHome] = useState<Home>(), [session, setSession] = useState<Session>(), [mode, setMode] = useState("COURSE"), [offering, setOffering] = useState("");
  const [answer, setAnswer] = useState(""), [reasoning, setReasoning] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(true), [notice, setNotice] = useState("");
  const mounted = useRef(true), pending = useRef(false), creation = useRef(""), ratings = useRef(new Map<string, string>()), controllers = useRef(new Set<AbortController>());
  async function request<T>(input?: Record<string, unknown>, query = ""): Promise<T> {
    const c = new AbortController(); controllers.current.add(c); const timer = setTimeout(() => c.abort(), 85000);
    try { const r = await fetch(endpoint + query, { method: input ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal: c.signal, headers: { "Content-Type": "application/json" }, ...(input ? { body: JSON.stringify(input) } : {}) }); const value = await r.json(); if (!r.ok) throw Error(value.error || "Revision request failed."); return value.result; }
    finally { clearTimeout(timer); controllers.current.delete(c); }
  }
  function show(value: Session) {
    if (!mounted.current) return; setSession(value); setAnswer(value.current?.answer || ""); setReasoning(value.current?.reasoning || "");
    const url = new URL(location.href); url.searchParams.set("session", value.id); history.replaceState(null, "", url);
    if (value.nextReviewAt) setNotice(`Review saved. Next review: ${new Date(value.nextReviewAt).toLocaleString()}.`);
  }
  async function act(work: () => Promise<void>) {
    if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { if (mounted.current) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "The connection ended before confirmation. Reload the saved session before retrying."); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function loadHome() { const h = await request<Home>(undefined, "?workspace=1"); if (mounted.current) { setHome(h); setOffering(previous => previous || h.courses.find(c => c.offeringId)?.offeringId || ""); } }
  useEffect(() => {
    mounted.current = true; let active = true; const requests = controllers.current;
    void (async () => {
      try {
        const h = await request<Home>(undefined, "?workspace=1"); if (!active) return;
        setHome(h); setOffering(h.courses.find(c => c.offeringId)?.offeringId || "");
        const id = new URL(location.href).searchParams.get("session");
        if (id) { const saved = await request<Session>(undefined, `?session=${encodeURIComponent(id)}`); if (active) show(saved); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not load Revisions."); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; mounted.current = false; for (const c of requests) c.abort(); };
  }, []);
  const current = session?.current;
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="Choose revision mode"><div className="flex flex-wrap gap-2">{["COURSE", "RANDOM"].map(m => <button key={m} type="button" disabled={busy} aria-pressed={mode === m} onClick={() => { setMode(m); creation.current = ""; }} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${mode === m ? "bg-blue-700 text-white" : "bg-white text-slate-800"}`}>{m === "COURSE" ? "Course Revision" : "Random Revision"}</button>)}</div>
      <p className="my-3 text-sm text-slate-600">{mode === "COURSE" ? "Revise eligible questions from one registered course." : "Mix eligible questions across your registered courses. Due reviews come before new questions."}</p>
      {mode === "COURSE" && <label className="block text-sm font-medium">Registered course<select className="my-2 block w-full rounded-lg border p-2" value={offering} disabled={busy} onChange={e => { setOffering(e.target.value); creation.current = ""; }}><option value="">Select a course</option>{home?.courses.filter(c => c.offeringId).map(c => <option key={c.id} value={c.offeringId!}>{c.code} — {c.title}</option>)}</select></label>}
      {home && !home.courses.length && <p className="my-3 text-sm">No approved registered courses are available yet.</p>}
      <button type="button" disabled={busy || !home || !home.courses.length || (mode === "COURSE" && !offering)} className="mt-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void act(async () => { creation.current ||= crypto.randomUUID(); show(await request<Session>({ action: "start_session", mode, offeringId: offering, requestId: creation.current })); creation.current = ""; })}>Start revision</button>
    </section>
    {busy && <p role="status" className="text-sm text-slate-600">Loading your revision…</p>}{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" disabled={busy} className="ml-3 underline" onClick={() => void act(async () => { await loadHome(); if (session) show(await request<Session>(undefined, `?session=${encodeURIComponent(session.id)}`)); })}>Refresh saved progress</button></div>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {session && <section className="rounded-2xl border bg-white p-4 sm:p-6" aria-label="Revision session"><div className="mb-4 flex flex-wrap justify-between gap-2 text-sm"><strong>{session.mode === "COURSE" ? "Course Revision" : "Random Revision"}</strong><span>{session.completed} reviewed · {session.skipped || 0} unavailable · {session.total} selected</span></div>
      {current ? <><p className="text-xs font-semibold text-blue-700">{current.course.code} · {current.introduction ? "New question" : "Due review"}</p><h2 className="my-3 whitespace-pre-wrap text-lg font-semibold">{current.question.stem}</h2>
        <form onSubmit={e => { e.preventDefault(); void act(async () => show(await request<Session>({ action: "answer_item", itemId: current.id, answer, reasoning }))); }} className="space-y-3">
          {current.question.type === "mcq" ? <fieldset disabled={busy || !!current.evaluation}><legend className="mb-2 text-sm">Choose your answer</legend>{current.question.options.map(o => <label key={o.key} className="mb-2 flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="answer" value={o.key} checked={answer === o.key} onChange={() => setAnswer(o.key)} /><span>{o.key}. {o.text}</span></label>)}</fieldset> : current.question.type === "true_false" ? <fieldset disabled={busy || !!current.evaluation}><legend className="mb-2 text-sm">Choose your answer</legend>{["true", "false"].map(v => <label key={v} className="mr-5 inline-flex items-center gap-2 text-sm"><input type="radio" name="answer" checked={answer === v} onChange={() => setAnswer(v)} />{v === "true" ? "True" : "False"}</label>)}</fieldset> : <label className="block text-sm">Your answer<textarea value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy || !!current.evaluation} maxLength={4000} className="mt-2 block min-h-24 w-full rounded-lg border p-3" /></label>}
          <label className="block text-sm">Your reasoning (optional)<textarea value={reasoning} onChange={e => setReasoning(e.target.value)} disabled={busy || !!current.evaluation} maxLength={4000} className="mt-2 block w-full rounded-lg border p-3" /></label>
          {!current.evaluation && <button disabled={busy || !answer.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit answer</button>}
        </form>
        {current.evaluation && <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4"><strong>{current.evaluation.answer_correct ? "Answer correct" : "Review the feedback"}</strong><p className="text-sm">{current.evaluation.answer_feedback}</p><p className="text-sm">{current.evaluation.reasoning_feedback}</p><p className="text-sm">Expected answer: {current.question.type === "mcq" ? current.question.options.find(o => o.key === current.correctAnswer)?.text || String(current.correctAnswer) : String(current.correctAnswer)}</p><p className="text-sm">{current.explanation}</p>{current.evaluation.needs_review && <p className="text-sm">This evaluation needs review. Your recall rating remains your choice.</p>}<p className="pt-2 text-sm font-semibold">How well did you recall this?</p><div className="flex flex-wrap gap-2">{["Again", "Hard", "Good", "Easy"].map((label, index) => <button key={label} disabled={busy} type="button" className="rounded-lg border bg-white px-4 py-2 text-sm" onClick={() => void act(async () => { const key = `${current.id}:${index + 1}`; if (!ratings.current.has(key)) ratings.current.set(key, crypto.randomUUID()); show(await request<Session>({ action: "rate_item", itemId: current.id, rating: index + 1, requestId: ratings.current.get(key) })); await loadHome(); })}>{label}</button>)}</div></div>}
      </> : <p className="text-sm">Session finished. Your reviews are saved. Questions that became unavailable were skipped without changing their history.</p>}
    </section>}
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-semibold">Saved sessions</h2>{home?.sessions.length ? <ul className="mt-3 space-y-2">{home.sessions.map(s => <li key={s.id}><button type="button" disabled={busy} className="text-left text-sm text-blue-700 underline" onClick={() => void act(async () => show(await request<Session>(undefined, `?session=${encodeURIComponent(s.id)}`)))}>{s.mode === "COURSE" ? "Course" : "Random"} · {s.status.toLowerCase()} · {new Date(s.updatedAt).toLocaleString()}</button></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Your saved revision sessions will appear here.</p>}</section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="font-semibold">Recent review history</h2><ul className="mt-3 space-y-3">{home?.history.map(h => <li key={h.id} className="border-b pb-2 text-sm"><p>{h.question.stem}</p><p className="mt-1 text-slate-600">{h.evaluation.answer_correct ? "Correct answer" : "Answer reviewed"} · {h.review ? ["", "Again", "Hard", "Good", "Easy"][h.review.rating] : "Review saved"}{h.review?.nextReviewAt ? ` · Next review ${new Date(h.review.nextReviewAt).toLocaleString()}` : ""}</p></li>)}</ul>{!home?.history.length && <p className="mt-2 text-sm text-slate-600">No completed revision answers yet.</p>}</section>
  </div>;
}
