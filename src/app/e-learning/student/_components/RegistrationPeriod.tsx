"use client";

// Course registration period banner with a live countdown. The countdown is computed as
// (target timestamp − Date.now()) every second — never a blindly decremented counter, and it
// never polls the database. It is only a display: the server independently rejects every
// add / remove / submit outside the window. When the countdown reaches zero it refreshes the
// page once so the server-rendered state (and the enabled/disabled buttons) catch up.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type Phase = "NOT_CONFIGURED" | "UPCOMING" | "ACTIVE" | "ENDED";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const when = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
// `when` formats in the LOCALE and TIME ZONE of whoever runs it (`undefined` = "this environment's default"): the Node server
// and the student's browser differ ("Sep 13, 2026, 3:01 PM" vs "13 Sept 2026, 15:01"), which made hydration fail. So a date is only
// formatted once the browser clock is live (`now` is 0 for the server render AND for the first client render), and shows a
// placeholder before that — both sides then render identical text, and the student still sees their own locale/time zone.
const DATE_PLACEHOLDER = "…";

// One shared 1-second clock. The server snapshot is 0 (no time known yet), so nothing time-based
// (the countdown OR any locale-formatted date) is rendered until the browser has hydrated — no server/client mismatch.
let clock = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    clock = Date.now();
    timer = setInterval(() => { clock = Date.now(); listeners.forEach((l) => l()); }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; }
  };
}
const useNow = () => useSyncExternalStore(subscribe, () => clock || (clock = Date.now()), () => 0);

export default function RegistrationPeriod({ phase, startAt, endAt }: { phase: Phase; startAt: string | null; endAt: string | null }) {
  const router = useRouter();
  const target = phase === "UPCOMING" ? startAt : phase === "ACTIVE" ? endAt : null;
  const now = useNow();
  const remaining = target && now ? new Date(target).getTime() - now : null;
  const fmt = (iso: string) => (now ? when(iso) : DATE_PLACEHOLDER);

  // Reaching the target changes the phase on the server — refresh once to pick it up.
  const refreshed = useRef(false);
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [remaining, router]);

  if (phase === "NOT_CONFIGURED") {
    return <div role="status" className="rounded-2xl border border-gray-300 bg-gray-50 p-4 text-sm font-medium text-gray-900">Course registration is not currently available.</div>;
  }
  if (phase === "ENDED") {
    return (
      <div role="status" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">Course registration is closed.</p>
        {endAt && <p className="mt-0.5">It closed on {fmt(endAt)}. You can still view your courses and registration status.</p>}
      </div>
    );
  }

  const t = remaining !== null ? parts(remaining) : null;
  const upcoming = phase === "UPCOMING";
  return (
    <div role="status" className={`rounded-2xl border p-4 ${upcoming ? "border-amber-300 bg-amber-50 text-amber-950" : "border-green-300 bg-green-50 text-green-950"}`}>
      <p className="text-sm font-semibold">{upcoming ? "Registration opens in" : "Registration closes in"}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" aria-live="off">
        {t ? `${t.d} Days ${t.h} Hours ${t.m} Minutes ${t.s} Seconds` : "…"}
      </p>
      <p className="mt-1 text-xs">
        {startAt && <>Opens {fmt(startAt)}</>}{startAt && endAt && " · "}{endAt && <>Closes {fmt(endAt)}</>}
      </p>
      {upcoming && <p className="mt-2 text-sm">You can look at your courses now, but selecting and registering is only possible once registration opens.</p>}
    </div>
  );
}
