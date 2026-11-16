"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StewartContext } from "./stewart";
type Concept = { id: string; title: string; description: string };
type Attempt = { attemptId: string; question: { question_text: string; question_type: string; options: string[] } };
type Evaluation = { answer_correct: boolean; answer_feedback: string; reasoning_feedback: string };
type Card = { id: string; version: number; question: { stem: string; options: { key: string; text: string }[]; conceptTitle: string } };
const endpoint = "/api/e-learning/revision";
export default function RevisionPracticePanel({ context }: { context: StewartContext }) {
  const [open, setOpen] = useState(false), [concepts, setConcepts] = useState<Concept[]>([]), [concept, setConcept] = useState("");
  const [attempt, setAttempt] = useState<Attempt>(), [answer, setAnswer] = useState(""), [reasoning, setReasoning] = useState("");
  const [feedback, setFeedback] = useState<Evaluation>(), [status, setStatus] = useState(""), [eventId, setEventId] = useState("");
  const [cards, setCards] = useState<Card[]>([]), [revealed, setRevealed] = useState<Record<string, { correctAnswer: string | boolean; explanation: string }>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const alive = useRef(true), pending = useRef(false), attemptKey = useRef(""), reviewKeys = useRef(new Map<string, string>());
  const controllers = useRef(new Set<AbortController>());
  useEffect(() => { alive.current = true; const active = controllers.current; return () => { alive.current = false; for (const c of active) c.abort(); }; }, []);
  async function request<T>(input?: Record<string, unknown>, query = ""): Promise<T> {
    const controller = new AbortController(); controllers.current.add(controller); const timer = setTimeout(() => controller.abort(), 80000);
    try {
      const response = await fetch(endpoint + query, { method: input ? "POST" : "GET", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", signal: controller.signal, ...(input ? { body: JSON.stringify({ ...context, ...input }) } : {}) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "The learning request could not be completed."); if (!alive.current) throw new Error("Study context changed."); return body.result;
    } finally { clearTimeout(timer); controllers.current.delete(controller); }
  }
  async function act(work: () => Promise<void>) {
    if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { if (alive.current) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "The connection ended before this request was confirmed. Refresh before retrying."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => {
    if (!eventId || !open) return;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch(`${endpoint}?event=${encodeURIComponent(eventId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json(); if (!response.ok) return;
        if (alive.current) setStatus(body.result.generation?.status === "COMPLETED" ? "Your revision questions are ready. Refresh your due cards." : body.result.generation?.status === "NEEDS_REVIEW" || body.result.generation?.status === "FAILED" ? "Your revision generation needs review. Your passed teaching event has been preserved." : "Revision questions are queued for background generation.");
      } catch { /* Existing status stays visible; refresh remains available. */ }
    };
    void poll(); const timer = setInterval(() => void poll(), 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [eventId, open]);
  async function loadCards() { setCards(await request<Card[]>()); }
  return <details className="shrink-0 border-b border-gray-200 bg-slate-50 px-3 py-2 text-xs" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer py-1 font-semibold text-slate-800">Practice &amp; spaced revision</summary>
    {open && <div className="mt-2 max-h-[45vh] space-y-3 overflow-y-auto pb-2">
      {context.documentId ? <>
        <button type="button" disabled={busy} onClick={() => void act(async () => { const result = await request<{ status: string; concepts: Concept[] }>({ action: "prepare_concepts" }); setConcepts(result.concepts); setConcept(result.concepts[0]?.id || ""); setStatus(result.concepts.length ? "Select a concept for independent practice." : `Concept preparation: ${result.status.toLowerCase()}. Refresh after background processing.`); })} className="rounded border bg-white px-2 py-1">Load / refresh material concepts</button>
        {!!concepts.length && <><label className="block">Concept<select className="mt-1 w-full rounded border p-1" disabled={busy} value={concept} onChange={e => { setConcept(e.target.value); attemptKey.current = ""; setAttempt(undefined); setFeedback(undefined); }}><option value="">Select a concept</option>{concepts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button type="button" disabled={busy || !concept || !!attempt} className="rounded border bg-white px-2 py-1" onClick={() => void act(async () => { if (!attemptKey.current) attemptKey.current = crypto.randomUUID(); const value = await request<Attempt>({ action: "practice", conceptId: concept, requestId: attemptKey.current }); setAttempt(value); setFeedback(undefined); setAnswer(""); setReasoning(""); })}>Start independent practice</button></>}
        {attempt && <form className="space-y-2" onSubmit={e => { e.preventDefault(); void act(async () => { const result = await request<{ evaluation: Evaluation; passed: boolean; teachingEventId?: string }>({ action: "evaluate", attemptId: attempt.attemptId, answer, reasoning }); setFeedback(result.evaluation); setEventId(result.teachingEventId || ""); setStatus(result.passed ? "Teaching stage passed. Revision generation has been queued." : "Keep practising. Review the feedback before starting another attempt."); }); }}>
          <p className="font-medium">{attempt.question.question_text}</p>
          {attempt.question.options?.map((option, i) => <p key={i}>{option}</p>)}
          <label className="block">Your answer<textarea className="mt-1 w-full rounded border p-2" maxLength={4000} value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy || !!feedback}/></label>
          <label className="block">Explain your reasoning<textarea className="mt-1 w-full rounded border p-2" maxLength={4000} value={reasoning} onChange={e => setReasoning(e.target.value)} disabled={busy || !!feedback}/></label>
          <button className="rounded border bg-white px-2 py-1" disabled={busy || !answer.trim() || !!feedback}>Check my understanding</button>
          {!!feedback && <button type="button" disabled={busy} className="ml-2 underline" onClick={() => { setAttempt(undefined); setFeedback(undefined); attemptKey.current = ""; }}>New practice attempt</button>}
        </form>}
        {feedback && <div className="rounded border bg-white p-2"><strong>{feedback.answer_correct ? "Answer correct" : "Review your answer"}</strong><p>{feedback.answer_feedback}</p><p>{feedback.reasoning_feedback}</p></div>}
      </> : <p>Select a course material to prepare concepts and practise.</p>}
      <p role="status">{busy ? "Working…" : status}</p>
      <p><Link href="/e-learning/student/revisions" className="font-semibold text-blue-700 underline">Open Revisions for Course and Random practice →</Link></p>
      <div className="border-t pt-2"><strong>Due revision cards</strong><button type="button" className="ml-2 underline" disabled={busy} onClick={() => void act(loadCards)}>Refresh due cards</button>
        {cards.map(card => <article key={card.id} className="mt-2 rounded border bg-white p-2"><p className="font-medium">{card.question.stem}</p>{card.question.options?.map(option => <p key={option.key}>{option.key}. {option.text}</p>)}
          {!revealed[card.id] ? <button type="button" disabled={busy} className="mt-2 underline" onClick={() => void act(async () => { const result = await request<{ correctAnswer: string | boolean; explanation: string }>({ action: "reveal", cardId: card.id }); setRevealed(all => ({ ...all, [card.id]: result })); })}>Show answer</button> : <><p className="mt-2">Answer: {String(revealed[card.id].correctAnswer)}</p><p>{revealed[card.id].explanation}</p><p className="mt-2">How well did you recall it?</p><div className="mt-1 flex flex-wrap gap-1">{["Again", "Hard", "Good", "Easy"].map((label, index) => <button key={label} type="button" disabled={busy} className="rounded border px-2 py-1" onClick={() => void act(async () => { const key = `${card.id}:${card.version}:${index + 1}`; if (!reviewKeys.current.has(key)) reviewKeys.current.set(key, crypto.randomUUID()); await request({ action: "review", cardId: card.id, rating: index + 1, version: card.version, requestId: reviewKeys.current.get(key) }); await loadCards(); })}>{label}</button>)}</div></>}
        </article>)}
      </div>
      {error && <p role="alert" className="text-red-800">{error}</p>}
    </div>}
  </details>;
}
