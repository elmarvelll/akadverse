/** Development-only numeric diagnostics; never log form values or identities. */
export function saveTiming(operation: string, phase: string, started: number) {
  if (process.env.NODE_ENV === "development") console.info("Productivity save timing", { operation, phase, ms: Math.round(performance.now() - started) });
}
