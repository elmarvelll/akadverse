"use client";

// One course's study workspace: week tabs on top of the document viewer, Stewart beside it. The selected week and the
// selected document (by stable id — see study-selection.ts) are the single piece of state everything else follows:
// the tab highlight, the week's document dropdown, the one mounted viewer, and Stewart's "Studying" context.
//
// A week can hold several documents (main note, supplementary reading, worked examples…). Opening a week shows its
// first document; the dropdown lists them all and switching loads exactly that document into the same viewer.
// Changing week never carries a document id across weeks: each week has its own remembered pick, and a pick that no
// longer exists falls back to the week's first document (with a notice).
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

import { STEWART_MAX_ATTACHMENTS } from "@/lib/stewart/config";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Loader2, RefreshCw } from "lucide-react";
import type { StudyCourse, StudyWeek } from "@/services/e-learning/student/study-zone";
import WeekTabs, { WEEK_PANEL_ID, weekTabId } from "./WeekTabs";
import DocumentViewer from "./DocumentViewer";
import { StatusCard } from "./viewers/ViewerStates";
import StewartPanel from "./StewartPanel";
import BackToStudyZone from "./BackToStudyZone";
import { documentOptionLabels, initialWeek, resolveSelection, type ChosenDocuments } from "./study-selection";

export default function StudyWorkspace({ course, weeks }: { course: StudyCourse; weeks: StudyWeek[] }) {
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [captureRequest, setCaptureRequest] = useState(0);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [activeWeek, setActiveWeek] = useState(() => initialWeek(weeks));
  const [chosenDoc, setChosenDoc] = useState<ChosenDocuments>({});

  const { week, document: doc, chosenIsGone } = resolveSelection(weeks, activeWeek, chosenDoc);
  const threadKey = `w${week.weekNumber}-${doc?.id ?? "none"}`;
  const optionLabels = documentOptionLabels(week.documents);
  // Re-reads the course's documents from the server (the lecturer may have added or removed one since this page
  // loaded) without resetting the week, the conversation, or anything else on the page.
  const refreshDocuments = () => startRefresh(() => router.refresh());
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
            {week.documents.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-100 px-3 py-2 sm:px-4">
                <label htmlFor="study-document-select" className="shrink-0 text-xs font-semibold text-gray-700">
                  Week {week.weekNumber} documents
                </label>
                <div className="relative min-w-0 flex-1 sm:max-w-md">
                  <select
                    id="study-document-select"
                    // Controlled by the id of the document actually mounted below, so the two can't drift apart.
                    value={doc?.id ?? ""}
                    onChange={(e) => setChosenDoc((c) => ({ ...c, [week.weekNumber]: e.target.value }))}
                    className="w-full appearance-none truncate rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    {week.documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {optionLabels.get(d.id)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
                </div>
                <span className="shrink-0 text-xs text-gray-600">
                  {week.documents.length} document{week.documents.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={refreshDocuments}
                  disabled={refreshing}
                  aria-label="Check for new or removed documents"
                  title="Check for new or removed documents"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {refreshing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
                </button>
                {chosenIsGone && (
                  <p role="status" className="w-full text-xs text-amber-800">
                    The document you had open is no longer available. Showing {doc ? `"${doc.title}"` : "this week's material"} instead.
                  </p>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {doc ? (
                // Keyed by id: switching unmounts the previous viewer, so only one document is ever rendered.
                <DocumentViewer key={doc.id} doc={doc} captureRequest={captureRequest} onCapture={(file) => { if ((pendingFiles[threadKey]?.length ?? 0) >= STEWART_MAX_ATTACHMENTS) throw new Error(`Use at most ${STEWART_MAX_ATTACHMENTS} pending files.`); setPendingFiles((all) => ({ ...all, [threadKey]: [...(all[threadKey] ?? []), file] })); }} />
              ) : (
                <StatusCard tone="neutral" title={`No material for Week ${week.weekNumber} yet`} body={chosenIsGone ? "The document you had open is no longer available, and this week has no other material." : "Your lecturer hasn't uploaded anything for this week."}>
                  <button
                    type="button"
                    onClick={refreshDocuments}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:border-blue-400 disabled:opacity-60"
                  >
                    {refreshing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />} Check again
                  </button>
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
          files={pendingFiles[threadKey] ?? []}
          onFilesChange={(files) => setPendingFiles((all) => ({ ...all, [threadKey]: typeof files === "function" ? files(all[threadKey] ?? []) : files }))}
          onRetake={() => setCaptureRequest((n) => n + 1)}
          className="h-[34rem] @4xl:h-[calc(100dvh-10rem)] @4xl:min-h-[24rem]"
          context={{ courseId: course.id, courseCode: course.code, weekNumber: week.weekNumber, documentId: doc?.id ?? null, documentTitle: doc?.title ?? null }}
          threadKey={`w${week.weekNumber}-${doc?.id ?? "none"}`}
          studyingLabel={`Week ${week.weekNumber} · ${doc?.title ?? "no material yet"}`}
        />
      </div>
    </div>
  );
}
