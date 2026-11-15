import { AsyncLocalStorage } from "node:async_hooks";

type Timing = { phase: string; ms: number };
type Trace = { referenceId: string; operation: string; started: number; timings: Timing[]; failedPhase?: string };
const traces = new AsyncLocalStorage<Trace>();
const enabled = () => process.env.NODE_ENV === "development";
const operationNames = new Set(["workspace.initial", "workspace.view", "official.range", "context", "tasks.list", "tasks.get", "tasks.history", "tasks.create", "tasks.update", "tasks.delete", "tasks.complete", "tasks.miss", "habits.list", "habits.save", "habits.archive", "habits.synchronize", "habits.record", "habits.replan", "schedule.load", "schedule.history", "schedule.save", "schedule.category", "schedule.archive", "schedule.backup", "schedule.miss", "official.classes", "analytics.tasks", "analytics.schedule", "preferences.save", "import"]);
export function diagnosticReference() { return traces.getStore()?.referenceId; }
export function diagnosticOperation(operation: string) { const trace = traces.getStore(); if (trace) trace.operation = operationNames.has(operation) ? operation : "unknown"; }
export function diagnosticElapsed(phase: string, started: number) {
  const trace = traces.getStore();
  if (trace && trace.timings.length < 50) trace.timings.push({ phase, ms: Math.round(performance.now() - started) });
}
export async function timed<T>(phase: string, run: () => Promise<T>): Promise<T> {
  const trace = traces.getStore();
  if (!trace) return run();
  const started = performance.now();
  try { return await run(); }
  catch (error) { trace.failedPhase ||= phase; throw error; }
  finally { diagnosticElapsed(phase, started); }
}
/** Allowlisted summaries only: raw Prisma messages/meta may contain connection URLs or user data. */
export function databaseDiagnostic(error: unknown, depth = 0): { prismaCode?: string; message: string } {
  const candidate = error as { code?: unknown; errorCode?: unknown; message?: unknown; meta?: { error?: unknown }; cause?: unknown } | null;
  const value = candidate?.code || candidate?.errorCode;
  const prismaCode = typeof value === "string" && /^P\d{4}$/.test(value) ? value : undefined;
  if (!prismaCode && candidate?.cause instanceof Error && candidate.cause !== error && depth < 3) return databaseDiagnostic(candidate.cause, depth + 1);
  const detail = [candidate?.message, candidate?.meta?.error].filter(value => typeof value === "string").join(" ");
  const message = prismaCode === "P2028" ? /Unable to start a transaction in the given time/i.test(detail) ? "Unable to start a transaction in the given time." : /expired|already closed/i.test(detail) ? "The interactive transaction expired or was already closed." : "Transaction API error."
    : prismaCode === "P2024" ? "Timed out fetching a new connection from the connection pool."
    : prismaCode === "P1008" ? "Database operation timed out."
    : prismaCode === "P1001" ? "Cannot reach the configured database endpoint."
    : prismaCode === "P1002" ? "Database connection was reached but timed out."
    : prismaCode === "P1017" ? "Database server closed the connection."
    : prismaCode ? "Database request failed; raw details omitted." : "Non-Prisma failure; raw details omitted.";
  return { prismaCode, message };
}
export function diagnosticFailure(error: unknown) {
  if (!enabled()) return {};
  return { ...databaseDiagnostic(error), failedPhase: traces.getStore()?.failedPhase };
}
export async function withProductivityDiagnostics<T>(run: () => Promise<T>): Promise<T> {
  if (!enabled()) return run();
  const trace: Trace = { referenceId: crypto.randomUUID(), operation: "parse", started: performance.now(), timings: [] };
  return traces.run(trace, async () => {
    try { return await run(); }
    finally {
      const cached = (globalThis as { prismaDatabaseUrl?: string }).prismaDatabaseUrl;
      console.info("Productivity timing", { referenceId: trace.referenceId, operation: trace.operation, ms: Math.round(performance.now() - trace.started), failedPhase: trace.failedPhase, environmentMatchesCachedClient: cached === process.env.DATABASE_URL, timings: trace.timings });
    }
  });
}
