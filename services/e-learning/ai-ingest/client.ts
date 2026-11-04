// services/e-learning/ai-ingest/client.ts
//
// The one place AkadVerse talks to the AI microservice that chunks + embeds course materials (built separately by the
// AI engineer). The contract it speaks is docs/elearning/systems/ai-ingestion-contract.md — if the microservice's
// routes or field names end up different, THIS file is the only one to change.
//
// Configuration (server only):
//   AI_SERVICE_URL               base URL of the microservice, e.g. https://ai.akadverse.com  (unset = ingestion off)
//   AI_SERVICE_API_KEY           sent as "Authorization: Bearer <key>" on every request        (unset = ingestion off)
//   AI_SERVICE_CALLBACK_SECRET   the microservice sends this back on the status callback (see the callback route)
//   APP_BASE_URL / NEXTAUTH_URL  this app's public URL, used to build the callback URL
//
// Until AI_SERVICE_URL and AI_SERVICE_API_KEY are both set, nothing here is called: uploads and deletes behave exactly
// as they did before ingestion existed.

// Under /api/webhooks so src/proxy.ts lets the session-less microservice through; the route checks the shared secret.
export const AI_INGEST_CALLBACK_PATH = "/api/webhooks/ai-ingest";
const TIMEOUT_MS = 15_000;

export interface AiIngestMetadata {
  course_code: string;
  course_title: string;
  course_offering_id: string;
  academic_session: string;
  semester: string;
  start_week: number;
  end_week: number;
  weeks: number[];
  material_type: string;
  title: string;
  document_id: string;
}

export interface AiIngestPayload {
  document_id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  callback_url: string | null;
  metadata: AiIngestMetadata;
}

// 202 confirms queue admission only; completion requires an authenticated callback.
export interface AiIngestAccepted { done: null }

export class AiServiceError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "AiServiceError";
  }
}

function config() {
  const url = (process.env.CONCEPT_EXPLAINER_API_URL || process.env.AI_SERVICE_URL)?.trim().replace(/\/+$/, "");
  const key = process.env.AI_SERVICE_API_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function isAiIngestConfigured(): boolean {
  return config() !== null;
}

export function aiIngestCallbackUrl(): string | null {
  const base = (process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/+$/, "");
  return base ? `${base}${AI_INGEST_CALLBACK_PATH}` : null;
}

async function send(method: "POST" | "DELETE", path: string, body?: unknown): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new AiServiceError("The AI service isn't configured.", null);
  try {
    return await fetch(`${cfg.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.key}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
  } catch (err) {
    const timedOut = (err as { name?: string })?.name === "TimeoutError";
    throw new AiServiceError(timedOut ? "The AI service didn't respond in time." : "The AI service couldn't be reached.", null);
  }
}

// POST /ingest — hand the microservice one document to (re)ingest. Existing IDs cannot safely be resubmitted under the current service contract.
export async function requestIngest(payload: AiIngestPayload): Promise<AiIngestAccepted> {
  const res = await send("POST", "/ingest", payload);
  if (res.status !== 202) throw new AiServiceError(`AI queue admission was not confirmed (HTTP ${res.status}).`, res.status);
  const body = await res.json().catch(() => null);
  if (body?.status !== "queued" || body.document_id !== payload.document_id) {
    throw new AiServiceError("AI queue admission response was invalid; reconciliation required.", null);
  }
  return { done: null };
}

// DELETE /documents/{id} — remove every chunk of a document. 404 = already gone, which is what we wanted.
export async function requestDelete(documentId: string): Promise<void> {
  const res = await send("DELETE", `/documents/${encodeURIComponent(documentId)}`);
  if (res.status !== 204 && res.status !== 404) throw new AiServiceError(`The AI service couldn't remove the document (HTTP ${res.status}).`, res.status);
}
