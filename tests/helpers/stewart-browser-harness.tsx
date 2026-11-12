// Bundled only by scripts/verify-stewart-capture.ts; never exposed as an application route.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import DocumentViewer from "../../src/app/e-learning/student/study-zone/_components/DocumentViewer";
import StewartPanel from "../../src/app/e-learning/student/study-zone/_components/StewartPanel";
import type { StudyDocument } from "../../services/e-learning/student/study-zone";
function Harness() {
  const [queueKey, setQueueKey] = useState("test");
  const [queues, setQueues] = useState<Record<string, File[]>>({});
  const files = queues[queueKey] ?? [];
  const setFiles = (update: File[] | ((files: File[]) => File[])) => setQueues((all) => ({ ...all, [queueKey]: typeof update === "function" ? update(all[queueKey] ?? []) : update }));
  const [captureRequest, requestCapture] = useState(0);
  const params = new URLSearchParams(location.search);
  const kind = new URLSearchParams(location.search).get("kind") === "pdf" ? "pdf" : "docx";
  const doc = { id: kind, title: "Engineering lecture", kind, category: "Lecture notes", fileSize: 1000, rangeLabel: "Week 1" } as StudyDocument;
  return <div className="grid h-screen min-w-0 grid-cols-1 gap-3 bg-gray-100 p-3 md:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="h-[600px] min-w-0"><DocumentViewer doc={doc} captureRequest={captureRequest} onCapture={(file) => setFiles((all) => [...all, file])} /></div>
    <StewartPanel onComposerKeyChange={(_thread, view) => setQueueKey(view)} files={files} onFilesChange={setFiles} onRetake={() => requestCapture((n) => n + 1)} context={{ courseId: params.get("courseId") ?? "test", courseCode: "ENG 101", weekNumber: Number(params.get("week") ?? 1), documentId: params.has("courseId") ? null : kind, documentTitle: doc.title }} threadKey="test" studyingLabel="Engineering lecture" className="h-[600px]" />
  </div>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
