import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_VERSION, SCHEDULER_VERSION } from "./policy";
export function revisionReadiness() {
  const missing = [!process.env.AI_WEBHOOK_SECRET?.trim() && "AI_WEBHOOK_SECRET", !process.env.GEMINI_API_KEY?.trim() && "GEMINI_API_KEY", !(process.env.CONCEPT_EXPLAINER_API_URL || process.env.AI_SERVICE_URL) && "AI_SERVICE_URL", !process.env.AI_SERVICE_API_KEY && "AI_SERVICE_API_KEY", process.env.REVISION_QUESTIONS_ENABLED !== "true" && "REVISION_QUESTIONS_ENABLED", process.env.REVISION_GENERATION_ENABLED !== "true" && "REVISION_GENERATION_ENABLED"].filter(Boolean);
  return { ready: missing.length === 0, missing, webhookMode: "synchronous", embedding: { model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, version: EMBEDDING_VERSION }, scheduler: SCHEDULER_VERSION };
}
