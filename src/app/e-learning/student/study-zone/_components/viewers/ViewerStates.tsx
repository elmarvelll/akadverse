// Loading / empty / error surfaces shared by every document viewer.

import { AlertTriangle, FileText, RotateCw } from "lucide-react";
import { Bone } from "@/app/e-learning/_components/Skeletons";
import { GENERIC_ERROR } from "../office/document-access";

// A grey page outline while a document loads, so switching weeks never flashes an empty panel.
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="absolute inset-0 flex justify-center overflow-hidden p-4 sm:p-8">
      <span className="sr-only">{label}…</span>
      <div className="h-full w-full max-w-xl space-y-3 rounded-sm border border-gray-200 bg-white p-6 sm:p-10">
        <Bone className="h-6 w-2/3" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-11/12" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-4/5" />
        <Bone className="mt-6 h-32 w-full" />
      </div>
    </div>
  );
}

export function StatusCard({ tone, title, body, children }: { tone: "neutral" | "error"; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : undefined} className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        {tone === "error" ? <AlertTriangle size={28} className="mx-auto text-red-700" aria-hidden /> : <FileText size={28} className="mx-auto text-gray-500" aria-hidden />}
        <p className={`mt-3 text-base font-bold ${tone === "error" ? "text-red-900" : "text-gray-900"}`}>{title}</p>
        <p className="mt-1 text-sm text-gray-800">{body}</p>
        {children && <div className="mt-4 flex justify-center">{children}</div>}
      </div>
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StatusCard tone="error" title="Unable to load this document." body={message === GENERIC_ERROR ? "Please try again." : message}>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <RotateCw size={14} aria-hidden /> Try again
      </button>
    </StatusCard>
  );
}
