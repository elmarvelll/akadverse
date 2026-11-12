import type { ExplanationSource } from "@/services/e-learning/ai-ingest/client";

export interface LearningSource {
  key: string;
  title: string;
  kind: "course" | "attachment" | "external";
  url?: string;
  attachmentId?: string;
  // Original entries remain intact in the API; grouping is presentation only.
  entries: ExplanationSource[];
}
export function safeLearningUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Invalid links render as text. */ }
}
export function groupLearningSources(sources: ExplanationSource[] = []): { references: LearningSource[]; generatedExamples: boolean } {
  const grouped = new Map<string, LearningSource>();
  let generatedExamples = false;
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || typeof source.title !== "string") continue;
    if (source.source_type === "ai_generated" || source.material_type === "AI_GENERATED") { generatedExamples = true; continue; }
    const attachment = source.source_type === "attachment" || source.material_type === "ATTACHMENT";
    const url = safeLearningUrl(source.url);
    const kind = attachment ? "attachment" : url ? "external" : "course";
    const title = attachment ? source.filename || source.title : source.title;
    const key = attachment ? `attachment:${source.attachment_id || title}` : source.document_id ? `document:${source.document_id}` : `${kind}:${url || title}`;
    const current = grouped.get(key);
    if (current) current.entries.push(source);
    else grouped.set(key, { key, title, kind, ...(url ? { url } : {}), ...(source.attachment_id ? { attachmentId: source.attachment_id } : {}), entries: [source] });
  }
  return { references: [...grouped.values()], generatedExamples };
}

// Identical filenames on different documents are ambiguous; leave those prose citations untouched.
export function learningCitations(references: LearningSource[]) {
  const groups = references.map((source) => [...new Set(source.entries.flatMap((s) => [s.title, ...(s.filename ? [s.filename] : [])]))]);
  return groups.map((names, index) => ({ names: names.filter((name) => groups.filter((group) => group.includes(name)).length === 1), number: index + 1 }));
}
