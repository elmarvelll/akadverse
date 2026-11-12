"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { requestDocumentUrl } from "../office/document-access";
import { LoadError, PageSkeleton } from "./ViewerStates";
import type { StudyDocument } from "@/services/e-learning/student/study-zone";

export default function PdfViewer({ doc }: { doc: StudyDocument }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(100, entry.contentRect.width - 32)));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    (async () => {
      const lib = await import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = "/api/e-learning/pdfjs/build/pdf.worker.min.mjs";
      const url = await requestDocumentUrl(doc.id, true);
      if (cancelled) return;
      task = lib.getDocument({ url, cMapUrl: "/api/e-learning/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/api/e-learning/pdfjs/standard_fonts/", wasmUrl: "/api/e-learning/pdfjs/wasm/", isEvalSupported: false });
      const loaded = await task.promise;
      if (!cancelled) setPdf(loaded);
    })().catch(() => { if (!cancelled) setError("This PDF couldn't be rendered. Retry or use Open in new tab."); });
    return () => { cancelled = true; void task?.destroy(); };
  }, [doc.id, attempt]);
  return <div ref={root} className="absolute inset-0 flex flex-col">
    <div data-capture-exclude className="flex justify-center gap-3 border-b bg-white p-1 text-xs">
      <button type="button" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>+</button>
    </div>
    {error ? <LoadError message={error} onRetry={() => { setError(null); setPdf(null); setAttempt((n) => n + 1); }} /> : !pdf ? <PageSkeleton label={`Loading ${doc.title}`} /> : <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4" aria-label={`${doc.title}, PDF pages`}>
      {Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={i} pdf={pdf} number={i + 1} width={width * zoom} />)}
    </div>}
  </div>;
}

function PdfPage({ pdf, number, width }: { pdf: PDFDocumentProxy; number: number; width: number }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(1.414);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "600px" });
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    const target = canvas.current!;
    target.removeAttribute("data-pdf-ready");
    (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const natural = page.getViewport({ scale: 1 });
      setRatio(natural.height / natural.width);
      const scale = width / natural.width;
      const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1), Math.sqrt(16_000_000 / (width * width * natural.height / natural.width)));
      const viewport = page.getViewport({ scale: scale * dpr });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      render = page.render({ canvas: target, viewport });
      await render.promise;
      if (!cancelled) { target.dataset.pdfReady = "true"; setError(false); }
    })().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; render?.cancel(); target.removeAttribute("data-pdf-ready"); };
  }, [pdf, number, width, visible]);
  return <div ref={wrapper} className="relative mx-auto bg-white shadow" style={{ width, height: width * ratio }}>
    <canvas ref={canvas} aria-label={`Page ${number}`} className="h-full w-full" />
    {error && <p role="alert" className="absolute inset-0 bg-white p-4 text-sm text-red-800">Page {number} could not be rendered. Reopen the document to retry.</p>}
  </div>;
}
