"use client";

// Shows a .docx inside Study Zone as a readable page, drawn from the file's own content (office/docx.ts). The page
// scrolls inside the panel.

import { readDocx, type DocxBlock, type DocxRun } from "../office/docx";
import { useOfficeDocument } from "../office/useOfficeDocument";
import { LoadError, PageSkeleton, StatusCard } from "./ViewerStates";
import type { StudyDocument } from "@/services/e-learning/student/study-zone";

const VARIANT: Record<Extract<DocxBlock, { kind: "para" }>["variant"], { tag: "h1" | "h2" | "h3" | "h4" | "p"; cls: string; scale: number }> = {
  title: { tag: "h1", cls: "font-bold mt-2 mb-3", scale: 2.2 },
  subtitle: { tag: "p", cls: "text-gray-700 mb-3", scale: 1.3 },
  h1: { tag: "h2", cls: "font-bold mt-6 mb-2", scale: 1.6 },
  h2: { tag: "h3", cls: "font-bold mt-5 mb-2", scale: 1.35 },
  h3: { tag: "h4", cls: "font-semibold mt-4 mb-1.5", scale: 1.15 },
  h4: { tag: "h4", cls: "font-semibold mt-3 mb-1", scale: 1.05 },
  h5: { tag: "h4", cls: "font-semibold mt-3 mb-1", scale: 1 },
  h6: { tag: "h4", cls: "font-semibold italic mt-3 mb-1", scale: 1 },
  p: { tag: "p", cls: "mb-2", scale: 1 },
};

export default function WordViewer({ doc }: { doc: StudyDocument }) {
  const [state, retry] = useOfficeDocument(doc.id, readDocx);
  if (state.status === "loading") return <PageSkeleton label={`Loading ${doc.title}`} />;
  if (state.status === "error") return <LoadError message={state.message} onRetry={retry} />;
  if (state.doc.blocks.length === 0) return <StatusCard tone="neutral" title="This document is empty." body="Download it to check the file." />;
  return (
    <div tabIndex={0} aria-label={`${doc.title}, document`} className="absolute inset-0 overflow-y-auto bg-gray-100 p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:p-6">
      <article className="mx-auto max-w-3xl rounded-sm bg-white px-5 py-6 text-gray-900 shadow-md ring-1 ring-black/5 sm:px-12 sm:py-12" style={{ fontSize: `${state.doc.baseSizePt}pt`, lineHeight: 1.5 }}>
        <Blocks blocks={state.doc.blocks} base={state.doc.baseSizePt} />
      </article>
    </div>
  );
}

function Blocks({ blocks, base }: { blocks: DocxBlock[]; base: number }) {
  return blocks.map((b, i) => {
    if (b.kind === "table") {
      return (
        <div key={i} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[0.95em]">
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-gray-400 px-2 py-1 align-top [&>*:last-child]:mb-0">
                      <Blocks blocks={cell} base={base} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    const v = VARIANT[b.variant];
    const Tag = v.tag;
    const empty = b.runs.every((r) => !r.text && !r.image && !r.lineBreak);
    return (
      <Tag
        key={i}
        className={`${v.cls} whitespace-pre-wrap`}
        style={{ textAlign: b.align, fontSize: v.scale !== 1 ? `${base * v.scale}pt` : undefined, paddingLeft: b.list ? `${1.5 + b.list.level * 1.5}em` : b.indentPt ? `${b.indentPt}pt` : undefined, position: b.list ? "relative" : undefined }}
      >
        {b.list && (
          <span aria-hidden className="absolute" style={{ left: `${b.list.level * 1.5}em` }}>
            {b.list.marker}
          </span>
        )}
        {empty ? " " : b.runs.map((r, j) => <Run key={j} run={r} />)}
      </Tag>
    );
  });
}

function Run({ run }: { run: DocxRun }) {
  if (run.lineBreak) return <br />;
  if (run.image) {
    // eslint-disable-next-line @next/next/no-img-element -- a blob: URL read from the file itself; next/image can't optimise it
    return <img src={run.image.src} alt="" className="my-2 inline-block h-auto max-w-full" style={{ width: run.image.width || undefined }} />;
  }
  return (
    <span
      style={{
        fontWeight: run.bold ? 700 : undefined,
        fontStyle: run.italic ? "italic" : undefined,
        textDecoration: [run.underline && "underline", run.strike && "line-through"].filter(Boolean).join(" ") || undefined,
        color: run.color ?? undefined,
        fontSize: run.sizePt ? `${run.sizePt}pt` : undefined,
      }}
    >
      {run.text}
    </span>
  );
}
