// Shape-check browser history; Concept Explainer persists context under the server-scoped session ID.
import { badRequest } from "@/lib/service-error";
import { STEWART_MAX_HISTORY_MESSAGES, STEWART_MAX_MESSAGE_CHARS } from "@/lib/stewart/config";
export interface StewartTurn { role: "student" | "stewart"; text: string }

export function normalizeHistory(raw: unknown): StewartTurn[] {
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest("Ask Stewart a question.");
  const turns: StewartTurn[] = [];
  for (const item of raw) {
    const role = (item as { role?: unknown })?.role;
    const text = (item as { text?: unknown })?.text;
    if ((role !== "student" && role !== "stewart") || typeof text !== "string") throw badRequest("That conversation couldn't be read. Please refresh and try again.");
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (role === "student" && trimmed.length > STEWART_MAX_MESSAGE_CHARS) {
      throw badRequest(`That message is too long. Please keep it under ${STEWART_MAX_MESSAGE_CHARS.toLocaleString("en")} characters.`);
    }
    // Stewart's own earlier answers are capped defensively (they originated here, but come back via the browser).
    turns.push({ role, text: role === "stewart" ? trimmed.slice(0, 20_000) : trimmed });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== "student") throw badRequest("Ask Stewart a question.");
  const recent = turns.slice(-STEWART_MAX_HISTORY_MESSAGES);
  const firstStudent = recent.findIndex((t) => t.role === "student");
  return recent.slice(firstStudent);
}

// The documented service has question + session_id, not a messages/history request field.
// Carry a bounded, server-loaded transcript in question text without exceeding its 4,000-character limit.
export function contextualQuestion(question: string, history: StewartTurn[] = []): string {
  const prefix = "Previous conversation (reference context):\n";
  const suffix = `\n\nCurrent question:\n${question}`;
  let remaining = Math.min(1600, 4000 - prefix.length - suffix.length);
  if (remaining < 120 || !history.length) return question;
  const lines: string[] = [];
  for (const turn of history.slice(-10).reverse()) {
    const label = turn.role === "student" ? "Student: " : "Stewart: ";
    if (remaining < label.length + 20) break;
    const text = turn.text.trim().slice(0, Math.min(500, remaining - label.length - 1));
    const line = label + text;
    lines.unshift(line); remaining -= line.length + 1;
  }
  return lines.length ? prefix + lines.join("\n") + suffix : question;
}
