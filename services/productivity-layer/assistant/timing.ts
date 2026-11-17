type Phase = "callback.authorize" | "callback.context" | "callback.tool" | "chat.begin" | "chat.service" | "chat.finish" | "chat.view";
/** Static phase names and opaque turn/reference IDs only; never log payloads or exception text. */
export async function assistantTiming<T>(phase: Phase, referenceId: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let completed = false;
  try { const result = await work(); completed = true; return result; }
  finally { console.info("PIP timing", { referenceId, phase, ms: Math.round(performance.now() - started), completed }); }
}
