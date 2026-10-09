"use client";

// The actual PDF, rendered in-page by the browser's own PDF viewer (scrolling, page navigation, zoom and search come
// with it — no PDF library is needed), opened fitted to the panel's width with the thumbnail pane closed. Phone
// browsers that can't show a PDF inside a page still have the toolbar's "Open in new tab".

import { useEffect, useState } from "react";
import { GENERIC_ERROR, requestDocumentUrl } from "../office/document-access";
import { LoadError, PageSkeleton } from "./ViewerStates";
import type { StudyDocument } from "@/services/e-learning/student/study-zone";

export default function PdfViewer({ doc }: { doc: StudyDocument }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string }>({ status: "loading" });
  const [frameLoaded, setFrameLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    requestDocumentUrl(doc.id, true).then(
      (url) => !cancelled && setState({ status: "ready", url }),
      (e: unknown) => !cancelled && setState({ status: "error", message: e instanceof Error ? e.message : GENERIC_ERROR }),
    );
    return () => {
      cancelled = true;
    };
  }, [doc.id, attempt]);

  if (state.status === "error") {
    return (
      <LoadError
        message={state.message}
        onRetry={() => {
          setState({ status: "loading" });
          setFrameLoaded(false);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }
  return (
    <>
      {state.status === "ready" && (
        <iframe src={`${state.url}#navpanes=0&view=FitH`} title={`${doc.title} (PDF)`} onLoad={() => setFrameLoaded(true)} className="absolute inset-0 h-full w-full border-0" />
      )}
      {!frameLoaded && <PageSkeleton label={`Loading ${doc.title}`} />}
    </>
  );
}
