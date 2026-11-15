"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from "react";
import { loadWorkspaceView, peekWorkspaceView, isWorkspaceViewFresh, invalidateWorkspace } from "../client";
import { productivityErrorMessage } from "../errors";
import { millisecondsToNextMinute } from "../tasks/domain";
import type { ViewOptions, WorkspaceSnapshot } from "./data";
import { localNow } from "../schedule/domain";
import { taskViewStatus } from "../tasks/domain";

export const SectionActivity = createContext(true);
export function useSectionActive() { return useContext(SectionActivity); }
export function useWorkspaceSnapshot(options: ViewOptions) {
  const active = useSectionActive(), key = JSON.stringify(options), currentKey = useRef(key), mounted = useRef(true);
  const paused = useRef(new Set<string>());
  const sequence = useRef(0);
  useLayoutEffect(() => { currentKey.current = key; }, [key]);
  const [state, setState] = useState<{ key: string; value?: WorkspaceSnapshot; cached?: WorkspaceSnapshot }>(() => { const cached = peekWorkspaceView(options); return { key, value: cached, cached }; });
  const [error, setError] = useState(""), [refreshing, setRefreshing] = useState(false), [clock, setClock] = useState(() => new Date());
  const refresh = useCallback(async (throwOnError = false, automatic = false) => {
    if (!active) return;
    const cached = peekWorkspaceView(JSON.parse(key));
    if (cached) setState({ key, value: cached, cached });
    if (automatic && paused.current.has(key)) { if (isWorkspaceViewFresh(JSON.parse(key))) { paused.current.delete(key); setError(""); } return; }
    if (!automatic) paused.current.delete(key);
    const requestSequence = ++sequence.current;
    if (!isWorkspaceViewFresh(JSON.parse(key))) setRefreshing(true);
    try {
      const value = await loadWorkspaceView(JSON.parse(key));
      if (mounted.current && currentKey.current === key && sequence.current === requestSequence) {
        setState({ key, value, cached: peekWorkspaceView(JSON.parse(key)) }); setError(""); setClock(new Date());
        window.dispatchEvent(new CustomEvent("productivity:view-ready", { detail: { section: value && options.section, userId: value.student.id } }));
      }
    } catch (failure) { if (sequence.current === requestSequence) paused.current.add(key); if (mounted.current && currentKey.current === key && sequence.current === requestSequence) setError(productivityErrorMessage(failure, "This section could not be refreshed. Your saved records have not been reset.")); if (throwOnError) throw failure; }
    finally { if (mounted.current && currentKey.current === key && sequence.current === requestSequence) setRefreshing(false); }
  }, [key, active, options.section]);
  useEffect(() => {
    mounted.current = true;
    if (!active) return;
    let cancelled = false;
    // Subscribe after commit; Strict Mode's discarded effect must not start a read.
    void Promise.resolve().then(() => { if (!cancelled) void refresh(false, true); });
    let timer: number, refreshTimer: number, previous = new Date();
    const tick = () => {
      const now = new Date(), snapshot = peekWorkspaceView(JSON.parse(key)); setClock(now);
      if (snapshot && !paused.current.has(key)) {
        const zone = snapshot.student.timezone, midnight = localNow(zone, previous).date !== localNow(zone, now).date;
        const deadline = snapshot.data.tasks.tasks.some(task => taskViewStatus(task, zone, previous) !== taskViewStatus(task, zone, now));
        if (midnight || deadline) { invalidateWorkspace(midnight ? ["today", "tasks", "schedule", "habits", "official"] : ["today", "tasks"]); void refresh(false, true); }
      }
      previous = now; timer = window.setTimeout(tick, millisecondsToNextMinute(now));
    };
    const refreshTick = () => { void refresh(false, true); refreshTimer = window.setTimeout(refreshTick, 60000); };
    const resumed = () => { if (document.visibilityState === "visible") void refresh(false, true); };
    const focused = () => { void refresh(false, true); };
    const reconnected = () => { void refresh(); };
    const changed = (event: Event) => { if ((event as CustomEvent<string[]>).detail.includes(options.section)) void refresh(); };
    timer = window.setTimeout(tick, millisecondsToNextMinute(new Date()));
    refreshTimer = window.setTimeout(refreshTick, 60000);
    window.addEventListener("focus", focused); window.addEventListener("online", reconnected); document.addEventListener("visibilitychange", resumed); window.addEventListener("productivity:invalidated", changed);
    return () => { cancelled = true; window.clearTimeout(timer); window.clearTimeout(refreshTimer); window.removeEventListener("focus", focused); window.removeEventListener("online", reconnected); document.removeEventListener("visibilitychange", resumed); window.removeEventListener("productivity:invalidated", changed); };
  }, [refresh, active, options.section, key]);
  useEffect(() => () => { mounted.current = false; }, []);
  const cached = peekWorkspaceView(options);
  const snapshot = cached && (state.key !== key || cached !== state.cached) ? cached : state.value;
  const setSnapshot = (update: SetStateAction<WorkspaceSnapshot | undefined>) => setState(previous => ({ key, value: typeof update === "function" ? update(previous.value) : update, cached: peekWorkspaceView(options) }));
  return { snapshot, setSnapshot, error, refreshing, clock, refresh, loadingAdditional: state.key !== key && !peekWorkspaceView(options) };
}
