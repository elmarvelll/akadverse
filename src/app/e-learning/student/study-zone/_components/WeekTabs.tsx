"use client";

// The course's weeks as document tabs sitting on top of the viewer (the active tab joins the reading surface below
// it, like an open document in a word processor). A real ARIA tablist: arrow keys / Home / End move between weeks,
// and only the active tab is in the Tab order.

import { useEffect, useRef } from "react";
import type { StudyWeek } from "@/services/e-learning/student/study-zone";

export const weekTabId = (week: number) => `study-week-tab-${week}`;
export const WEEK_PANEL_ID = "study-week-panel";

export default function WeekTabs({ weeks, active, onSelect }: { weeks: StudyWeek[]; active: number; onSelect: (week: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible inside the strip (scrolls the strip only, never the page).
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>(`#${weekTabId(active)}`);
    if (!list || !tab) return;
    const l = list.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (t.left < l.left || t.right > l.right) {
      list.scrollBy({ left: t.left - l.left - (l.width - t.width) / 2, behavior: "smooth" });
    }
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    const index = weeks.findIndex((w) => w.weekNumber === active);
    const next =
      e.key === "ArrowRight" ? Math.min(weeks.length - 1, index + 1)
      : e.key === "ArrowLeft" ? Math.max(0, index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? weeks.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    const week = weeks[next].weekNumber;
    onSelect(week);
    document.getElementById(weekTabId(week))?.focus();
  }

  return (
    <div ref={listRef} role="tablist" aria-label="Course weeks" onKeyDown={onKeyDown} className="flex shrink-0 items-end gap-1 overflow-x-auto px-1 pt-0.5 -mb-px" style={{ scrollbarWidth: "thin" }}>
      {weeks.map((w) => {
        const selected = w.weekNumber === active;
        const empty = w.documents.length === 0;
        return (
          <button
            key={w.weekNumber}
            id={weekTabId(w.weekNumber)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={WEEK_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(w.weekNumber)}
            title={w.topic ? `Week ${w.weekNumber}: ${w.topic}` : `Week ${w.weekNumber}: no material yet`}
            className={`w-36 shrink-0 rounded-t-xl border px-3 pb-1.5 pt-1.5 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
              selected
                ? "relative z-[1] border-gray-200 border-b-white bg-white shadow-[inset_0_3px_0_#2563eb]"
                : "border-transparent bg-gray-100 hover:bg-gray-200/80"
            }`}
          >
            <span className={`block text-[11px] font-bold uppercase leading-4 tracking-wide ${selected ? "text-blue-700" : "text-gray-700"}`}>Week {w.weekNumber}</span>
            <span className={`block truncate text-[13px] leading-5 ${selected ? "font-medium text-gray-900" : empty ? "italic text-gray-600" : "text-gray-800"}`}>{w.topic ?? "No material"}</span>
          </button>
        );
      })}
    </div>
  );
}
