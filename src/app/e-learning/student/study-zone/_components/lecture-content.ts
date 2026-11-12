// Proposed presentation-only format. No server currently produces this payload.
export type MathNode = string | { kind: "fraction" | "superscript" | "subscript" | "root" | "row"; children: MathNode[] };
export type LessonBlock =
  | { kind: "text" | "definition" | "note" | "example" | "analogy"; text: string; title?: string }
  | { kind: "equation"; text: string; math?: MathNode }
  | { kind: "table"; columns: string[]; rows: string[][]; title?: string }
  | { kind: "image"; url: string; alt: string; caption?: string };
export interface WorkedExample { title?: string; problem: string; given?: string; required?: string; principle?: string; steps?: string[]; answer?: string; explanation?: string }
export interface KnowledgeCheck { id: string; kind: "multiple_choice" | "short_answer" | "true_false"; question: string; options?: string[] }
export interface EducationalContent {
  version: 1;
  type: "lecture_board" | "quick_answer" | "worked_example" | "revision_notes" | "quiz" | "general_response";
  title?: string; description?: string; course?: string; topic?: string; text?: string;
  objectives?: string[]; introduction?: string; bigIdea?: string;
  sections?: { heading?: string; blocks: LessonBlock[] }[];
  examples?: WorkedExample[]; takeaways?: string[]; questions?: KnowledgeCheck[];
}
// Strict, bounded validation before rendering untrusted optional content. Invalid payloads use reply text.
export function readEducationalContent(value: unknown): EducationalContent | null {
  let nodes = 0;
  const string = (v: unknown): v is string => typeof v === "string" && v.length <= 50000;
  const list = (v: unknown, check: (v: unknown) => boolean): boolean => Array.isArray(v) && v.length <= 200 && v.every(check);
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const optional = (v: Record<string, unknown>, keys: string[]) => keys.every(k => v[k] === undefined || string(v[k]));
  const math = (v: unknown, depth = 0): boolean => ++nodes <= 1000 && depth < 12 && (string(v) || (object(v) && ["fraction", "superscript", "subscript", "root", "row"].includes(String(v.kind)) && list(v.children, child => math(child, depth + 1)) && (v.kind === "row" || (v.children as unknown[]).length === (v.kind === "root" ? 1 : 2))));
  const block = (v: unknown): boolean => {
    if (!object(v)) return false;
    if (["text", "definition", "note", "example", "analogy"].includes(String(v.kind))) return string(v.text) && optional(v, ["title"]);
    if (v.kind === "equation") return string(v.text) && (v.math === undefined || math(v.math));
    if (v.kind === "image") return string(v.url) && /^https:\/\//i.test(v.url) && string(v.alt) && optional(v, ["caption"]);
    return v.kind === "table" && optional(v, ["title"]) && list(v.columns, string) && list(v.rows, row => list(row, string) && (row as unknown[]).length === (v.columns as unknown[]).length);
  };
  if (!object(value) || value.version !== 1 || !["lecture_board", "quick_answer", "worked_example", "revision_notes", "quiz", "general_response"].includes(String(value.type)) || !optional(value, ["title", "description", "course", "topic", "text", "introduction", "bigIdea"])) return null;
  for (const key of ["objectives", "takeaways"]) if (value[key] !== undefined && !list(value[key], string)) return null;
  if (value.sections !== undefined && !list(value.sections, s => object(s) && optional(s, ["heading"]) && list(s.blocks, block))) return null;
  if (value.examples !== undefined && !list(value.examples, e => object(e) && string(e.problem) && optional(e, ["title", "given", "required", "principle", "answer", "explanation"]) && (e.steps === undefined || list(e.steps, string)))) return null;
  if (value.questions !== undefined && !list(value.questions, q => object(q) && string(q.id) && string(q.question) && ["multiple_choice", "short_answer", "true_false"].includes(String(q.kind)) && (q.options === undefined || list(q.options, string)) && (q.kind !== "multiple_choice" || (Array.isArray(q.options) && q.options.length > 0)))) return null;
  const hasContent = ["title", "description", "text", "introduction", "bigIdea"].some(key => typeof value[key] === "string" && (value[key] as string).trim()) || ["objectives", "sections", "examples", "takeaways", "questions"].some(key => Array.isArray(value[key]) && (value[key] as unknown[]).length > 0);
  if (!hasContent && !["quick_answer", "general_response"].includes(String(value.type))) return null;
  return value as unknown as EducationalContent;
}
