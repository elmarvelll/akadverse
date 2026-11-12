"use client";

// Polls /api/e-learning/classroom/[sessionId]/state. `refresh()` lets an action update the screen immediately instead of
// waiting for the next tick. Pauses while the tab is hidden, and stops once the class has ended.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClassroomState } from "@/services/e-learning/classroom/state";

const POLL_MS = 3000;

export function useClassroomState(sessionId: string) {
  const [state, setState] = useState<ClassroomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ended = useRef(false);

  const refresh = useCallback(async () => {
    if (ended.current) return;
    try {
      const res = await fetch(`/api/e-learning/classroom/${sessionId}/state`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load the class.");
      ended.current = !data.live;
      setState(data);
      setError(null);
    } catch (e) {
      // A dropped request is normal on mobile data; keep the last good state and retry on the next tick.
      setError(e instanceof Error ? e.message : "Connection problem.");
    }
  }, [sessionId]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  return { state, error, refresh };
}
