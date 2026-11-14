export type HabitOutcome = "pending" | "completed" | "missed";
export interface OutcomeState { status: HabitOutcome; completedAt?: string; missedAt?: string }
export interface OutcomeChange { id: string; at: string; from: OutcomeState; to: OutcomeState }
export function validateOutcomeChanges(value: unknown, current: OutcomeState, createdAt: string, updatedAt: string): OutcomeState {
  if (value === undefined) return current;
  if (!Array.isArray(value) || !value.length) throw new Error("Invalid outcome correction history.");
  const valid = (state: OutcomeState) => state && ["pending", "completed", "missed"].includes(state.status) && (state.status === "completed") === (state.completedAt !== undefined) && (state.status !== "missed" || !!state.missedAt) && [state.completedAt, state.missedAt].every(at => at === undefined || (typeof at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(at) && Number.isFinite(Date.parse(at))));
  const equal = (a: OutcomeState, b: OutcomeState) => a.status === b.status && a.completedAt === b.completedAt && a.missedAt === b.missedAt;
  let previous = value[0]?.from, time = createdAt;
  const ids = new Set<string>();
  for (const change of value as OutcomeChange[]) {
    if (!change || typeof change.id !== "string" || !change.id || ids.has(change.id) || typeof change.at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(change.at) || !Number.isFinite(Date.parse(change.at)) || Date.parse(change.at) < Date.parse(time) || Date.parse(change.at) > Date.parse(updatedAt) || !valid(change.from) || !valid(change.to) || !equal(previous, change.from) || equal(change.from, change.to)) throw new Error("Invalid outcome correction history.");
    if (change.to.status === "completed" && change.to.completedAt !== change.at || change.to.status === "missed" && change.to.missedAt !== change.at || change.to.status === "pending" && (change.to.completedAt || change.to.missedAt)) throw new Error("Invalid corrected outcome timestamp.");
    ids.add(change.id); previous = change.to; time = change.at;
  }
  if (!equal(previous, current)) throw new Error("Outcome does not match correction history.");
  return value[0].from;
}
