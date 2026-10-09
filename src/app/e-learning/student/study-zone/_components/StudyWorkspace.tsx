"use client";

// One course's study workspace: week tabs on top of the document viewer, Stewart beside it. The selected week (and,
// when a week has several documents, the selected document) is the single piece of state everything else follows:
// the tab highlight, the one mounted viewer, and Stewart's "Studying" context.
//
// Layout — sized from the space actually available, so it follows the sidebar's collapsed/expanded state:
//  - Width: the root is a CSS container. Once IT is at least 56rem wide (not the viewport), document and Stewart sit
//    side by side, Stewart fixed at 18rem (22rem from a 72rem container), so the document gets ~70-75%. Narrower,
//    they stack, document first.
//  - Height: the document fills the viewport below the course header: 100dvh minus the app header (4rem), <main>'s
//    vertical padding (2rem, 3rem from `sm`), the course header (h-9) and the gap (0.75rem). The PDF scrolls inside
//    its own viewer; the page itself doesn't scroll when side by side.
// The root is `isolate`, so the active tab's small z-index can't escape into the shell's stacking order (header,
// sidebar, mobile drawer).

import { useState } from "react";
import { FileText } from "lucide-react";
import type { StudyCourse, StudyWeek } from "@/services/e-learning/student/study-zone";
import WeekTabs, { WEEK_PANEL_ID, weekTabId } from "./WeekTabs";
import DocumentViewer from "./DocumentViewer";
import { StatusCard } from "./viewers/ViewerStates";
import StewartPanel from "./StewartPanel";
import BackToStudyZone from "./BackToStudyZone";

export default function StudyWorkspace({ course, weeks }: { course: StudyCourse; weeks: StudyWeek[] }) {
  const [activeWeek, setActiveWeek] = useState(() => weeks.find((w) => w.documents.length > 0)?.weekNumber ?? weeks[0].weekNumber);
  const [chosenDoc, setChosenDoc] = useState<Record<number, string>>({});

  const week = weeks.find((w) => w.weekNumber === activeWeek) ?? weeks[0];
  const doc = week.documents.find((d) => d.id === chosenDoc[week.weekNumber]) ?? week.documents[0] ?? null;
  const nextWithMaterial = weeks.find((w) => w.weekNumber > week.weekNumber && w.documents.length > 0) ?? weeks.find((w) => w.documents.length > 0);
  const weeksWithMaterial = weeks.filter((w) => w.documents.length > 0).length;

  return (
    <div className="isolate @container space-y-3">
      <div className="flex h-9 items-center gap-3">
        <BackToStudyZone />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold leading-5 text-gray-900 sm:text-base sm:leading-5" title={`${course.code} — ${course.title}`}>
            <span className="font-bold text-blue-800">{course.code}</span> — {course.title}
          </h1>
          <p className="truncate text-xs leading-4 text-gray-700">
            {course.sessionName} · {course.semesterName} · {weeksWithMaterial} of {weeks.length} weeks have material
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-[minmax(0,1fr)_18rem] @6xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex h-[calc(100dvh-9rem)] min-h-[24rem] min-w-0 flex-col sm:h-[calc(100dvh-10rem)]">
          <WeekTabs weeks={weeks} active={week.weekNumber} onSelect={setActiveWeek} />
          <div id={WEEK_PANEL_ID} role="tabpanel" aria-labelledby={weekTabId(week.weekNumber)} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl rounded-tr-2xl border border-gray-200 bg-white">
            {week.documents.length > 1 && (
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-100 px-4 py-2" role="group" aria-label={`Documents for Week ${week.weekNumber}`}>
                <span className="shrink-0 text-xs font-semibold text-gray-700">This week:</span>
                {week.documents.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={d.id === doc?.id}
                    onClick={() => setChosenDoc((c) => ({ ...c, [week.weekNumber]: d.id }))}
                    className={`max-w-[14rem] shrink-0 truncate rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      d.id === doc?.id ? "border-blue-700 bg-blue-700 text-white" : "border-gray-300 bg-white text-gray-800 hover:border-blue-400"
                    }`}
                  >
                    {d.category}: {d.title}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {doc ? (
                // Keyed by id: switching unmounts the previous viewer, so only one document is ever rendered.
                <DocumentViewer key={doc.id} doc={doc} />
              ) : (
                <StatusCard tone="neutral" title={`No material for Week ${week.weekNumber} yet`} body="Your lecturer hasn't uploaded anything for this week.">
                  {nextWithMaterial && nextWithMaterial.weekNumber !== week.weekNumber && (
                    <button
                      type="button"
                      onClick={() => setActiveWeek(nextWithMaterial.weekNumber)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-blue-400"
                    >
                      <FileText size={14} aria-hidden /> Go to Week {nextWithMaterial.weekNumber}
                    </button>
                  )}
                </StatusCard>
              )}
            </div>
          </div>
        </div>

        <StewartPanel
          className="h-[34rem] @4xl:h-[calc(100dvh-10rem)] @4xl:min-h-[24rem]"
          context={{ courseCode: course.code, weekNumber: week.weekNumber, documentTitle: doc?.title ?? null }}
          threadKey={`w${week.weekNumber}-${doc?.id ?? "none"}`}
          studyingLabel={`Week ${week.weekNumber} · ${doc?.title ?? "no material yet"}`}
        />
      </div>
    </div>
  );
}
