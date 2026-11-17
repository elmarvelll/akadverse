import React from "react";
import { createRoot } from "react-dom/client";
import LearningJourney from "../../src/app/e-learning/student/study-zone/_components/LearningJourney";
const state = { id: "fixture-run", status: "ACTIVE", busy: false, mode: "active", currentConceptId: "canonical-a", concepts: [{ id: "canonical-a", title: "Quadratic discriminants", coverage: "NOT_EXPLAINED", mastery: "UNKNOWN" }], allowedActions: ["EXPLAIN_CONCEPT", "RECAP", "CONTINUE_CONVERSATION"], activeQuestion: null as null | { id: string; text: string; type: string }, actions: [] as { id: string; status: string; action: string; delivered: boolean; result: Record<string, unknown> }[] };
const receipts: { id: string; visible: boolean }[] = [], commands: string[] = [];
Object.assign(window, { learningFixture: { receipts, commands } });
window.fetch = async (_url, init) => {
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  const reply = (value: unknown) => Response.json({ result: structuredClone(value) });
  if (!body) return reply(state);
  if (body.action === "start") return reply({ status: "READY", run: state });
  if (body.action === "deliver") {
    const activity = state.actions.find(a => a.id === body.actionId)!;
    receipts.push({ id: activity.id, visible: document.body.textContent!.includes(String(activity.result.text ?? activity.result.hint ?? "")) }); activity.delivered = true;
    if (activity.action === "EXPLAIN_CONCEPT") { state.concepts[0].coverage = "EXPLAINED"; state.concepts[0].mastery = "INTRODUCED"; state.allowedActions.push("GENERATE_PRACTICE", "SHOW_GUIDED_EXAMPLE"); }
    return reply({ delivered: true });
  }
  commands.push(body.command);
  const activity = { id: crypto.randomUUID(), status: "COMPLETED", action: "EXPLAIN_CONCEPT", delivered: false, result: {} as Record<string, unknown> };
  switch (body.command) {
    case "explain": activity.result = { text: "A discriminant describes the roots of a quadratic.", sources: [{ title: "Lecturer notes" }] }; break;
    case "practice": activity.action = "GENERATE_PRACTICE"; state.activeQuestion = { id: crypto.randomUUID(), text: "What does a negative discriminant mean?", type: "short_answer" }; state.allowedActions.push("GIVE_HINT"); activity.result = { message: "Try this question." }; break;
    case "hint": activity.action = "GIVE_HINT"; activity.result = { hint: "Think about real square roots.", level: 1 }; break;
    case "answer": activity.action = "EVALUATE_PRACTICE"; state.activeQuestion = null; state.concepts[0].mastery = "DEVELOPING"; activity.result = { evaluation: { correct: true, answerFeedback: "Correct: there are no real roots.", reasoningFeedback: "Clear reasoning.", assistance: "light" } }; break;
    case "question": activity.action = "CONTINUE_CONVERSATION"; activity.result = { text: "A follow-up explanation." }; break;
    case "next": activity.action = "COMPLETE_LESSON"; state.status = "COMPLETED"; activity.result = { message: "Lesson complete." }; break;
  }
  state.actions.push(activity); return reply({ actionId: activity.id, status: "COMPLETED" });
};
createRoot(document.getElementById("root")!).render(<React.StrictMode><LearningJourney courseId="course" documentId="doc" weekNumber={1} /></React.StrictMode>);
