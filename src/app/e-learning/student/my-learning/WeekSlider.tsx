"use client";

// Weekly Course Content: a horizontal week slider (scroll-snap strip of week chips + prev/next), not a
// dropdown. Choosing a week shows that week's materials grouped Notes / Assignments / Quizzes. A
// material that spans several weeks arrives once per week from the SAME database row.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DocumentLink from "@/app/e-learning/_components/DocumentLink";

export interface WeekItem { id: string; title: string; description: string | null; fileName: string; mimeType: string; fileSize: number; rangeLabel: string }
export interface WeekGroup { type: string; label: string; icon: string; items: WeekItem[] }
export interface WeekData { week: number; groups: WeekGroup[] }

export default function WeekSlider({ weeks }: { weeks: WeekData[] }) {
  const firstWithContent = weeks.find((w) => w.groups.length > 0)?.week ?? weeks[0]?.week ?? 1;
  const [selected, setSelected] = useState(firstWithContent);
  const stripRef = useRef<HTMLDivElement>(null);
  const current = weeks.find((w) => w.week === selected) ?? weeks[0];

  // Keep the selected chip in view when moving with prev/next.
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>(`[data-week="${selected}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  if (!current) return null;
  const go = (delta: number) => setSelected((w) => Math.min(weeks.length, Math.max(1, w + delta)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous week" onClick={() => go(-1)} disabled={selected <= 1} className="shrink-0 rounded-full border border-gray-300 bg-white p-2 text-gray-900 disabled:opacity-40"><ChevronLeft size={16} /></button>
        <div ref={stripRef} data-testid="week-slider" className="flex flex-1 snap-x snap-mandatory gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {weeks.map((w) => (
            <button
              key={w.week}
              type="button"
              data-week={w.week}
              aria-pressed={w.week === selected}
              onClick={() => setSelected(w.week)}
              className={`snap-center shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap ${w.week === selected ? "border-blue-700 bg-blue-700 text-white" : w.groups.length ? "border-blue-300 bg-blue-50 text-blue-900" : "border-gray-300 bg-white text-gray-900"}`}
            >
              Week {w.week}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Next week" onClick={() => go(1)} disabled={selected >= weeks.length} className="shrink-0 rounded-full border border-gray-300 bg-white p-2 text-gray-900 disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>

      <div data-testid="week-content" className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-bold text-gray-900">Week {current.week}</h3>
        {current.groups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-800">No materials for this week yet.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {current.groups.map((g) => (
              <div key={g.type}>
                <h4 className="text-sm font-semibold text-gray-900"><span aria-hidden>{g.icon}</span> {g.label}</h4>
                <ul className="mt-2 space-y-2">
                  {g.items.map((m) => (
                    <li key={m.id}>
                      <DocumentLink id={m.id} title={m.title} mimeType={m.mimeType} fileSize={m.fileSize} detail={m.rangeLabel} />
                      {m.description && <p className="mt-1 px-1 text-xs text-gray-800">{m.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
