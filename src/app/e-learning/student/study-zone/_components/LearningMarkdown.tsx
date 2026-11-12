"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { safeLearningUrl } from "@/lib/stewart/learning-sources";
import { remarkLearningPresentation, type LearningMarkdownOptions } from "./learning-markdown";

// Typography stays scoped to the answer, including in the narrow split-screen composer.
const typography = [
  "min-w-0 max-w-full text-[0.9375rem] leading-7 text-slate-800 [overflow-wrap:anywhere]",
  "[&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:tracking-tight",
  "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-snug",
  "[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold",
  "[&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:my-3 [&_strong]:font-semibold",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:my-1",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600",
  "[&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2 [&_hr]:my-6 [&_hr]:border-slate-200",
  "[&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2",
  "[&_.katex]:text-[1.05em] [&_.katex]:max-w-full [&_.katex]:inline-block [&_.katex]:align-middle [&_.katex]:overflow-x-auto [&_.katex]:overflow-y-hidden [&_input]:mr-2",
].join(" ");
export default function LearningMarkdown({ text, citations, sourcesId }: { text: string } & LearningMarkdownOptions) {
  return <div className={typography} data-learning-markdown>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, [remarkLearningPresentation, { citations, sourcesId }]]}
      rehypePlugins={[[rehypeKatex, { trust: false, throwOnError: false, maxExpand: 1000, maxSize: 10 }]]}
      skipHtml
      urlTransform={(url) => url.startsWith("#") ? url : safeLearningUrl(url) ?? ""}
      components={{
        a: ({ href, children }) => href ? <a href={href} {...(href.startsWith("#") ? {
          onClick: () => {
            const details = document.getElementById(href.slice(1));
            if (details instanceof HTMLDetailsElement) details.open = true;
          },
        } : { target: "_blank", rel: "noopener noreferrer" })}>{children}</a> : <span>{children}</span>,
        table: ({ children }) => <div role="region" aria-label="Scrollable table" tabIndex={0} className="my-4 max-w-full overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
        th: ({ children, style }) => <th style={style} className="min-w-28 border-b-2 border-slate-300 px-3 py-2 font-semibold">{children}</th>,
        td: ({ children, style }) => <td style={style} className="min-w-28 border-b border-slate-200 px-3 py-2 align-top">{children}</td>,
        pre: ({ children }) => <pre tabIndex={0} className="my-4 max-w-full overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">{children}</pre>,
        code: ({ className, children }) => <code className={`${className ?? ""} rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.875em] text-slate-900 [pre_&]:bg-transparent [pre_&]:p-0 [pre_&]:text-inherit`}>{children}</code>,
        // An explanation cannot initiate remote image requests. Existing attachments use authorized local previews.
        img: ({ alt }) => <span className="text-sm text-slate-500">{alt}</span>,
      }}
    >{text}</ReactMarkdown>
  </div>;
}
