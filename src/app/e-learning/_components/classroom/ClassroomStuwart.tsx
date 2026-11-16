"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import type { ClassroomLesson } from "@/services/e-learning/classroom/lesson";
import type { ExplanationSource } from "@/services/e-learning/ai-ingest/client";
import StuwartResponse from "@/app/e-learning/student/study-zone/_components/LectureBoard";
import { useFollowLatest } from "@/app/components/scroll/useFollowLatest";
import { JumpToLatest } from "@/app/components/scroll/JumpToLatest";
interface Message { id: string; role: string; content: string; metadata?: { sources?: ExplanationSource[] } }
type Props = { sessionId: string; lesson: ClassroomLesson | null };
export default function ClassroomStuwart(props: Props) {
  return <ClassroomLessonStuwart key={`${props.sessionId}:${props.lesson?.version ?? 0}`} {...props} />;
}
function ClassroomLessonStuwart({ sessionId, lesson }: Props) {
  const [open, setOpen] = useState(false); const [loaded, setLoaded] = useState(false); const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<{ question: string; requestId: string } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const launcher = useRef<HTMLButtonElement>(null); const close = useRef<HTMLButtonElement>(null);
  const key = `${sessionId}:${lesson?.version ?? 0}`;
  const aliveContext = useRef<string | null>(key); const reducedMotion = useReducedMotion();
  const { ref: logRef, paused, follow } = useFollowLatest<HTMLDivElement>(`${key}:${open}`);
  const endpoint = `/api/e-learning/classroom/${encodeURIComponent(sessionId)}/stuwart`;
  useEffect(() => { aliveContext.current = key; return () => { aliveContext.current = null; }; }, [key]);
  useEffect(() => { if (open) close.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async res => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Couldn't restore this lesson conversation.");
      if (data.lesson?.version !== lesson?.version) throw new Error("The lesson changed. Wait for the class to refresh and reopen Stuwart.");
      if (!controller.signal.aborted) { setMessages(data.messages); setLoaded(true); setError(""); }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't load Stuwart."); });
    return () => controller.abort();
  }, [open, key, endpoint, lesson?.version, loadAttempt]);
  function hide() { setOpen(false); launcher.current?.focus(); }
  async function send() {
    if (!loaded || !lesson || busy || !draft.trim()) return;
    const currentKey = key; const question = draft.trim(); const requestId = retry?.question === question ? retry.requestId : crypto.randomUUID();
    setRetry({ question, requestId }); setBusy(true); setError("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, requestId, lessonVersion: lesson.version }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || "Couldn't answer. Try again shortly.");
      if (aliveContext.current !== currentKey) return;
      setMessages(previous => previous.some(m => m.id === result.messageId) ? previous : [...previous, { id: `${requestId}-user`, role: "USER", content: question }, { id: result.messageId, role: "ASSISTANT", content: result.answer, metadata: { sources: result.sources } }]);
      setDraft(""); setRetry(null);
    } catch (e) { if (aliveContext.current === currentKey) setError(e instanceof Error ? e.message : "Connection problem. Retry the same question."); }
    finally { if (aliveContext.current === currentKey) setBusy(false); }
  }
  return <>
    <button ref={launcher} type="button" aria-label="Open Stuwart lesson assistant" aria-expanded={open} aria-controls="classroom-stuwart" onClick={() => setOpen(v => !v)} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-blue-800 px-4 py-3 font-semibold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"><MessageCircle size={20} aria-hidden /> Stuwart</button>
    <AnimatePresence>{open && <motion.section id="classroom-stuwart" role="dialog" aria-label="Stuwart lesson assistant" initial={reducedMotion ? false : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reducedMotion ? { opacity: 1 } : { x: 40, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .2 }} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); hide(); } }} className="fixed bottom-20 right-3 z-40 flex h-[min(38rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl">
      <header className="flex items-start justify-between gap-2 border-b p-4"><div><h2 className="font-bold">Stuwart</h2><p className="text-xs">{lesson ? `Week ${lesson.week} · ${lesson.topic}` : "Waiting for the lecturer to select a lesson"}</p></div><button ref={close} type="button" aria-label="Close Stuwart" onClick={hide} className="rounded p-2 hover:bg-gray-100"><X size={18} /></button></header>
      <p className="border-b bg-blue-50 px-4 py-2 text-xs">I can help with the selected topic and course materials for this week. I cannot see or hear the live class. Describe any diagram or slide you mean.</p>
      <div className="relative flex min-h-0 flex-1"><div ref={logRef} role="log" aria-label="Lesson conversation" className="min-h-0 w-full space-y-3 overflow-y-auto p-4">
        {!loaded && !error && <p role="status">Loading conversation…</p>}
        {loaded && !messages.length && <p className="text-sm text-gray-600">{lesson ? "Ask for an explanation, example, or help understanding the current topic." : "Your lecturer has not set the current lesson. You can still watch the class and raise your hand."}</p>}
        {messages.map(m => <div key={m.id} className={m.role === "USER" ? "rounded-lg bg-blue-50 p-3 text-sm" : "text-sm"}><p className="font-semibold">{m.role === "USER" ? "You" : "Stuwart"}</p>{m.role === "USER" ? <p className="whitespace-pre-wrap">{m.content}</p> : <StuwartResponse text={m.content} sources={m.metadata?.sources} />}</div>)}
        {busy && <p role="status">Stuwart is thinking…</p>}
      </div>{paused && <JumpToLatest onClick={() => follow(true)} label="Jump to latest message" className="absolute bottom-2 right-2" />}</div>
      {error && <div role="alert" className="px-4 py-2 text-sm text-red-800">{error}{!loaded && <button type="button" onClick={() => setLoadAttempt(v => v + 1)} className="ml-2 underline">Retry loading</button>}</div>}
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="space-y-2 border-t p-3"><label htmlFor="classroom-stuwart-question" className="sr-only">Ask Stuwart about this lesson</label><textarea id="classroom-stuwart-question" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2400} rows={2} disabled={!loaded || !lesson || busy} placeholder="Ask about this lesson…" className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm disabled:opacity-50" /><button disabled={!loaded || !lesson || busy || !draft.trim()} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Answering…" : "Send"}</button></form>
    </motion.section>}</AnimatePresence>
  </>;
}
