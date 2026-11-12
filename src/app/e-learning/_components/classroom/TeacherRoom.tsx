"use client";

// The lecturer's live class: the stage with presenter controls, the "Do you understand?" button + live tally, the
// question queue, and End class. State comes from useClassroomState (polling); every button is a Server Action that
// re-checks the caller teaches this class.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, Loader2, PhoneOff, ThumbsDown, ThumbsUp, X } from "lucide-react";
import LiveStage from "./LiveStage";
import { useClassroomState } from "./useClassroomState";
import { callAction } from "./callAction";
import { closePollAction, endClassAction, resolveQuestionAction, startPollAction } from "./actions";

export default function TeacherRoom({ sessionId, courseLabel, backHref }: { sessionId: string; courseLabel: string; backHref: string }) {
  const router = useRouter();
  const { state, refresh } = useClassroomState(sessionId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

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

  if (state && !state.live) {
    return <Ended backHref={backHref} message="This class has ended." />;
  }

  const poll = state?.poll;
  const total = (poll?.yes ?? 0) + (poll?.no ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden /> Live
          </p>
          <h1 className="text-xl font-bold text-gray-900">{courseLabel}</h1>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="@container"><div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start">
        <LiveStage
          sessionId={sessionId}
          isTeacher
          controls={
            confirmEnd ? (
              <div className="flex items-center gap-2 py-2 text-sm">
                <span className="text-white">End the class for everyone?</span>
                <button type="button" disabled={pending} onClick={() => run(() => endClassAction(sessionId), () => router.push(backHref))} className="rounded-full bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  Yes, end
                </button>
                <button type="button" onClick={() => setConfirmEnd(false)} className="rounded-full px-3 py-2 font-medium text-gray-200 hover:bg-white/10">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmEnd(true)} className="my-2 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-white">
                <PhoneOff size={16} aria-hidden /> End class
              </button>
            )
          }
        />

        <aside className="space-y-4 @3xl:w-80 @3xl:shrink-0">
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-900">Do you understand?</h2>
            <p className="mt-0.5 text-xs text-gray-700">Pops up for every student. They answer Yes or No.</p>
            {poll && (
              <div className="mt-3 space-y-1.5" aria-live="polite">
                <Bar label="Yes" count={poll.yes ?? 0} total={total} color="bg-green-600" />
                <Bar label="No" count={poll.no ?? 0} total={total} color="bg-red-600" />
                <p className="text-xs text-gray-700">{total} response{total === 1 ? "" : "s"}{poll.open ? " so far" : " · closed"}</p>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => startPollAction(sessionId))} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60">
                {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <HelpCircle size={14} aria-hidden />}
                {poll ? "Ask again" : "Ask now"}
              </button>
              {poll?.open && (
                <button type="button" disabled={pending} onClick={() => run(() => closePollAction(sessionId, poll.id))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60">
                  Close
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-900">
              Questions {state && state.questions.length > 0 && <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">{state.questions.length}</span>}
            </h2>
            {!state || state.questions.length === 0 ? (
              <p className="mt-2 text-sm text-gray-700">No questions yet.</p>
            ) : (
              <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto">
                {state.questions.map((q) => (
                  <li key={q.id} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm text-gray-900">{q.body}</p>
                    <p className="mt-1 text-xs text-gray-700">
                      {q.askedBy}
                      {q.votes > 0 && <span className="ml-2 inline-flex items-center gap-1 font-medium text-blue-800"><ThumbsUp size={12} aria-hidden />{q.votes} me too</span>}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={pending} onClick={() => run(() => resolveQuestionAction(sessionId, q.id, "ANSWERED"))} className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-60">
                        <Check size={12} aria-hidden /> Answered
                      </button>
                      <button type="button" disabled={pending} onClick={() => run(() => resolveQuestionAction(sessionId, q.id, "DISMISSED"))} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-900 hover:bg-white disabled:opacity-60">
                        <X size={12} aria-hidden /> Dismiss
                      </button>
                    </div>
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

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-gray-900">
      <span className="flex w-9 items-center gap-1">{label === "Yes" ? <ThumbsUp size={12} aria-hidden /> : <ThumbsDown size={12} aria-hidden />}{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} /></div>
      <span className="w-8 text-right tabular-nums">{count}</span>
    </div>
  );
}

export function Ended({ backHref, message }: { backHref: string; message: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <p className="text-base font-semibold text-gray-900">{message}</p>
      <a href={backHref} className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Back to Classroom</a>
    </div>
  );
}
