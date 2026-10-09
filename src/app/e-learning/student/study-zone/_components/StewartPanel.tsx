"use client";

// Stewart's chat panel, beside the document viewer. Each week+document gets its own conversation (kept while you
// switch weeks, so coming back restores it), and the header always shows what Stewart is studying with you.
// Content comes only from ./stewart.ts, which is a mock — no AI service is called.

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { askStewart, startThread, STEWART_SUGGESTIONS, type StewartContext, type StewartMessage } from "./stewart";

// `threadKey` identifies the conversation (one per week + document); `studyingLabel` is the context line in the header.
// `className` carries the height, which the workspace sets for its stacked / side-by-side layouts.
export default function StewartPanel({ context, threadKey, studyingLabel, className = "" }: { context: StewartContext; threadKey: string; studyingLabel: string; className?: string }) {
  const [threads, setThreads] = useState<Record<string, StewartMessage[]>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLOListElement>(null);

  const messages = threads[threadKey] ?? startThread(context, threadKey);
  const typing = pendingKey === threadKey;
  const untouched = !threads[threadKey];

  // Keep the newest message in view (scrolls the log only, never the page).
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, typing, threadKey]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pendingKey) return;
    const key = threadKey;
    const asked = { ...context };
    setDraft("");
    setThreads((t) => ({ ...t, [key]: [...(t[key] ?? startThread(asked, key)), { id: `${key}-${Date.now()}`, role: "student", text: question }] }));
    setPendingKey(key);
    try {
      const reply = await askStewart(question, asked);
      setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { id: `${key}-${Date.now()}-s`, role: "stewart", text: reply }] }));
    } catch {
      setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { id: `${key}-${Date.now()}-e`, role: "stewart", text: "Sorry, I couldn't answer that just now. Please try again." }] }));
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section aria-label="Stewart, AI study assistant" className={`flex min-h-0 min-w-0 flex-col rounded-2xl border border-gray-200 bg-white ${className}`}>
      <header className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">Stewart</h2>
            <p className="text-xs text-gray-700">AI Study Assistant</p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-200">Preview</span>
        </div>
        <p aria-live="polite" className="mt-2.5 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <BookOpen size={14} className="mt-px shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold">Studying:</span> {studyingLabel}
          </span>
        </p>
      </header>

      <ol ref={logRef} role="log" aria-label="Conversation with Stewart" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "student" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-gray-100 text-gray-900"}`}>
              <span className="sr-only">{m.role === "student" ? "You" : "Stewart"}: </span>
              {m.text}
            </div>
          </li>
        ))}
        {typing && (
          <li className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-gray-100 px-3.5 py-2.5 text-sm text-gray-700">
              <Loader2 size={14} className="animate-spin" aria-hidden /> Stewart is typing…
            </div>
          </li>
        )}
      </ol>

      <div className="border-t border-gray-100 p-3">
        {untouched && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {STEWART_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={!!pendingKey}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="stewart-input" className="sr-only">Ask Stewart a question</label>
          <textarea
            id="stewart-input"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a new line.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask Stewart…"
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim() || !!pendingKey}
            aria-label="Send message to Stewart"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <SendHorizontal size={16} aria-hidden />
          </button>
        </form>
        <p className="mt-2 text-[11px] text-gray-600">Stewart is in preview and isn&apos;t connected to AI yet.</p>
      </div>
    </section>
  );
}
