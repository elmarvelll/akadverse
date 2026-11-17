import { isObject } from "./capabilities";
export const actions = ["EXPLAIN_CONCEPT", "REINFORCE_CONCEPT", "SHOW_GUIDED_EXAMPLE", "GIVE_HINT", "GENERATE_PRACTICE", "ADDRESS_MISCONCEPTION", "REASONING_EXERCISE", "TRANSFER_TASK", "TEACH_PREREQUISITE", "ADVANCE_TO_NEXT_CONCEPT", "COMPLETE_LESSON", "CONTINUE_CONVERSATION", "RECAP", "FLAG_FOR_REVIEW"] as const;
export type Action = typeof actions[number];
export const triggers = ["LESSON_STARTED", "CONCEPT_OPENED", "EXPLANATION_DELIVERED", "STUDENT_ASKED", "HINT_REQUESTED", "GUIDED_COMPLETED", "ATTEMPT_EVALUATED", "PRACTICE_COMPLETED", "LESSON_COMPLETED", "REVISION_REVIEW_COMPLETED", "RETURN_VISIT"] as const;
export type Trigger = typeof triggers[number];
export const masteryLevels = ["UNKNOWN", "INTRODUCED", "DEVELOPING", "UNDERSTOOD", "STRONG", "NEEDS_REINFORCEMENT"] as const;
export type Mastery = typeof masteryLevels[number];
export interface Evidence {
  correct: boolean; reasoning: "absent" | "weak" | "adequate" | "strong";
  assistance: "independent" | "light" | "heavy"; needsReview: boolean;
  misconceptions: string[]; kind: "practice" | "transfer" | "revision";
}
export function misconceptionCode(label: string) { return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60); }
/** Chronological evidence; FSRS retention and model confidence are deliberately absent. */
export function computeMastery(evidence: Evidence[], delivered: boolean): Mastery {
  if (!evidence.length) return delivered ? "INTRODUCED" : "UNKNOWN";
  const recent = evidence.slice(-3), last = evidence.at(-1)!;
  if ((!last.correct && last.kind === "revision") || evidence.slice(-2).filter(e => !e.correct).length === 2 ||
    recent.some(e => e.misconceptions.some(code => recent.filter(other => other.misconceptions.includes(code)).length >= 2))) return "NEEDS_REINFORCEMENT";
  const independent = evidence.filter(e => e.correct && e.assistance === "independent" && ["adequate", "strong"].includes(e.reasoning) && !e.needsReview);
  if (independent.length >= 2 && recent.every(e => !e.needsReview && e.misconceptions.length === 0)) {
    return independent.some(e => e.kind === "transfer" || e.kind === "revision") ? "STRONG" : "UNDERSTOOD";
  }
  return "DEVELOPING";
}
export function developed(value: string) { return ["DEVELOPING", "UNDERSTOOD", "STRONG"].includes(value); }
export interface LearningState {
  current: string; prerequisites: string[]; next: string | null;
  explained: boolean; mastery: string; prerequisitesReady: boolean; allHandled: boolean;
  pendingReview: boolean; attemptActive: boolean; consecutiveReinforce: number;
}
export function allowedActions(s: LearningState): Action[] {
  if (s.pendingReview) return ["FLAG_FOR_REVIEW", "CONTINUE_CONVERSATION", ...(s.attemptActive ? ["GIVE_HINT" as const] : [])];
  const allowed: Action[] = ["EXPLAIN_CONCEPT", "CONTINUE_CONVERSATION", "RECAP", "FLAG_FOR_REVIEW"];
  if (s.consecutiveReinforce < 2) allowed.push("REINFORCE_CONCEPT", "ADDRESS_MISCONCEPTION");
  if (s.explained) allowed.push("SHOW_GUIDED_EXAMPLE");
  if (s.explained && !s.attemptActive) allowed.push("GENERATE_PRACTICE", "REASONING_EXERCISE");
  if (s.explained && !s.attemptActive && developed(s.mastery)) allowed.push("TRANSFER_TASK");
  if (s.attemptActive) allowed.push("GIVE_HINT");
  if (s.prerequisites.length) allowed.push("TEACH_PREREQUISITE");
  if (s.explained && developed(s.mastery) && s.prerequisitesReady && s.next) allowed.push("ADVANCE_TO_NEXT_CONCEPT");
  if (s.allHandled && s.prerequisitesReady) allowed.push("COMPLETE_LESSON");
  return allowed;
}
export interface Decision { action: Action; target_concept_id: string; params: Record<string, unknown>; reason_code: string; rationale: string; confidence: number }
export type GuardReason = "structure_invalid" | "upstream_degraded" | "action_not_allowed" | "target_not_reachable" | "rationale_empty";
export function guardDecision(body: unknown, allowed: Action[], state: LearningState): { ok: true; decision: Decision } | { ok: false; reason: GuardReason; status: "degraded"; decision: null; usage: { model_calls: 0 } } {
  const fail = (reason: GuardReason) => ({ ok: false as const, reason, status: "degraded" as const, decision: null, usage: { model_calls: 0 as const } });
  if (!isObject(body) || !["ok", "degraded"].includes(String(body.status))) return fail("structure_invalid");
  if (body.status === "degraded" || body.decision == null) return fail("upstream_degraded");
  const d = body.decision;
  if (!isObject(d) || !actions.includes(d.action as Action) || typeof d.target_concept_id !== "string" || typeof d.reason_code !== "string" || typeof d.rationale !== "string" || typeof d.confidence !== "number" || !Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence > 1 || (d.params !== undefined && !isObject(d.params))) return fail("structure_invalid");
  if (!allowed.includes(d.action as Action)) return fail("action_not_allowed");
  if (![state.current, ...state.prerequisites, ...(state.next ? [state.next] : [])].includes(d.target_concept_id) ||
    (d.action === "TEACH_PREREQUISITE" ? !state.prerequisites.includes(d.target_concept_id) : d.action === "ADVANCE_TO_NEXT_CONCEPT" ? d.target_concept_id !== state.next : d.target_concept_id !== state.current)) return fail("target_not_reachable");
  if (!/[\p{L}\p{N}]/u.test(d.rationale)) return fail("rationale_empty");
  return { ok: true, decision: { action: d.action as Action, target_concept_id: d.target_concept_id, reason_code: d.reason_code, rationale: d.rationale, confidence: d.confidence, params: isObject(d.params) ? d.params : {} } };
}
/** Supplied Study Zone §12.4. Guard the fallback exactly like a model decision. */
export function fallback(trigger: Trigger, state: LearningState, allowed: Action[], evidence?: Evidence): Decision | null {
  let action: Action;
  switch (trigger) {
    case "LESSON_STARTED": case "CONCEPT_OPENED": action = "EXPLAIN_CONCEPT"; break;
    case "EXPLANATION_DELIVERED": action = "SHOW_GUIDED_EXAMPLE"; break;
    case "GUIDED_COMPLETED": action = "GENERATE_PRACTICE"; break;
    case "ATTEMPT_EVALUATED":
      action = !evidence || evidence.needsReview ? "FLAG_FOR_REVIEW" : !evidence?.correct ? (state.prerequisites.length && !state.prerequisitesReady ? "TEACH_PREREQUISITE" : "REINFORCE_CONCEPT") : ["adequate", "strong"].includes(evidence.reasoning) && evidence.assistance !== "heavy" ? "ADVANCE_TO_NEXT_CONCEPT" : "REASONING_EXERCISE"; break;
    case "PRACTICE_COMPLETED": action = developed(state.mastery) ? "ADVANCE_TO_NEXT_CONCEPT" : "REINFORCE_CONCEPT"; break;
    case "STUDENT_ASKED": action = "CONTINUE_CONVERSATION"; break;
    case "HINT_REQUESTED": action = "GIVE_HINT"; break;
    case "REVISION_REVIEW_COMPLETED": action = (evidence?.kind === "revision" && !evidence.correct) || state.mastery === "NEEDS_REINFORCEMENT" ? "REINFORCE_CONCEPT" : "FLAG_FOR_REVIEW"; break;
    case "RETURN_VISIT": action = "RECAP"; break;
    case "LESSON_COMPLETED": action = "COMPLETE_LESSON"; break;
  }
  if (!allowed.includes(action)) action = "FLAG_FOR_REVIEW";
  if (!allowed.includes(action)) return null;
  const target = action === "ADVANCE_TO_NEXT_CONCEPT" ? state.next : action === "TEACH_PREREQUISITE" ? state.prerequisites[0] : state.current;
  if (!target) return null;
  return { action, target_concept_id: target, params: {}, reason_code: "LOCAL_FALLBACK", rationale: "Local learning policy selected the next permitted activity.", confidence: 0 };
}
export function hintLevel(previous: number[], explicit: boolean): number {
  const level = Math.max(0, ...previous) + 1;
  if (level > 6 || (level === 5 && previous.length < 3 && !explicit) || (level === 6 && !explicit)) throw new Error("HINT_ESCALATION_REQUIRES_CONFIRMATION");
  return level;
}
