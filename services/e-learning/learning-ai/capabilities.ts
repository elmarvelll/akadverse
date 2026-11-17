export type JsonObject = Record<string, unknown>;
export function isObject(value: unknown): value is JsonObject { return !!value && typeof value === "object" && !Array.isArray(value); }
export interface Usage { model?: string; input_tokens?: number; output_tokens?: number; embedding_tokens?: number; model_calls?: number }
/** Optional staged fields remain optional; absence is unknown, never a fabricated zero. */
export function responseMetadata(body: JsonObject) {
  const usage: Usage = {};
  const reported = isObject(body.usage);
  if (reported) {
    const source = body.usage as JsonObject;
    if (typeof source.model === "string") usage.model = source.model.slice(0, 200);
    for (const key of ["input_tokens", "output_tokens", "embedding_tokens", "model_calls"] as const) {
      const value = source[key];
      if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647) usage[key] = value;
    }
  }
  return {
    status: body.status === "degraded" ? "degraded" : body.status === "ok" ? "ok" : undefined,
    cached: body.cached === true,
    usageReported: reported,
    usage,
    capabilities: { status: body.status === "ok" || body.status === "degraded", usage: reported, requestId: typeof body.request_id === "string" },
    schemaVersion: typeof body.schema_version === "string" ? body.schema_version.slice(0, 100) : undefined,
    promptVersion: typeof body.prompt_version === "string" ? body.prompt_version.slice(0, 100) : undefined,
    modelVersion: typeof body.model_version === "string" ? body.model_version.slice(0, 100) : undefined,
  };
}
