import { createHash } from "node:crypto";
import type { RevisionPayload, RevisionQuestion } from "./contract";
export const JUDGE_MODEL = "gemini-3.5-flash-lite";
export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_VERSION = "revision-v1";
export const SCHEDULER_VERSION = "ts-fsrs@6.0.0/FSRS-7/defaults";
export type Evaluation = { concept_id: string; answer_correct: boolean; reasoning_quality: "strong" | "adequate" | "weak" | "absent"; evidence_strength: "independent" | "assisted" | "insufficient"; needs_review: boolean; recommended_next_step: "progress" | "reinforce" | "teach_prerequisite"; answer_feedback: string; reasoning_feedback: string };
export function teachingPassed(e: Evaluation) { return !!e && e.answer_correct === true && e.evidence_strength === "independent" && ["adequate", "strong"].includes(e.reasoning_quality) && e.needs_review === false && e.recommended_next_step === "progress"; }
export const normalized = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
export const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function conceptKey(context: { subject: string; curriculum: string; level: string; title: string; learningObjective: string }) { return hash([context.subject, context.curriculum, context.level, context.title, context.learningObjective].map(normalized)); }
export function scopeKey(payload: RevisionPayload, question: RevisionQuestion, trustedConceptKey: string) { return hash([normalized(payload.context.subject), normalized(payload.context.curriculum), normalized(payload.context.level), payload.context.language.toLowerCase(), question.type, trustedConceptKey]); }
export function canonicalQuestion(payload: RevisionPayload, q: RevisionQuestion, learningObjective: string) {
  const answer = q.type === "mcq" ? q.options!.find(o => o.key === q.correct_answer)!.text : String(q.correct_answer);
  // Option LABEL changes alone do not create new questions. Preserve numeric/semantic content.
  // Preserve case and internal formatting: X/x, code indentation and option boundaries can change meaning.
  const content = (value: string) => JSON.stringify(value.normalize("NFC").replace(/\r\n?/g, "\n").trim());
  return `[type] ${q.type}\n[subject] ${content(normalized(payload.context.subject))}\n[curriculum] ${content(normalized(payload.context.curriculum))}\n[level] ${content(normalized(payload.context.level))}\n[concept] ${content(payload.context.concept_title)}\n[objective] ${content(learningObjective)}\n[question] ${content(q.stem)}\n[answer] ${content(answer)}\n[options] ${JSON.stringify((q.options || []).map(o => o.text.normalize("NFC").replace(/\r\n?/g, "\n").trim()).sort())}\n[explanation] ${content(q.explanation)}`;
}
export function needsJudge(score: number) { return score >= 0.85; }
export function normalizedVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS || value.some(n => typeof n !== "number" || !Number.isFinite(n))) throw new Error("Invalid question embedding");
  const norm = Math.hypot(...value); if (!norm) throw new Error("Zero question embedding");
  return value.map(n => n / norm);
}
