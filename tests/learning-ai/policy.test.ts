import "../helpers/env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { actions, allowedActions, computeMastery, fallback, guardDecision, hintLevel, type Evidence, type LearningState, type Trigger, type Action } from "../../services/e-learning/learning-ai/policy";
import { orderedConcepts } from "../../services/e-learning/learning-ai/plans";
import { boundedSnapshot, SNAPSHOT_MAX_BYTES } from "../../services/e-learning/learning-ai/snapshot";
import type { AnalysisResult } from "../../services/e-learning/revision-questions/analysis-contract";
const state: LearningState = { current: "a", prerequisites: ["p"], next: "b", explained: true, mastery: "DEVELOPING", prerequisitesReady: true, allHandled: false, pendingReview: false, attemptActive: false, consecutiveReinforce: 0 };
const correct: Evidence = { correct: true, reasoning: "strong", assistance: "independent", needsReview: false, misconceptions: [], kind: "practice" };
const decision = (action: Action = "RECAP", target = "a", rationale = "Review the current concept.") => ({ status: "ok", decision: { action, target_concept_id: target, rationale, reason_code: "REVIEW", confidence: 0, params: {} } });
const fixtures: { name: string; trigger: Trigger; expected: Action; patch?: Partial<LearningState>; evidence?: Evidence }[] = [
  { name: "lesson start", trigger: "LESSON_STARTED", expected: "EXPLAIN_CONCEPT" },
  { name: "concept open", trigger: "CONCEPT_OPENED", expected: "EXPLAIN_CONCEPT" },
  { name: "delivered explanation", trigger: "EXPLANATION_DELIVERED", expected: "SHOW_GUIDED_EXAMPLE" },
  { name: "guided completion", trigger: "GUIDED_COMPLETED", expected: "GENERATE_PRACTICE" },
  { name: "strong independent success", trigger: "ATTEMPT_EVALUATED", expected: "ADVANCE_TO_NEXT_CONCEPT", evidence: correct },
  { name: "correct with weak reasoning", trigger: "ATTEMPT_EVALUATED", expected: "REASONING_EXERCISE", evidence: { ...correct, reasoning: "weak" } },
  { name: "incorrect answer", trigger: "ATTEMPT_EVALUATED", expected: "REINFORCE_CONCEPT", evidence: { ...correct, correct: false } },
  { name: "weak prerequisite", trigger: "ATTEMPT_EVALUATED", expected: "TEACH_PREREQUISITE", patch: { prerequisitesReady: false }, evidence: { ...correct, correct: false } },
  { name: "review-needed answer", trigger: "ATTEMPT_EVALUATED", expected: "FLAG_FOR_REVIEW", evidence: { ...correct, needsReview: true } },
  { name: "developed practice", trigger: "PRACTICE_COMPLETED", expected: "ADVANCE_TO_NEXT_CONCEPT" },
  { name: "underdeveloped practice", trigger: "PRACTICE_COMPLETED", expected: "REINFORCE_CONCEPT", patch: { mastery: "INTRODUCED" } },
  { name: "student question", trigger: "STUDENT_ASKED", expected: "CONTINUE_CONVERSATION" },
  { name: "hint request", trigger: "HINT_REQUESTED", expected: "GIVE_HINT", patch: { attemptActive: true } },
  { name: "failed revision", trigger: "REVISION_REVIEW_COMPLETED", expected: "REINFORCE_CONCEPT", evidence: { ...correct, kind: "revision", correct: false } },
  { name: "return visit", trigger: "RETURN_VISIT", expected: "RECAP" },
  { name: "lesson complete", trigger: "LESSON_COMPLETED", expected: "COMPLETE_LESSON", patch: { allHandled: true } },
];
for (const f of fixtures) test(`decision fixture: ${f.name}`, () => {
  const s = { ...state, ...f.patch }, allowed = allowedActions(s), selected = fallback(f.trigger, s, allowed, f.evidence);
  assert.equal(selected?.action, f.expected);
  assert.equal(guardDecision({ status: "ok", decision: selected }, allowed, s).ok, true);
});
test("decision fixture: disallowed action cannot execute", () => { const result = guardDecision(decision("COMPLETE_LESSON"), allowedActions(state), state); assert.equal(result.ok, false); if (!result.ok) { assert.equal(result.reason, "action_not_allowed"); assert.deepEqual(result.usage, { model_calls: 0 }); assert.equal(result.decision, null); } });
test("decision fixture: unreachable target cannot execute", () => { const result = guardDecision(decision("RECAP", "foreign-course"), allowedActions(state), state); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.reason, "target_not_reachable"); });
test("guard order and live schema: enum, allowed action, reachable target, rationale", () => {
  const fail = (body: unknown, expected: string) => { const r = guardDecision(body, allowedActions(state), state); assert.equal(r.ok, false); if (!r.ok) assert.equal(r.reason, expected); };
  fail({ status: "ok", decision: { ...decision().decision, action: "REQUEST_REVISION_QUESTIONS" } }, "structure_invalid");
  fail(decision("COMPLETE_LESSON", "foreign", " "), "action_not_allowed");
  fail(decision("RECAP", "foreign", " "), "target_not_reachable");
  fail(decision("RECAP", "a", "\n\t "), "rationale_empty");
  fail({ status: "ok", decision: { ...decision().decision, target_concept_id: null } }, "structure_invalid");
  fail({ status: "ok", decision: { ...decision().decision, confidence: 2 } }, "structure_invalid");
  assert.equal(guardDecision(decision(), allowedActions(state), state).ok, true);
  assert.equal(guardDecision({ status: "ok", decision: { ...decision().decision, params: undefined } }, allowedActions(state), state).ok, true);
});
test("action-specific targets and filters prevent skipping coverage/prerequisites", () => {
  assert.equal(guardDecision(decision("TEACH_PREREQUISITE", "b"), actions.slice(), state).ok, false);
  assert.equal(guardDecision(decision("ADVANCE_TO_NEXT_CONCEPT", "a"), actions.slice(), state).ok, false);
  const untaught = allowedActions({ ...state, explained: false, mastery: "UNKNOWN", allHandled: false });
  for (const action of ["GENERATE_PRACTICE", "REASONING_EXERCISE", "TRANSFER_TASK", "ADVANCE_TO_NEXT_CONCEPT", "COMPLETE_LESSON"] as const) assert.equal(untaught.includes(action), false);
  assert.equal(allowedActions({ ...state, prerequisitesReady: false }).includes("ADVANCE_TO_NEXT_CONCEPT"), false);
  assert.equal(allowedActions({ ...state, consecutiveReinforce: 2 }).includes("REINFORCE_CONCEPT"), false);
  assert.deepEqual(allowedActions({ ...state, pendingReview: true, attemptActive: true }), ["FLAG_FOR_REVIEW", "CONTINUE_CONVERSATION", "GIVE_HINT"]);
  assert.equal(fallback("LESSON_STARTED", state, []), null);
  assert.equal(fallback("LESSON_STARTED", state, ["CONTINUE_CONVERSATION"]), null);
});
test("mastery requires independent evidence; failed revision does not erase history", () => {
  assert.equal(computeMastery([], false), "UNKNOWN"); assert.equal(computeMastery([], true), "INTRODUCED");
  assert.equal(computeMastery([correct], true), "DEVELOPING");
  assert.equal(computeMastery([correct, correct], true), "UNDERSTOOD");
  assert.equal(computeMastery([correct, { ...correct, assistance: "light" }], true), "DEVELOPING");
  assert.equal(computeMastery([correct, { ...correct, assistance: "heavy" }], true), "DEVELOPING");
  assert.equal(computeMastery([correct, correct, { ...correct, kind: "transfer" }], true), "STRONG");
  assert.equal(computeMastery([correct, correct, { ...correct, kind: "revision", correct: false }], true), "NEEDS_REINFORCEMENT");
  assert.equal(computeMastery([{ ...correct, correct: false }, { ...correct, correct: false }], true), "NEEDS_REINFORCEMENT");
});
test("hint progression requires an explicit request for full solution", () => {
  assert.equal(hintLevel([], false), 1); assert.equal(hintLevel([1, 2, 3], false), 4);
  assert.equal(hintLevel([1, 2, 3, 4], false), 5);
  assert.throws(() => hintLevel([1, 2, 3, 4, 5], false));
  assert.equal(hintLevel([1, 2, 3, 4, 5], true), 6);
  assert.throws(() => hintLevel([1, 2, 3, 4, 5, 6], true));
});
const analysis = (): AnalysisResult => ({ document_id: "doc", chunks_analysed: 2, lesson_plan: { document_id: "doc", notes: null, missing_prerequisites: [], sections: [{ section_id: "s", title: "Section", concept_ids: ["b", "a"] }], concepts: ["a", "b"].map(id => ({ concept_id: id, title: id, description: "Description", learning_objective: "Understand", difficulty: "introductory", prerequisite_concept_ids: id === "b" ? ["a"] : [], source_chunk_ids: ["chunk1"] })) } });
test("plan order uses canonical graph constraints and rejects suspect/cyclic analysis", () => {
  assert.deepEqual(orderedConcepts(analysis()).map(c => c.concept_id), ["a", "b"]);
  const cycle = analysis(); cycle.lesson_plan.concepts[0].prerequisite_concept_ids = ["b"]; assert.throws(() => orderedConcepts(cycle), /CYCLIC/);
  const unknown = analysis(); unknown.lesson_plan.concepts[0].prerequisite_concept_ids = ["foreign"]; assert.throws(() => orderedConcepts(unknown), /UNKNOWN/);
  const suspect = analysis(); suspect.lesson_plan.notes = "Model fallback"; assert.throws(() => orderedConcepts(suspect), /SUSPECT/);
  const single = analysis(); single.lesson_plan.concepts.pop(); assert.throws(() => orderedConcepts(single), /SUSPECT/);
});
test("snapshot cap measures UTF-8 bytes deterministically", () => {
  const source = { schema_version: "1", concepts: Array.from({ length: 100 }, (_, i) => ({ id: i, title: "🧠".repeat(100) })) };
  const bounded = boundedSnapshot(source);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded)) <= SNAPSHOT_MAX_BYTES);
  assert.deepEqual(boundedSnapshot(source), bounded); assert.equal(source.concepts.length, 100);
});
