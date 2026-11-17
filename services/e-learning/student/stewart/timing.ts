type Phase = "authorize" | "conversation" | "context" | "reserve" | "persist" | "attachments" | "evidence" | "provider" | "release";
/** Static stages and opaque references only. No prompts, files, credentials or raw errors. */
export async function stewartTiming<T>(phase: Phase, referenceId: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let completed = false;
  try { const result = await work(); completed = true; return result; }
  finally { console.info("Stewart timing", { referenceId, phase, ms: Math.round(performance.now() - started), completed }); }
}
