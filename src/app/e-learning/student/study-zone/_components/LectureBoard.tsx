"use client";

import { createElement, useId, useState, type ReactNode } from "react";
import { readEducationalContent, type EducationalContent, type KnowledgeCheck, type LessonBlock, type MathNode } from "./lecture-content";

import LearningMarkdown from "./LearningMarkdown";
import LearningSources from "./LearningSources";
import { groupLearningSources, learningCitations } from "@/lib/stewart/learning-sources";
import type { ExplanationSource } from "@/services/e-learning/ai-ingest/client";

export function MessageText({ text }: { text: string }) { return <LearningMarkdown text={text} />; }
function mathNode(node: MathNode): ReactNode {
  if (typeof node === "string") return createElement("mtext", null, node);
  const tag = { fraction: "mfrac", superscript: "msup", subscript: "msub", root: "msqrt", row: "mrow" }[node.kind];
  return createElement(tag, null, ...node.children.map(mathNode));
}
function Block({ block }: { block: LessonBlock }) {
  if (block.kind === "equation") return <div className="overflow-x-auto py-3 font-serif text-lg" aria-label={block.text}>{block.math ? createElement("math", { display: "block", "aria-label": block.text }, mathNode(block.math)) : <span className="whitespace-pre-wrap">{block.text}</span>}</div>;
  if (block.kind === "table") return <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><caption className="pb-2 text-left font-semibold">{block.title}</caption><thead><tr>{block.columns.map((c, i) => <th key={i} scope="col" className="border-b-2 p-2">{c}</th>)}</tr></thead><tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="min-w-28 border-b p-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div>;
  if (block.kind === "image") return <figure>
    {/* eslint-disable-next-line @next/next/no-img-element -- supplied remote illustration with no optimization contract */}
    <img src={block.url} alt={block.alt} loading="lazy" referrerPolicy="no-referrer" className="max-h-96 max-w-full object-contain" /><figcaption className="mt-1 text-xs text-gray-600">{block.caption}</figcaption></figure>;
  return <div className={block.kind === "text" ? "" : "border-l-2 border-blue-300 bg-blue-50/50 py-2 pl-3 pr-2"}>{block.title && <h5 className="mb-1 font-semibold">{block.title}</h5>}{block.kind !== "text" && !block.title && <p className="mb-1 text-xs font-semibold capitalize text-blue-900">{block.kind}</p>}<MessageText text={block.text} /></div>;
}
function Check({ question, onAnswer, disabled }: { question: KnowledgeCheck; onAnswer?: (text: string) => void; disabled?: boolean }) {
  const [answer, setAnswer] = useState("");
  const id = useId();
  const options = question.kind === "true_false" ? ["True", "False"] : question.options;
  return <fieldset className="space-y-2 border-t border-gray-200 pt-3"><legend className="pt-3 font-medium">{question.question}</legend>{question.kind === "short_answer" ? <textarea aria-label="Your answer" value={answer} onChange={e => setAnswer(e.target.value)} className="w-full rounded-lg border bg-white p-2" /> : options?.map((option, i) => <label key={i} className="flex items-start gap-2"><input type="radio" name={id} checked={answer === option} onChange={() => setAnswer(option)} className="mt-1" />{option}</label>)}{onAnswer && <button type="button" disabled={disabled || !answer.trim()} onClick={() => onAnswer(`Knowledge check: ${question.question}\nMy answer: ${answer}`)} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-40">Discuss answer with Stewart</button>}</fieldset>;
}
function Points({ title, items }: { title: string; items?: string[] }) {
  return items?.length ? <section><h4 className="mb-2 font-semibold text-gray-900">{title}</h4><ul className="list-disc space-y-1 pl-5">{items.map((item, i) => <li key={i}><MessageText text={item} /></li>)}</ul></section> : null;
}
export function LectureBoard({ content, onAnswer, disabled }: { content: EducationalContent; onAnswer?: (text: string) => void; disabled?: boolean }) {
  return <article aria-label={content.title || "Lecture notes"} className="max-w-prose space-y-5 text-sm leading-relaxed">
    {(content.title || content.description || content.course || content.topic) && <header className="border-b border-gray-200 pb-3">{(content.course || content.topic) && <p className="text-xs font-medium text-blue-800">{[content.course, content.topic].filter(Boolean).join(" · ")}</p>}{content.title && <h3 className="mt-1 text-lg font-bold tracking-tight">{content.title}</h3>}{content.description && <p className="mt-2 text-gray-600">{content.description}</p>}</header>}
    <Points title="Learning objectives" items={content.objectives} />
    {content.introduction && <section><h4 className="mb-2 font-semibold">Introduction</h4><MessageText text={content.introduction} /></section>}
    {content.bigIdea && <aside className="rounded-lg border-l-4 border-blue-600 bg-blue-50 p-3"><h4 className="mb-1 font-semibold text-blue-900">Key concept</h4><MessageText text={content.bigIdea} /></aside>}
    {content.text && <MessageText text={content.text} />}
    {content.sections?.map((section, i) => <section key={i} className="space-y-3">{section.heading && <h4 className="text-base font-semibold">{section.heading}</h4>}{section.blocks.map((block, j) => <Block key={j} block={block} />)}</section>)}
    {content.examples?.map((example, i) => <section key={i} className="space-y-3 border-t border-gray-200 pt-4"><h4 className="font-semibold">{example.title || `Worked example ${i + 1}`}</h4>{([['Problem', example.problem], ['Given', example.given], ['Required', example.required], ['Principle', example.principle]] as const).map(([label, text]) => text && <div key={label}><h5 className="text-xs font-semibold text-gray-600">{label}</h5><MessageText text={text} /></div>)}{example.steps && <ol className="list-decimal space-y-2 pl-5">{example.steps.map((step, j) => <li key={j}><MessageText text={step} /></li>)}</ol>}{example.answer && <div className="rounded-lg bg-blue-50 p-3"><strong>Final answer</strong><MessageText text={example.answer} /></div>}{example.explanation && <MessageText text={example.explanation} />}</section>)}
    <Points title="Key takeaways" items={content.takeaways} />
    {!!content.questions?.length && <section className="space-y-3"><h4 className="font-semibold">Knowledge checks</h4>{content.questions.map((question, i) => <Check key={`${question.id}-${i}`} question={question} onAnswer={onAnswer} disabled={disabled} />)}</section>}
  </article>;
}
export default function StewartResponse({ text, sources, attachmentFiles, educational, onAnswer, disabled }: { text: string; sources?: ExplanationSource[]; attachmentFiles?: ReadonlyMap<string, File>; educational?: unknown; onAnswer?: (text: string) => void; disabled?: boolean }) {
  const content = readEducationalContent(educational);
  const sourcesId = `learning-sources-${useId().replace(/:/g, "")}`;
  const { references } = groupLearningSources(sources);
  const citations = learningCitations(references);
  return <article aria-label="Stewart explanation" className="mx-auto w-full min-w-0 max-w-prose py-2">
    {content && content.type !== "general_response" && content.type !== "quick_answer" ? <LectureBoard content={content} onAnswer={onAnswer} disabled={disabled} /> : <LearningMarkdown text={content?.type === "quick_answer" ? content.text || text : text} citations={citations} sourcesId={sourcesId} />}
    <LearningSources sources={sources} id={sourcesId} attachmentFiles={attachmentFiles} />
  </article>;
}
