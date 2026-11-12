// services/e-learning/ai-ingest/client.ts
//
// The shared server-only Concept Explainer adapter: course ingestion, Stewart explanations and temporary files.
// Contracts: docs/elearning/systems/{ai-ingestion-contract,stewart-attachments}.md.
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

// 202 confirms queue admission only; completion requires a callback or authenticated status reconciliation.
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
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url, key };
  } catch { return null; }
}

export function isAiIngestConfigured(): boolean {
  return config() !== null;
}

export function aiIngestCallbackUrl(): string | null {
  const base = (process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/+$/, "");
  return base ? `${base}${AI_INGEST_CALLBACK_PATH}` : null;
}

async function send(method: "POST" | "DELETE" | "GET", path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new AiServiceError("The AI service isn't configured.", null);
  try {
    return await fetch(`${cfg.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.key}`, ...(body === undefined || body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
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

export interface DocumentStatus {
  document_id: string;
  status: "queued" | "processing" | "done" | "failed";
  chunk_count?: number;
  last_error?: string | null;
}
export async function requestDocumentStatus(id: string): Promise<DocumentStatus> {
  const res = await send("GET", `/documents/${encodeURIComponent(id)}/status`);
  if (!res.ok) throw new AiServiceError(`AI status unavailable (HTTP ${res.status}).`, res.status);
  const b = await res.json().catch(() => null);
  if (b?.document_id !== id || !["queued", "processing", "done", "failed"].includes(b.status) ||
      (b.status === "done" && (!Number.isSafeInteger(b.chunk_count) || b.chunk_count <= 0))) {
    throw new AiServiceError("Invalid AI status response.", null);
  }
  return b;
}
export interface ExplanationSource {
  title: string; url?: string; document_id?: string | null; material_type?: string; chunk_preview?: string;
  source_type?: "course_material" | "attachment" | "ai_generated"; attachment_id?: string; filename?: string;
}
export interface Explanation { text: string; sources: ExplanationSource[]; retrieval_info?: Record<string, number> }
const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try { const u = new URL(value); if (["https:", "http:"].includes(u.protocol) && !u.username && !u.password) return u.href; } catch {}
}
export async function requestExplanation(question: string, offeringId: string, week: number, grounded: boolean, context?: { sessionId: string; attachmentIds: string[]; history?: import("../student/stewart/chat").StewartTurn[] }): Promise<Explanation> {
  if (!nonempty(question) || question.length > 4000 || !offeringId || !Number.isSafeInteger(week) || week < 1) throw new AiServiceError("Invalid explanation context.", 422);
  if (context?.history?.length) {
    const { contextualQuestion } = await import("../student/stewart/chat");
    question = contextualQuestion(question, context.history);
  }
  const form = new FormData(); form.set("question", question);
  const res = await send("POST", grounded ? "/explain-with-grounding" : "/explain", grounded ? form : { question, course_offering_id: offeringId, week, ...(context ? { session_id: context.sessionId, ...(context.attachmentIds.length ? { attachment_ids: context.attachmentIds } : {}) } : {}) }, 150_000);
  if (!res.ok) throw new AiServiceError(`Explanation unavailable (HTTP ${res.status}).`, res.status);
  const b = await res.json().catch(() => null);
  const fields = ["concept", "simple_explanation", "analogy", "example", "worked_problem"];
  if (!b || (grounded ? fields.some((f) => !nonempty(b[f])) : !nonempty(b.answer)) || !Array.isArray(b.sources)) throw new AiServiceError("Invalid explanation response.", null);
  const sources: ExplanationSource[] = b.sources.flatMap((s: Record<string, unknown>) => {
    if (!s || !nonempty(s.title)) return [];
    if (grounded) { const url = safeSourceUrl(s.url); return url ? [{ title: s.title, url }] : []; }
    const common = { title: s.title, document_id: nonempty(s.document_id) ? s.document_id : null, material_type: typeof s.material_type === "string" ? s.material_type : undefined, chunk_preview: typeof s.chunk_preview === "string" ? s.chunk_preview : undefined };
    if (s.source_type === "attachment" && nonempty(s.attachment_id) && nonempty(s.filename)) return [{ ...common, source_type: "attachment" as const, attachment_id: s.attachment_id, filename: s.filename }];
    if (s.source_type === "ai_generated") return [{ ...common, source_type: "ai_generated" as const }];
    return nonempty(s.document_id) ? [{ ...common, ...(s.source_type === "course_material" ? { source_type: "course_material" as const } : {}) }] : [];
  });
  const exampleTexts = new Set<string>();
  const sections = grounded ? fields.filter((field) => {
    if (field !== "example" && field !== "worked_problem") return true;
    const key = (b[field] as string).replace(/\s+/g, " ").trim();
    if (exampleTexts.has(key)) return false;
    exampleTexts.add(key); return true;
  }) : fields;
  return { text: grounded ? sections.map((f) => `## ${f.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}\n\n${b[f]}`).join("\n\n") : b.answer, sources, ...(b.retrieval_info && typeof b.retrieval_info === "object" && !Array.isArray(b.retrieval_info) ? { retrieval_info: Object.fromEntries(Object.entries(b.retrieval_info).filter(([, v]) => typeof v === "number" && Number.isFinite(v))) as Record<string, number> } : {}) };
}
export async function requestHealth(): Promise<Record<string, unknown>> {
  const cfg = config();
  if (!cfg) throw new AiServiceError("AI service configuration missing.", null);
  try {
    const res = await fetch(`${cfg.url}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store", redirect: "error" });
    const body = await res.json();
    if (!res.ok || !body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AiServiceError("AI health unavailable.", null); }
}


export interface AiAttachmentMetadata {
  attachment_id: string; filename: string; mime_type: string; size_bytes: number;
  created_at: string; expires_at: string;
}
function attachmentMetadata(value: unknown): AiAttachmentMetadata {
  const b = value as AiAttachmentMetadata | null;
  if (!b || typeof b.attachment_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.attachment_id) ||
      !nonempty(b.filename) || !nonempty(b.mime_type) || !Number.isSafeInteger(b.size_bytes) || b.size_bytes <= 0 || b.size_bytes > 4 * 1024 * 1024 ||
      typeof b.created_at !== "string" || typeof b.expires_at !== "string" ||
      !Number.isFinite(Date.parse(b.created_at)) || !Number.isFinite(Date.parse(b.expires_at)) ||
      Date.parse(b.expires_at) <= Date.now() || Date.parse(b.expires_at) <= Date.parse(b.created_at)) {
    throw new AiServiceError("Invalid attachment response.", null);
  }
  return { attachment_id: b.attachment_id, filename: b.filename, mime_type: b.mime_type, size_bytes: b.size_bytes, created_at: b.created_at, expires_at: b.expires_at };
}
export async function requestAttachmentUpload(file: File): Promise<AiAttachmentMetadata> {
  const form = new FormData(); form.set("file", file);
  const res = await send("POST", "/attachments", form, 30_000);
  if (res.status !== 200) throw new AiServiceError("Attachment upload failed.", res.status);
  return attachmentMetadata(await res.json().catch(() => null));
}
export async function requestAttachmentMetadata(id: string): Promise<AiAttachmentMetadata> {
  const res = await send("GET", `/attachments/${encodeURIComponent(id)}`);
  if (!res.ok) throw new AiServiceError("Attachment unavailable.", res.status);
  const metadata = attachmentMetadata(await res.json().catch(() => null));
  if (metadata.attachment_id !== id) throw new AiServiceError("Invalid attachment response.", null);
  return metadata;
}
export async function requestAttachmentDelete(id: string): Promise<void> {
  const res = await send("DELETE", `/attachments/${encodeURIComponent(id)}`);
  if (res.status !== 204 && res.status !== 404) throw new AiServiceError("Attachment cleanup failed.", res.status);
}
