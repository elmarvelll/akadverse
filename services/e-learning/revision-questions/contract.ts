import { RevisionWebhookError } from "./errors";
import { utcTimestamp } from "./security";
export type QuestionType = "mcq" | "short_answer" | "true_false";
export type BloomLevel = "remember" | "understand" | "apply";
export interface RevisionQuestion {
  client_ref: string; type: QuestionType; stem: string; options?: { key: string; text: string }[];
  correct_answer: string | boolean; explanation: string; difficulty_estimate: number; bloom_level: BloomLevel; tags: string[];
}
export interface RevisionPayload {
  event_id: string; teaching_event_id: string; student_id: string; occurred_at: string;
  context: { subject: string; curriculum: string; level: string; topic: string; concept_id: string; concept_title: string; language: string };
  taught_summary: string; questions: RevisionQuestion[];
}
const fail = (field: string): never => { throw new RevisionWebhookError(400, "INVALID_PAYLOAD", `Invalid revision payload field: ${field}.`); };
function object(value: unknown, field: string, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(field);
  const result = value as Record<string, unknown>;
  const unknown = Object.keys(result).find(key => !allowed.includes(key));
  if (unknown !== undefined) return fail(`${field}.${unknown.slice(0, 80)}`);
  return result;
}
function text(value: unknown, field: string, max: number, allowEmpty = false): asserts value is string {
  if (typeof value !== "string" || value.length > max || !allowEmpty && !value.trim() || /\u0000/.test(value)) fail(field);
}
function identifier(value: unknown, field: string) { text(value, field, 200); if (/\s|[\u0000-\u001f\u007f]/.test(value)) fail(field); }
export function parseRevisionPayload(raw: Uint8Array, idempotencyKey: string): RevisionPayload {
  let input: unknown;
  try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { throw new RevisionWebhookError(400, "INVALID_JSON", "The authenticated body must contain valid UTF-8 JSON."); }
  const b = object(input, "body", ["event_id", "teaching_event_id", "student_id", "occurred_at", "context", "taught_summary", "questions"]);
  if (typeof b.event_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.event_id)) fail("event_id");
  for (const key of ["teaching_event_id", "student_id"]) identifier(b[key], key);
  if (idempotencyKey !== `teach_${b.teaching_event_id}`) throw new RevisionWebhookError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be teach_<teaching_event_id>.");
  if (utcTimestamp(b.occurred_at) === undefined) fail("occurred_at");
  const c = object(b.context, "context", ["subject", "curriculum", "level", "topic", "concept_id", "concept_title", "language"]);
  text(c.subject, "context.subject", 200); text(c.concept_title, "context.concept_title", 2000); identifier(c.concept_id, "context.concept_id");
  for (const key of ["curriculum", "level", "topic"]) text(c[key], `context.${key}`, 200, true);
  text(c.language, "context.language", 35); if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(c.language)) fail("context.language");
  text(b.taught_summary, "taught_summary", 2000);
  if (!Array.isArray(b.questions) || !b.questions.length || b.questions.length > 5) fail("questions");
  const refs = new Set<string>();
  for (const [i, value] of (b.questions as unknown[]).entries()) {
    const path = `questions[${i}]`, q = object(value, path, ["client_ref", "type", "stem", "options", "correct_answer", "explanation", "difficulty_estimate", "bloom_level", "tags"]);
    identifier(q.client_ref, `${path}.client_ref`); if (refs.has(q.client_ref as string)) fail(`${path}.client_ref`); refs.add(q.client_ref as string);
    if (!["mcq", "short_answer", "true_false"].includes(String(q.type))) fail(`${path}.type`);
    text(q.stem, `${path}.stem`, 8000); text(q.explanation, `${path}.explanation`, 8000);
    if (typeof q.difficulty_estimate !== "number" || !Number.isFinite(q.difficulty_estimate) || q.difficulty_estimate < 0 || q.difficulty_estimate > 1) fail(`${path}.difficulty_estimate`);
    if (!["remember", "understand", "apply"].includes(String(q.bloom_level))) fail(`${path}.bloom_level`);
    if (!Array.isArray(q.tags) || q.tags.length > 32 || q.tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.length > 80) || new Set(q.tags).size !== q.tags.length) fail(`${path}.tags`);
    if (q.type === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) fail(`${path}.options`);
      const keys = new Set<string>();
      for (const option of q.options as unknown[]) {
        const o = object(option, `${path}.options`, ["key", "text"]); text(o.key, `${path}.options.key`, 16); text(o.text, `${path}.options.text`, 2000);
        if (keys.has(o.key as string)) fail(`${path}.options.key`); keys.add(o.key as string);
      }
      if (typeof q.correct_answer !== "string" || !keys.has(q.correct_answer)) fail(`${path}.correct_answer`);
    } else {
      if (q.options !== undefined && (!Array.isArray(q.options) || q.options.length)) fail(`${path}.options`);
      if (q.type === "short_answer") text(q.correct_answer, `${path}.correct_answer`, 4000);
      else if (typeof q.correct_answer !== "boolean" && q.correct_answer !== "true" && q.correct_answer !== "false") fail(`${path}.correct_answer`);
    }
  }
  return b as unknown as RevisionPayload;
}
export type RevisionOutcome = "created" | "reused_existing" | "created_variant" | "rejected_invalid";
export interface RevisionResult { client_ref: string; question_id: string | null; student_card_id: string | null; outcome: RevisionOutcome }
export interface RevisionResponse { teaching_event_id: string; status: "processed"; results: RevisionResult[] }
export function serializeRevisionResponse(payload: RevisionPayload, results: RevisionResult[]): string {
  if (results.length !== payload.questions.length || new Set(results.map(r => r.client_ref)).size !== results.length) throw new Error("Incomplete revision result mapping");
  const byRef = new Map(results.map(result => [result.client_ref, result]));
  const rows = payload.questions.map(question => {
    const r = byRef.get(question.client_ref);
    if (!r || !["created", "reused_existing", "created_variant", "rejected_invalid"].includes(r.outcome) || (r.outcome === "rejected_invalid" ? r.question_id !== null || r.student_card_id !== null : typeof r.question_id !== "string" || !r.question_id.trim() || typeof r.student_card_id !== "string" || !r.student_card_id.trim())) throw new Error("Invalid revision result mapping");
    return { client_ref: r.client_ref, question_id: r.question_id, student_card_id: r.student_card_id, outcome: r.outcome };
  });
  return JSON.stringify({ teaching_event_id: payload.teaching_event_id, status: "processed", results: rows });
}
