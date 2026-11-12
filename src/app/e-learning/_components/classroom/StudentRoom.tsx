"use client";

// A student's live class: watch the stream, raise a hand to ask a (text) question, "me too" other students' questions,
// and answer the lecturer's "Do you understand?" poll, which pops up over the bottom-left of the video.

import { useState, useTransition } from "react";
import { Hand, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import LiveStage from "./LiveStage";
import { Ended } from "./TeacherRoom";
import { useClassroomState } from "./useClassroomState";
import { callAction } from "./callAction";
import { askQuestionAction, respondToPollAction, toggleVoteAction } from "./actions";

const MAX = 300;

export default function StudentRoom({ sessionId, courseLabel, backHref }: { sessionId: string; courseLabel: string; backHref: string }) {
  const { state, refresh } = useClassroomState(sessionId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await callAction(fn);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setError(null);
        after?.();
        await refresh();
      }
    });

  if (state && !state.live) return <Ended backHref={backHref} message="This class has ended." />;

  const poll = state?.poll?.open ? state.poll : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden /> Live
        </p>
        <h1 className="text-xl font-bold text-gray-900">{courseLabel}</h1>
      </div>

      <div className="@container"><div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start">
        <LiveStage sessionId={sessionId} isTeacher={false} onEnded={refresh}>
          {poll && (
            <div role="dialog" aria-label="Do you understand?" className="absolute bottom-3 left-3 z-10 w-64 rounded-xl bg-white p-3 shadow-xl">
              <p className="text-sm font-bold text-gray-900">Do you understand?</p>
              <div className="mt-2 flex gap-2">
                {(["YES", "NO"] as const).map((answer) => {
                  const chosen = poll.myAnswer === answer;
                  return (
                    <button
                      key={answer}
                      type="button"
                      disabled={pending}
                      aria-pressed={chosen}
                      onClick={() => run(() => respondToPollAction(sessionId, poll.id, answer))}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                        chosen ? (answer === "YES" ? "border-green-700 bg-green-700 text-white" : "border-red-700 bg-red-700 text-white") : "border-gray-300 text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {answer === "YES" ? <ThumbsUp size={14} aria-hidden /> : <ThumbsDown size={14} aria-hidden />}
                      {answer === "YES" ? "Yes" : "No"}
                    </button>
                  );
                })}
              </div>
              {poll.myAnswer && <p className="mt-1.5 text-xs text-gray-700">Thanks. You can change your answer until it closes.</p>}
            </div>
          )}
        </LiveStage>

        <aside className="space-y-4 @3xl:w-80 @3xl:shrink-0">
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            {composing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => askQuestionAction(sessionId, draft), () => {
                    setDraft("");
                    setComposing(false);
                  });
                }}
                className="space-y-2"
              >
                <label htmlFor="question" className="text-sm font-bold text-gray-900">Your question</label>
                <textarea
                  id="question"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={MAX}
                  rows={3}
                  placeholder="Type what you'd like the lecturer to explain…"
                  className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm text-gray-900 focus:border-blue-700 focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700">{draft.length}/{MAX}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setComposing(false); setError(null); }} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100">Cancel</button>
                    <button type="submit" disabled={pending || !draft.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60">
                      {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Send
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setComposing(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-900">
                <Hand size={16} aria-hidden /> Raise hand to ask
              </button>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-900">Class questions</h2>
            {!state || state.questions.length === 0 ? (
              <p className="mt-2 text-sm text-gray-700">No questions yet. Be the first to ask.</p>
            ) : (
              <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                {state.questions.map((q) => (
                  <li key={q.id} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                    <p className="flex-1 text-sm text-gray-900">
                      {q.body}
                      {q.mine && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">You</span>}
                    </p>
                    <button
                      type="button"
                      disabled={pending || q.mine}
                      aria-pressed={q.votedByMe}
                      aria-label={`Me too, ${q.votes} so far`}
                      onClick={() => run(() => toggleVoteAction(sessionId, q.id))}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                        q.votedByMe ? "border-blue-800 bg-blue-800 text-white" : "border-gray-300 text-gray-900 hover:bg-white"
                      }`}
                    >
                      <ThumbsUp size={12} aria-hidden /> {q.votes}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div></div>
    </div>
  );
}
