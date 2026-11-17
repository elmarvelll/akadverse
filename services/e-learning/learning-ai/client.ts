import { createHash, randomUUID } from "node:crypto";
import { requestLearningAi, isLearningAiConfigured } from "../ai-ingest/client";
import { learningAiFlags } from "./flags";
import { isObject, responseMetadata, type JsonObject } from "./capabilities";

const endpoints = {
  NEXT_ACTION: ["/next-action", 10_000], EXPLAIN: ["/explain", 150_000],
  ANALYSE_MATERIAL: ["/analyse-material", 60_000], GENERATE_EXAMPLE_TASKS: ["/generate-example-tasks", 40_000],
  GENERATE_PRACTICE: ["/generate-practice", 40_000], EVALUATE_PRACTICE: ["/evaluate-practice", 20_000],
  GENERATE_HINT: ["/generate-hint", 15_000], GENERATE_REVISION_QUESTIONS: ["/generate-revision-questions", 60_000],
} as const;
export type Operation = keyof typeof endpoints;
export class LearningAiError extends Error {
  constructor(readonly code: string) { super(code); this.name = "LearningAiError"; }
}
export interface CallRecord {
  requestId: string; operation: string; requestHash: string; studentId: string | null; courseId: string | null;
  status: string; responseRef?: unknown;
}
export interface CallStore {
  claim(record: CallRecord): Promise<{ claimed: true } | { claimed: false; record: CallRecord }>;
  complete(requestId: string, data: JsonObject): Promise<void>;
}
export interface CallOptions { requestId?: string; studentId?: string; courseId?: string }
export interface ClientDependencies {
  store: CallStore;
  transport?: typeof requestLearningAi;
  flags?: () => ReturnType<typeof learningAiFlags>;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function boundedBody(response: Response): Promise<JsonObject> {
  const reader = response.body?.getReader(); if (!reader) throw new LearningAiError("INVALID_RESPONSE");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) { await reader.cancel(); throw new LearningAiError("RESPONSE_TOO_LARGE"); }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!isObject(body)) throw new LearningAiError("INVALID_RESPONSE");
    return body;
  } catch (error) {
    if (error instanceof LearningAiError) throw error;
    throw new LearningAiError("INVALID_RESPONSE");
  } finally { reader.releaseLock(); }
}
function unsafeLegacyResponse(operation: Operation, body: JsonObject): boolean {
  if (body.status === "degraded") return true;
  if (operation === "NEXT_ACTION") return body.decision == null;
  if (["GENERATE_PRACTICE", "EVALUATE_PRACTICE", "GENERATE_HINT"].includes(operation) && body.needs_review === true) return true;
  if (operation === "GENERATE_HINT") return body.level_given === -1 || body.hint_type === "NO_HINT";
  if (operation === "GENERATE_PRACTICE") return !Array.isArray(body.questions) || body.questions.length === 0;
  if (operation === "GENERATE_EXAMPLE_TASKS") return !Array.isArray(body.tasks) || body.tasks.length <= 1;
  if (operation === "EXPLAIN") return typeof body.answer !== "string" || /^(No course material has been ingested|The course material for Week)/.test(body.answer) || !Array.isArray(body.sources) || !body.sources.some(source => isObject(source) && source.source_type !== "attachment" && !source.attachment_id && source.source_type !== "ai_generated" && source.material_type !== "AI_GENERATED" && typeof source.document_id === "string" && source.document_id.length > 0);
  if (operation === "ANALYSE_MATERIAL" && isObject(body.lesson_plan)) return typeof body.lesson_plan.notes === "string" && /fallback/i.test(body.lesson_plan.notes);
  return false;
}
/** Internal server API. Callers must supply authorized scope and reuse the persisted logical action's requestId. */
export function createLearningAiClient(deps: ClientDependencies) {
  return async function callAi(operation: Operation, payload: JsonObject, options: CallOptions = {}) {
    const flags = (deps.flags ?? learningAiFlags)();
    if (!flags.AI_V2_ENABLED || (operation === "NEXT_ACTION" && flags.orchestratorMode === "off") ||
      (operation === "GENERATE_HINT" && !flags.HINTS_ENABLED) ||
      (operation === "GENERATE_REVISION_QUESTIONS" && !flags.REVISION_PIPELINE_ENABLED)) throw new LearningAiError("FEATURE_DISABLED");
    if (operation === "NEXT_ACTION" && (!Array.isArray(payload.allowed_actions) || payload.allowed_actions.length === 0)) throw new LearningAiError("EMPTY_ALLOWED_ACTIONS");
    const requestId = options.requestId ?? randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new LearningAiError("INVALID_REQUEST_ID");
    // Normalize to wire JSON before hashing; never persist raw requests or log student text.
    let wire: JsonObject;
    try { wire = JSON.parse(JSON.stringify(payload)); } catch { throw new LearningAiError("INVALID_REQUEST"); }
    if (!isObject(wire)) throw new LearningAiError("INVALID_REQUEST");
    if (wire.request_id !== undefined && wire.request_id !== requestId) throw new LearningAiError("REQUEST_ID_CONFLICT");
    delete wire.request_id;
    const requestHash = createHash("sha256").update(canonical(wire)).digest("hex");
    const record: CallRecord = { requestId, operation, requestHash, studentId: options.studentId ?? null, courseId: options.courseId ?? null, status: "PENDING" };
    const claimed = await deps.store.claim(record);
    if (!claimed.claimed) {
      const old = claimed.record;
      if (old.requestHash !== requestHash || old.operation !== operation || old.studentId !== record.studentId || old.courseId !== record.courseId) throw new LearningAiError("REQUEST_ID_CONFLICT");
      if (["SUCCEEDED", "DEGRADED"].includes(old.status) && isObject(old.responseRef)) return { requestId, body: old.responseRef, replayed: true, metadata: { ...responseMetadata(old.responseRef), ...(old.status === "DEGRADED" ? { status: "degraded" as const } : {}) } };
      throw new LearningAiError(old.status === "PENDING" ? "REQUEST_IN_PROGRESS" : "REQUEST_NOT_REPLAYABLE");
    }
    const started = Date.now(); let httpStatus: number | undefined; let received = false;
    let body: JsonObject; let metadata: ReturnType<typeof responseMetadata>;
    try {
      const [path, timeout] = endpoints[operation];
      const response = await (deps.transport ?? requestLearningAi)(path, { ...wire, request_id: requestId }, timeout);
      received = true; httpStatus = response.status;
      if (!response.ok) { await response.body?.cancel(); throw new LearningAiError("UPSTREAM_REJECTED"); }
      body = await boundedBody(response);
      if (body.request_id !== undefined && body.request_id !== requestId) throw new LearningAiError("REQUEST_ID_MISMATCH");
      metadata = responseMetadata(body);
      if (unsafeLegacyResponse(operation, body)) metadata.status = "degraded";
      if (body.status !== undefined && metadata.status === undefined) throw new LearningAiError("INVALID_RESPONSE_STATUS");
    } catch (error) {
      const code = error instanceof LearningAiError ? error.code : "UPSTREAM_UNCERTAIN";
      await deps.store.complete(requestId, { status: received ? "FAILED" : "UNCERTAIN", httpStatus, latencyMs: Date.now() - started, errorCode: code, creditsCharged: 0, completedAt: new Date() });
      throw new LearningAiError(code);
    }
    // If final persistence fails, keep PENDING and fail closed. Never issue another call to repair a log.
    await deps.store.complete(requestId, {
      status: metadata.status === "degraded" ? "DEGRADED" : "SUCCEEDED", httpStatus, latencyMs: Date.now() - started,
      usageReported: metadata.usageReported, cached: metadata.cached, model: metadata.usage.model,
      inputTokens: metadata.usage.input_tokens, outputTokens: metadata.usage.output_tokens,
      embeddingTokens: metadata.usage.embedding_tokens, modelCalls: metadata.usage.model_calls,
      capabilities: metadata.capabilities, schemaVersion: metadata.schemaVersion, promptVersion: metadata.promptVersion,
      modelVersion: metadata.modelVersion, responseRef: body, completedAt: new Date(), creditsCharged: 0,
    });
    return { requestId, body, metadata, replayed: false };
  };
}
/** Lazy import keeps database initialization out of disabled paths. */
export async function callAi(operation: Operation, payload: JsonObject, options?: CallOptions) {
  if (!learningAiFlags().AI_V2_ENABLED) throw new LearningAiError("FEATURE_DISABLED");
  if (!isLearningAiConfigured()) throw new LearningAiError("AI_NOT_CONFIGURED");
  const { learningCallStore } = await import("./metering");
  return createLearningAiClient({ store: learningCallStore })(operation, payload, options);
}
