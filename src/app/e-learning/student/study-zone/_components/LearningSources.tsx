"use client";

import FilePreview from "./AttachmentPreview";
import { groupLearningSources } from "@/lib/stewart/learning-sources";
import type { ExplanationSource } from "@/services/e-learning/ai-ingest/client";

export default function LearningSources({ sources = [], id, attachmentFiles }: { sources?: ExplanationSource[]; id: string; attachmentFiles?: ReadonlyMap<string, File> }) {
  const { references, generatedExamples } = groupLearningSources(sources);
  if (!references.length && !generatedExamples) return null;
  return <details id={id} className="mt-5 max-w-full border-t border-slate-100 pt-3 text-xs text-slate-500">
    <summary className="w-fit cursor-pointer rounded py-1 font-medium hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600">View learning sources</summary>
    {!!references.length && <ol aria-label="Learning sources" className="mt-3 space-y-2 pl-1">{references.map((source, index) => <li key={source.key} className="flex min-w-0 items-start gap-2">
      <span className="shrink-0">[{index + 1}]</span>
      {source.attachmentId && attachmentFiles?.get(source.attachmentId) && /\.(png|jpe?g|webp)$/i.test(attachmentFiles.get(source.attachmentId)!.name) && <FilePreview file={attachmentFiles.get(source.attachmentId)!} />}
      <div className="min-w-0 break-words">
        {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-slate-700 underline underline-offset-2">{source.title}</a> : <span className="text-slate-700">{source.title}</span>}
        <span className="ml-2 text-slate-400">{source.kind === "attachment" ? "Attached file" : source.kind === "external" ? "External reference" : "Course material"}</span>
      </div>
    </li>)}</ol>}
    {generatedExamples && <p className="mt-3">Illustrative examples were created by Stewart.</p>}
  </details>;
}
