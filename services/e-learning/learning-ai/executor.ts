import { elearningDb } from "@/lib/db/elearning";
import type { LearningLessonAction } from "@/generated/prisma-elearning";
import { isObject } from "./capabilities";
import { callAi } from "./client";
import { learningAiFlags } from "./flags";
import { type Action, type Evidence, hintLevel, misconceptionCode } from "./policy";
import { lessonState, ownedRun, problem } from "./lessons";
import { validateEvaluation } from "../revision-questions/students";
export type Scope = Awaited<ReturnType<typeof ownedRun>>;
export interface Execution {
  result: Record<string, unknown>; privateResult?: unknown; action: Action | "EVALUATE_PRACTICE";
  conceptId: string; moveTo?: string; complete?: boolean; pause?: boolean;
  question?: Record<string, unknown>; evaluation?: Record<string, unknown>; evidence?: Evidence;
  hint?: { level: number; content: string; rationale: string; attemptDraft: string };
}
function validText(value: unknown, max = 16000): value is string { return typeof value === "string" && !!value.trim() && value.length <= max; }
export async function executeLearningAction(scope: Scope, queued: LearningLessonAction, action: Action | "EVALUATE_PRACTICE", target: string): Promise<Execution> {
  const { run, ctx } = scope, state = await lessonState(run);
  const concept = state.concepts.find(c => c.id === target);
  if (!concept) return problem("CONCEPT_UNAVAILABLE", "This concept is unavailable.");
  const input = isObject(queued.input) ? queued.input : {};
  const opts = { requestId: queued.id, studentId: run.studentId, courseId: run.courseId };
  const base = { action, conceptId: target };
  if (action === "FLAG_FOR_REVIEW") return { ...base, pause: true, result: { message: "This concept needs review. You can ask Stuart a question while progression is paused." } };
  if (action === "COMPLETE_LESSON") return { ...base, complete: true, result: { message: "Lesson complete. Eligible revision questions will appear in Revisions when ready." } };
  if (action === "ADVANCE_TO_NEXT_CONCEPT") return { ...base, moveTo: target, result: { message: `Next concept: ${concept.title}.`, openedConcept: true } };
  if (action === "EVALUATE_PRACTICE") {
    const attempt = state.attempt;
    if (!attempt || queued.attemptId !== attempt.id || !validText(input.answer, 4000)) return problem("ATTEMPT_UNAVAILABLE", "This practice attempt is no longer active.");
    const q = isObject(attempt.question) ? attempt.question : {};
    const response = await callAi("EVALUATE_PRACTICE", { concept_id: concept.id, concept_description: concept.description, question: q.question_text, expected_answer: q.expected_answer, evaluation_criteria: q.evaluation_criteria, student_answer: input.answer, student_reasoning: input.reasoning ?? "", response_type: q.question_type === "step" ? "step" : "text" }, opts);
    const result = validateEvaluation(response.body, concept.id);
    const hints = await elearningDb.learningHintEvent.findMany({ where: { studentId: run.studentId, attemptId: attempt.id }, select: { level: true } });
    const assistance = hints.some(h => h.level >= 5) ? "heavy" : hints.length ? "light" : "independent";
    const misconceptions = Array.isArray(response.body.misconceptions) ? response.body.misconceptions.filter(isObject).flatMap(m => typeof m.label === "string" ? [{ code: typeof m.code === "string" && m.code.trim() ? m.code.slice(0, 60) : misconceptionCode(m.label), label: m.label.slice(0, 500) }] : []).slice(0, 20) : [];
    const evidence: Evidence = { correct: result.answer_correct, reasoning: result.reasoning_quality, assistance, needsReview: result.needs_review || response.metadata.status === "degraded", misconceptions: misconceptions.map(m => m.code), kind: q._kind === "transfer" ? "transfer" : "practice" };
    const normalized = { ...result, evidence_strength: assistance === "independent" ? "independent" : "assisted", misconceptions };
    // Review-needed responses remain private; only an explicit review state reaches the student.
    return { ...base, evaluation: normalized, evidence, privateResult: response.body, pause: evidence.needsReview,
      result: evidence.needsReview ? { message: "This evaluation needs review. No mastery credit was applied.", needsReview: true } : { evaluation: { correct: result.answer_correct, answerFeedback: result.answer_feedback, reasoningFeedback: result.reasoning_feedback, assistance, misconceptions: misconceptions.map(m => m.label) } } };
  }
  if (action === "GIVE_HINT") {
    if (!learningAiFlags().HINTS_ENABLED || !state.attempt || state.attempt.id !== queued.attemptId || !validText(input.answer, 4000)) return problem("HINT_UNAVAILABLE", "Make an attempt before requesting a hint.");
    const hints = await elearningDb.learningHintEvent.findMany({ where: { studentId: run.studentId, attemptId: state.attempt.id }, orderBy: { createdAt: "asc" } });
    const level = hintLevel(hints.map(h => h.level), input.explicit === true), q = state.attempt.question as Record<string, unknown>;
    const response = await callAi("GENERATE_HINT", { concept_id: concept.id, concept_description: concept.description, question: q.question_text, expected_answer: q.expected_answer, evaluation_criteria: q.evaluation_criteria, student_attempt: input.answer, target_level: level, previous_hints: hints.map(h => h.content) }, opts);
    const b = response.body;
    if (response.metadata.status === "degraded" || b.level_given !== level || b.hint_type !== ["L1_METACOGNITIVE", "L2_DIRECTIONAL", "L3_CONCEPT_REMINDER", "L4_ANALOGOUS_EXAMPLE", "L5_PARTIAL_SOLUTION", "L6_FULL_SOLUTION"][level - 1] || b.needs_review !== false || !validText(b.hint_content, 8000) || !validText(b.rationale, 8000)) return problem("HINT_REQUIRES_REVIEW", "This hint could not be verified.", 502);
    return { ...base, hint: { level, content: b.hint_content, rationale: b.rationale, attemptDraft: input.answer }, result: { hint: b.hint_content, level, assistance: level >= 5 ? "heavy" : "light" } };
  }
  if (["GENERATE_PRACTICE", "REASONING_EXERCISE", "TRANSFER_TASK"].includes(action)) {
    if (!state.state.explained) return problem("UNTOLD_CONCEPT", "Read the concept explanation before practicing.");
    const focus = action === "TRANSFER_TASK" ? "\nUse a new applied context to test transfer of this concept." : action === "REASONING_EXERCISE" ? "\nAsk the student to explain their reasoning step by step." : "";
    const response = await callAi("GENERATE_PRACTICE", { concept_id: concept.id, concept_description: concept.description + focus, document_id: run.materialId, question_type: action === "REASONING_EXERCISE" ? "step" : "short_answer", max_questions: 1 }, opts);
    const b = response.body, q = Array.isArray(b.questions) && b.questions.length === 1 ? b.questions[0] : null;
    if (response.metadata.status === "degraded" || b.concept_id !== concept.id || b.needs_review !== false || !isObject(q) || q.concept_id !== concept.id || !validText(q.question_id, 200) || !validText(q.question_text, 8000) || !validText(q.expected_answer, 8000) || !Array.isArray(q.evaluation_criteria) || q.evaluation_criteria.length > 20 || q.evaluation_criteria.some(c => !validText(c, 2000)) || !["short_answer", "step"].includes(String(q.question_type))) return problem("PRACTICE_REQUIRES_REVIEW", "This practice activity could not be verified.", 502);
    return { ...base, question: { ...q, _kind: action === "TRANSFER_TASK" ? "transfer" : "practice" }, result: { question: { text: q.question_text, type: q.question_type }, message: "Try this question and explain your reasoning." } };
  }
  if (action === "SHOW_GUIDED_EXAMPLE") {
    const response = await callAi("GENERATE_EXAMPLE_TASKS", { concept_id: concept.id, concept_description: concept.description, document_id: run.materialId, max_tasks: 3 }, opts);
    const b = response.body;
    if (response.metadata.status === "degraded" || b.concept_id !== concept.id || !isObject(b.example) || !validText(b.example.text) || !["LECTURE_NOTE", "AI_GENERATED"].includes(String(b.example.source)) || !Array.isArray(b.tasks) || b.tasks.length < 3) return problem("GUIDED_REQUIRES_REVIEW", "This example could not be verified.", 502);
    return { ...base, privateResult: b, result: { text: b.example.text, sourceLabel: b.example.source === "LECTURE_NOTE" ? "Lecturer material" : "AI-generated example" } };
  }
  // All explanation-family actions route by enum; never depend on invented params.
  const intent = action === "RECAP" ? "Summarize" : action === "ADDRESS_MISCONCEPTION" ? "Clarify" : action === "REINFORCE_CONCEPT" ? "Explain again with a different example" : "Explain";
  const latest = action === "ADDRESS_MISCONCEPTION" ? await elearningDb.learningEvaluation.findFirst({ where: { studentId: run.studentId, planId: run.planId, conceptId: concept.id }, orderBy: { createdAt: "desc" }, select: { evaluation: true } }) : null;
  const labels = latest && isObject(latest.evaluation) && Array.isArray(latest.evaluation.misconceptions) ? (latest.evaluation.misconceptions as unknown[]).filter(isObject).flatMap(m => typeof m.label === "string" ? [m.label] : []) : [];
  if (action === "ADDRESS_MISCONCEPTION" && !labels.length) return problem("NO_MISCONCEPTION_EVIDENCE", "There is no assessed misconception to address.");
  const question = action === "CONTINUE_CONVERSATION" && validText(input.question, 4000) ? input.question : `${intent}: ${concept.title}. ${concept.description}${labels.length ? `\nAssessed misconceptions: ${labels.join("; ")}` : ""}`.slice(0, 4000);
  const response = await callAi("EXPLAIN", { question, course_offering_id: run.offeringId, week: run.week, concept_id: concept.id, concept_description: concept.description }, opts);
  const b = response.body;
  if (response.metadata.status === "degraded" || !validText(b.answer, 100_000) || !Array.isArray(b.sources)) return problem("EXPLANATION_REQUIRES_REVIEW", "No verified course explanation was returned.", 502);
  const sources = b.sources.filter(isObject).filter(s => ctx.week.documents.some(d => d.id === s.document_id) && !s.attachment_id && s.source_type !== "attachment" && s.source_type !== "ai_generated" && s.material_type !== "AI_GENERATED").map(s => ({ title: typeof s.title === "string" ? s.title.slice(0, 300) : "Lecturer material", document_id: s.document_id, source_type: "course_material" }));
  if (!sources.some(s => s.document_id === run.materialId)) return problem("UNGROUNDED_EXPLANATION", "The explanation did not cite this material.", 502);
  return { ...base, ...(action === "TEACH_PREREQUISITE" ? { moveTo: target } : {}), result: { text: b.answer, sources } };
}
