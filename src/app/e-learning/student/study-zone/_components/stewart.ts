// Stewart, the Study Zone's AI study assistant — browser client.
//
// Talks to the two Stewart routes (/api/e-learning/stewart/chat and /attachments); the model itself is only ever
// called from the server. Everything the server refuses (not signed in, not registered for the course, file too
// large, unreadable document, Stewart not configured, provider busy) comes back as `{ error }` written for students,
// and is thrown here as an Error with that message so the panel can show it as-is.

import { checkStewartAttachment } from "@/lib/stewart/config";

export interface StewartContext {
  conversationId?: string;
  courseId: string;
  courseCode: string;
  weekNumber: number;
  // The course document open in the viewer; null when the week has no material.
  documentId: string | null;
  documentTitle: string | null;
}

export interface StewartMessage {
  id: string;
  role: "stewart" | "student";
  text: string;
  // Optional frontend presentation data; the current server returns text only.
  educational?: unknown;
  // Shown in the log but never sent back to the server (the greeting, error notices).
  local?: boolean;
  attachments?: { name: string; file?: File; attachment_id?: string }[];
  requestId?: string;
  status?: "PENDING" | "COMPLETE" | "FAILED";
  createdAt?: string;
  grounded?: boolean;
  sources?: import("@/services/e-learning/ai-ingest/client").ExplanationSource[];
}

// Service metadata for an upload whose ownership and conversation are persisted on the backend.
export interface StewartAttachment {
  attachment_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  expires_at: string;
  status: "uploaded";
  requires_reattach?: boolean;
  // Only local context; never forwarded to the microservice.
  context: StewartContext;
}
export class StewartRequestError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

export const STEWART_SUGGESTIONS = ["Summarise the document I attached", "Explain the key terms", "Quiz me on this topic"];

const GENERIC = "Stewart couldn't answer just now. Please try again.";

async function readError(res: Response, fallback: string): Promise<StewartRequestError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return new StewartRequestError(typeof body.error === "string" && body.error ? body.error : fallback, body.code);
}

// The opening line of a conversation (local only — not part of what the model sees).
export function startThread(_ctx: StewartContext, threadKey: string): StewartMessage[] {
  return [{ id: `${threadKey}-welcome`, role: "stewart", local: true, text: "Hi, I am Stewart. How can I help you today?" }];
}

export async function askStewart(messages: StewartMessage[], ctx: StewartContext, attachment: StewartAttachment | StewartAttachment[] | null, grounded = false, persistent?: { conversationId: string; requestId: string }): Promise<StewartReply> {
  let res: Response;
  try {
    res = await fetch(persistent ? `/api/e-learning/stewart/conversations/${encodeURIComponent(persistent.conversationId)}/messages` : "/api/e-learning/stewart/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
      body: JSON.stringify(persistent ? { content: messages.filter((m) => !m.local).at(-1)?.text, requestId: persistent.requestId, grounded, attachment_ids: (Array.isArray(attachment) ? attachment : attachment ? [attachment] : []).map((a) => a.attachment_id) } : {
        grounded,
        courseId: ctx.courseId,
        weekNumber: ctx.weekNumber,
        documentId: ctx.documentId,
        messages: messages.filter((m) => !m.local).map((m) => ({ role: m.role, text: m.text })),
        attachment_ids: (Array.isArray(attachment) ? attachment : attachment ? [attachment] : []).map((a) => a.attachment_id),
      }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw await readError(res, GENERIC);
  const body = (await res.json().catch(() => null)) as StewartReply | null;
  if (!body || typeof body.reply !== "string") throw new Error(GENERIC);
  return { ...body, truncated: Boolean(body.truncated) };
}

// Validates locally for a fast message, then uploads; the server re-validates everything.
export async function attachDocument(file: File, context: StewartContext, signal?: AbortSignal): Promise<StewartAttachment> {
  const problem = checkStewartAttachment(file.name, file.size);
  if (problem) throw new Error(problem);
  const form = new FormData();
  form.append("file", file);
  if (context.conversationId) form.set("conversationId", context.conversationId);
  form.set("courseId", context.courseId);
  form.set("weekNumber", String(context.weekNumber));
  if (context.documentId) form.set("documentId", context.documentId);
  let res: Response;
  try {
    res = await fetch("/api/e-learning/stewart/attachments", { method: "POST", body: form, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("The upload was interrupted. Check your connection and try again.");
  }
  if (!res.ok) throw await readError(res, "We couldn't attach that document. Please try again.");
  const body = await res.json();
  if (!body.success || typeof body.attachment?.attachment_id !== "string" || !Number.isFinite(Date.parse(body.attachment.expires_at))) throw new Error("The upload could not be confirmed. Please retry.");
  return { ...body.attachment, context };
}

// Best-effort: the stored copy also expires on its own.
export function discardAttachment(attachment: StewartAttachment): void {
  void fetch("/api/e-learning/stewart/attachments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...attachment.context, attachment_id: attachment.attachment_id }),
    keepalive: true,
  }).catch(() => {});
}


export interface ChatConversation {
  id: string; title: string; createdAt: string; updatedAt: string;
  courseId: string; courseCode: string; weekNumber: number; documentId: string | null; documentTitle: string | null;
}
export interface StoredChatMessage {
  id: string; requestId: string; role: "USER" | "ASSISTANT"; status: "PENDING" | "COMPLETE" | "FAILED"; content: string; createdAt: string;
  metadata?: { sources?: StewartMessage["sources"]; grounded?: boolean; attachments?: { name: string; attachment_id?: string }[] } | null;
}
export interface StewartReply { reply: string; truncated: boolean; sources?: StewartMessage["sources"]; conversation?: ChatConversation; userMessage?: StoredChatMessage; assistantMessage?: StoredChatMessage }
export function storedMessage(message: StoredChatMessage): StewartMessage {
  return { id: message.id, requestId: message.requestId, role: message.role === "USER" ? "student" : "stewart", status: message.status, createdAt: message.createdAt, text: message.content, sources: message.metadata?.sources, attachments: message.metadata?.attachments, grounded: message.metadata?.grounded };
}
async function conversationRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(`/api/e-learning/stewart/conversations${path}`, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(45000) }); }
  catch { throw new StewartRequestError("Couldn't load your conversations. Check your connection and retry."); }
  if (!res.ok) throw await readError(res, "This conversation couldn't be loaded. Please retry.");
  return res.json();
}
export const listChats = (courseId: string, before?: string) => conversationRequest<{ conversations: ChatConversation[]; nextCursor: string | null }>(`?courseId=${encodeURIComponent(courseId)}${before ? `&before=${encodeURIComponent(before)}` : ""}`);
export const createChat = (ctx: StewartContext, clientKey: string, question: string, requestId: string) => conversationRequest<{ conversation: ChatConversation }>("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ctx, clientKey, message: question, requestId }) });
export const readChat = (id: string, before?: string) => conversationRequest<{ conversation: ChatConversation; messages: StoredChatMessage[]; nextCursor: string | null; attachments: Omit<StewartAttachment, "context">[] }>(`/${encodeURIComponent(id)}${before ? `?before=${encodeURIComponent(before)}` : ""}`);
export const deleteChat = (id: string) => conversationRequest<{ deleted: boolean }>(`/${encodeURIComponent(id)}`, { method: "DELETE", signal: AbortSignal.timeout(120000) });
