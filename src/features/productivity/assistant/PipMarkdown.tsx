"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PipMarkdown({ text }: { text: string }) {
  return <div className="pip-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
    urlTransform={url => /^(https?:\/\/|mailto:|#)/i.test(url) ? url : ""}
    components={{
      a: ({ href, children }) => href ? <a href={href} {...(!href.startsWith("#") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a> : <span>{children}</span>,
      img: ({ alt }) => <span>{alt}</span>,
      table: ({ children }) => <div className="pip-table" role="region" aria-label="Scrollable response table" tabIndex={0}><table>{children}</table></div>,
      pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
    }}>{text}</ReactMarkdown></div>;
}
