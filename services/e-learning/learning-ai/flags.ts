/** Server configuration only. Invalid values fail closed; never expose through NEXT_PUBLIC_. */
const names = ["AI_V2_ENABLED", "AI_INGEST_PIPELINE_ENABLED", "AI_EXPLAIN_CONTEXT_SUPPORTED", "HINTS_ENABLED", "SNAPSHOT_ENABLED", "REVISION_PIPELINE_ENABLED", "REVISIONS_UI_ENABLED"] as const;
export function learningAiFlags(env: Record<string, string | undefined> = process.env) {
  const enabled = Object.fromEntries(names.map(name => [name, env[name] === "true"])) as Record<typeof names[number], boolean>;
  const requested = env.ORCHESTRATOR_MODE;
  const orchestratorMode = enabled.AI_V2_ENABLED && (requested === "shadow" || requested === "active") ? requested : "off";
  return { ...enabled, orchestratorMode } as const;
}
