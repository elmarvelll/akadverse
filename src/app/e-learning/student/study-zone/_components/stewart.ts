// Stewart, the Study Zone's AI study assistant — browser client.
//
// Talks to the two Stewart routes (/api/e-learning/stewart/chat and /attachments); the model itself is only ever
// called from the server. Everything the server refuses (not signed in, not registered for the course, file too
// large, unreadable document, Stewart not configured, provider busy) comes back as `{ error }` written for students,
// and is thrown here as an Error with that message so the panel can show it as-is.

import { checkStewartAttachment, type StewartAttachmentKind } from "@/lib/stewart/config";

export interface StewartContext {
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
  // Shown in the log but never sent back to the server (the greeting, error notices).
  local?: boolean;
}

// A document the student attached to this chat session. `token` is an opaque server-signed handle.
export interface StewartAttachment {
  token: string;
  name: string;
  kind: StewartAttachmentKind;
  truncated: boolean;
  expiresAt: string;
}

export const STEWART_SUGGESTIONS = ["Summarise the document I attached", "Explain the key terms", "Quiz me on this topic"];

const GENERIC = "Stewart couldn't answer just now. Please try again.";

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return typeof body.error === "string" && body.error ? body.error : fallback;
}

// The opening line of a conversation (local only — not part of what the model sees).
export function startThread(ctx: StewartContext, threadKey: string): StewartMessage[] {
  const about = ctx.documentTitle ? `Week ${ctx.weekNumber} of ${ctx.courseCode}` : `${ctx.courseCode}`;
  return [
    {
      id: `${threadKey}-0`,
      role: "stewart",
      local: true,
      text: `Hi! I'm Stewart. Ask me anything about ${about}. To ask about a specific document, attach it with the paperclip button — I can only read documents you attach here.`,
    },
  ];
}

export async function askStewart(messages: StewartMessage[], ctx: StewartContext, attachment: StewartAttachment | StewartAttachment[] | null): Promise<{ reply: string; truncated: boolean }> {
  let res: Response;
  try {
    res = await fetch("/api/e-learning/stewart/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        courseId: ctx.courseId,
        weekNumber: ctx.weekNumber,
        documentId: ctx.documentId,
        messages: messages.filter((m) => !m.local).map((m) => ({ role: m.role, text: m.text })),
        attachments: (Array.isArray(attachment) ? attachment : attachment ? [attachment] : []).map((a) => a.token),
      }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(await readError(res, GENERIC));
  const body = (await res.json().catch(() => null)) as { reply?: string; truncated?: boolean } | null;
  if (!body || typeof body.reply !== "string") throw new Error(GENERIC);
  return { reply: body.reply, truncated: Boolean(body.truncated) };
}

// Validates locally for a fast message, then uploads; the server re-validates everything.
export async function attachDocument(file: File, signal?: AbortSignal): Promise<StewartAttachment> {
  const problem = checkStewartAttachment(file.name, file.size);
  if (problem) throw new Error(problem);
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/e-learning/stewart/attachments", { method: "POST", body: form, cache: "no-store", signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("The upload was interrupted. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(await readError(res, "We couldn't attach that document. Please try again."));
  return (await res.json()) as StewartAttachment;
}

// Best-effort: the stored copy also expires on its own.
export function discardAttachment(attachment: StewartAttachment): void {
  void fetch("/api/e-learning/stewart/attachments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: attachment.token }),
    keepalive: true,
  }).catch(() => {});
}
