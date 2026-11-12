"use client";

// Error boundary for every E-Learning page. Without it, any failure while loading a page (a database hiccup, a request the
// server refused) fell through to a bare framework error page. In production Next.js hides the real message, so this shows
// a friendly, generic explanation with a retry and a way back, plus the reference `digest` an administrator can search
// for in the server logs. It is deliberately different from the "empty" state (a page that loaded fine and has no rows).

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ElearningError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <AlertTriangle className="mx-auto text-red-700" size={28} aria-hidden />
      <h1 className="mt-3 text-lg font-bold text-red-900">This page couldn&apos;t be loaded</h1>
      <p className="mt-1 text-sm text-red-900">Something went wrong on our side, or you may not have access to this page. Your data is safe.</p>
      {error.digest && <p className="mt-2 text-xs text-red-800">Reference: {error.digest}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={retrying}
          onClick={() => startTransition(() => { router.refresh(); reset(); })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70"
        >
          <RotateCw size={14} className={retrying ? "animate-spin" : ""} aria-hidden /> {retrying ? "Retrying…" : "Try again"}
        </button>
        <Link href="/" className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-50">Go to my dashboard</Link>
      </div>
    </div>
  );
}
