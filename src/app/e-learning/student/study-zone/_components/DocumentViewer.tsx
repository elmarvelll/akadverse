"use client";

// The reading surface: ONE document at a time. The workspace keys this component by document id, so switching week
// (or document) unmounts the previous viewer entirely — nothing is rendered and hidden.
//
// This file is the toolbar (title, type, open/download, capture, full screen); each format's content comes from its own viewer
// in ./viewers, chosen through VIEWERS:
//   - PDF:  PDF.js canvases at display scale and device pixel ratio (viewers/PdfViewer.tsx).
//   - PPTX: the actual slides, drawn from the file's content (viewers/PowerPointViewer.tsx + office/pptx.ts).
//   - DOCX: the actual document as a page (viewers/WordViewer.tsx + office/docx.ts).
//   - anything else (ZIP): download only.
// All of them fetch through the access route, which re-checks the student's registration on every request.

import { captureRegion, type CaptureRect } from "./capture-region";
import { checkStewartAttachment } from "@/lib/stewart/config";
import { useEffect, useRef, useState } from "react";
import { Crop, Download, ExternalLink, FileArchive, FileText, Loader2, Maximize2, Minimize2, Presentation } from "lucide-react";
import { formatSize } from "@/app/e-learning/_components/DocumentLink";
import type { StudyDocument, StudyDocumentKind } from "@/services/e-learning/student/study-zone";
import { GENERIC_ERROR, requestDocumentUrl } from "./office/document-access";
import PdfViewer from "./viewers/PdfViewer";
import PowerPointViewer from "./viewers/PowerPointViewer";
import WordViewer from "./viewers/WordViewer";
import { StatusCard } from "./viewers/ViewerStates";

const KIND_META: Record<StudyDocumentKind, { label: string; Icon: typeof FileText; color: string }> = {
  pdf: { label: "PDF", Icon: FileText, color: "text-red-700" },
  pptx: { label: "PowerPoint", Icon: Presentation, color: "text-orange-700" },
  docx: { label: "Word", Icon: FileText, color: "text-blue-700" },
  other: { label: "ZIP archive", Icon: FileArchive, color: "text-amber-700" },
};

export default function DocumentViewer({ doc, onCapture, captureRequest = 0 }: { doc: StudyDocument; onCapture: (file: File) => void; captureRequest?: number }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [selecting, setSelecting] = useState(false);
  const [seenCaptureRequest, setSeenCaptureRequest] = useState(captureRequest);
  if (seenCaptureRequest !== captureRequest) { setSeenCaptureRequest(captureRequest); setSelecting(true); }
  const [preparing, setPreparing] = useState(false);
  const [selection, setSelection] = useState<CaptureRect | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const captureButton = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { label, Icon, color } = KIND_META[doc.kind];
  const Viewer = VIEWERS[doc.kind];

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!selecting) return;
    overlayRef.current?.focus();
    const cancel = () => { origin.current = null; setSelection(null); setSelecting(false); captureButton.current?.focus(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } };
    let initialSize: string | null = null;
    const resize = new ResizeObserver(([entry]) => {
      const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
      if (initialSize !== null && size !== initialSize) cancel();
      initialSize = size;
    });
    if (surfaceRef.current) resize.observe(surfaceRef.current);
    const onResize = () => cancel();
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("keydown", key, true); resize.disconnect(); };
  }, [selecting]);

  async function finishSelection(rect: CaptureRect) {
    if (rect.width < 12 || rect.height < 12) { setActionError("Select an area at least 12 × 12 pixels."); setSelection(null); return; }
    setPreparing(true);
    setActionError(null);
    try {
      const file = await captureRegion(surfaceRef.current!, rect, doc.kind === "pdf");
      const problem = checkStewartAttachment(file.name, file.size);
      if (problem) throw new Error(problem);
      onCapture(file);
      setSelecting(false);
      captureButton.current?.focus();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Couldn't capture this area. Please try again."); }
    finally { setPreparing(false); setSelection(null); origin.current = null; }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  };

  // PDF opens in a new tab (the browser shows it); other formats download. A fresh URL every time: they expire in 60s.
  async function openOrDownload() {
    setBusy(true);
    setActionError(null);
    // Open the tab synchronously, inside the click, so pop-up blockers allow it; point it at the file once we have it.
    const tab = doc.kind === "pdf" ? window.open("", "_blank") : null;
    if (tab) tab.opener = null;
    try {
      const url = await requestDocumentUrl(doc.id, doc.kind === "pdf");
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setActionError(e instanceof Error ? e.message : GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const iconButton = "flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600";

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 px-3 py-2 sm:px-4">
        <Icon size={20} className={`shrink-0 ${color}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-gray-900" title={doc.title}>{doc.title}</h2>
          <p className="truncate text-xs text-gray-700">
            <span className="font-semibold">{label}</span> · {doc.category} · {formatSize(doc.fileSize)} · {doc.rangeLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={openOrDownload} disabled={busy} aria-label={doc.kind === "pdf" ? `Open ${doc.title} in a new tab` : `Download ${doc.title}`} title={doc.kind === "pdf" ? "Open in new tab" : "Download"} className={iconButton}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : doc.kind === "pdf" ? <ExternalLink size={16} aria-hidden /> : <Download size={16} aria-hidden />}
          </button>
          {doc.kind !== "other" && <button ref={captureButton} type="button" disabled={preparing} aria-pressed={selecting} title="Select an area to attach to Stewart" onClick={() => { setActionError(null); setSelecting((v) => !v); setSelection(null); }} className={`${iconButton} w-auto gap-1 px-2`}><Crop size={16} aria-hidden /><span className="text-xs">Capture</span></button>}
          {doc.kind !== "other" && (
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "View full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} className={iconButton}>
              {fullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
            </button>
          )}
        </div>
        {actionError && <p role="alert" className="w-full text-xs text-red-800">{actionError}</p>}
      </div>
      <div className="relative min-h-0 flex-1 bg-gray-50">
        <div ref={surfaceRef} className="absolute inset-0">
        <Viewer doc={doc} onDownload={openOrDownload} busy={busy} />
        </div>
        {selecting && <div ref={overlayRef} tabIndex={-1} aria-label="Drag to select a screenshot area. Escape cancels." className="absolute inset-0 z-20 touch-none cursor-crosshair overflow-hidden bg-blue-950/10 outline-none"
          onPointerDown={(e) => {
            if (preparing || e.button !== 0 || !e.isPrimary || (e.target as Element).closest("button")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            origin.current = { x: e.clientX, y: e.clientY };
            setSelection(null);
          }}
          onPointerMove={(e) => {
            if (!origin.current || preparing) return;
            const b = e.currentTarget.getBoundingClientRect();
            const x = Math.min(b.right, Math.max(b.left, e.clientX));
            const y = Math.min(b.bottom, Math.max(b.top, e.clientY));
            setSelection({ x: Math.min(origin.current.x, x) - b.left, y: Math.min(origin.current.y, y) - b.top, width: Math.abs(x - origin.current.x), height: Math.abs(y - origin.current.y) });
          }}
          onPointerUp={(e) => {
            if (!origin.current || preparing) return;
            const b = e.currentTarget.getBoundingClientRect();
            const x = Math.min(b.right, Math.max(b.left, e.clientX)), y = Math.min(b.bottom, Math.max(b.top, e.clientY));
            const rect = { x: Math.min(origin.current.x, x), y: Math.min(origin.current.y, y), width: Math.abs(x - origin.current.x), height: Math.abs(y - origin.current.y) };
            origin.current = null;
            void finishSelection(rect);
          }}
          onPointerCancel={() => { origin.current = null; setSelection(null); }}
          onLostPointerCapture={() => { origin.current = null; }}
        >
          <div className="absolute left-2 top-2 flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-xs text-blue-950 shadow"><span role="status">{preparing ? "Preparing screenshot…" : "Selecting area… Drag over the document"}</span><button type="button" disabled={preparing} className="font-semibold underline" onClick={() => { setSelecting(false); setSelection(null); origin.current = null; captureButton.current?.focus(); }}>Cancel</button></div>
          {selection && <div className="pointer-events-none absolute border-2 border-blue-600 bg-blue-100/10" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}
        </div>}
      </div>
    </div>
  );
}

interface ViewerProps {
  doc: StudyDocument;
  onDownload: () => void;
  busy: boolean;
}

const VIEWERS: Record<StudyDocumentKind, (props: ViewerProps) => React.ReactNode> = {
  pdf: PdfViewer,
  pptx: PowerPointViewer,
  docx: WordViewer,
  other: DownloadOnlyViewer,
};

function DownloadOnlyViewer({ doc, onDownload, busy }: ViewerProps) {
  return (
    <StatusCard tone="neutral" title={doc.title} body="This is a ZIP archive. Download it to see the files inside.">
      <button type="button" onClick={onDownload} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Download size={14} aria-hidden />} {busy ? "Preparing…" : "Download"}
      </button>
    </StatusCard>
  );
}
