// services/e-learning/student/stewart/upload-attachment.ts
//
// A student attaches a document to their Stewart conversation.
//
//   validate (type by extension AND by the file's own bytes; size)  ->  extract usable content
//   (text for docx/pptx/txt/md; a PDF is kept as a PDF, which the model reads natively)  ->  store it for the session
//   with the model provider's Files API (auto-expiring)  ->  return a signed, user-bound handle (attachment-token.ts).
//
// What the model later receives is the document's actual content — never just a file name or a link. Nothing is
// written to the course-materials bucket or the database, and no storage URL or credential reaches the browser.
// If any step fails, nothing is left behind and the student gets a specific message.

import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { badRequest, ServiceError } from "@/lib/service-error";
import { checkStewartAttachment, extensionOfFile, isStewartImage, STEWART_ATTACHMENT_TTL_SECONDS, type StewartAttachmentKind } from "@/lib/stewart/config";
import { extractText, looksLikePdf } from "./extract-text";
import { signAttachment } from "./attachment-token";
import { isStewartConfigured, stewartClient } from "./client";
import { enforceRateLimit } from "./rate-limit";

export interface UploadedAttachment {
  // Opaque handle to send back with each question.
  token: string;
  name: string;
  kind: StewartAttachmentKind;
  // The document was longer than the limit; only the beginning is available to Stewart.
  truncated: boolean;
  expiresAt: string;
}

export const stewartUnavailable = () => new ServiceError(503, "Stewart isn't set up on this server yet. Please try again later.");

// Display name only: no path components, control characters, or absurd lengths.
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || "document";
}

export async function uploadStewartAttachment(userId: string, file: { name: string; bytes: Uint8Array }): Promise<UploadedAttachment> {
  if (!isStewartConfigured()) throw stewartUnavailable();
  enforceRateLimit(`upload:${userId}`, { limit: 10, windowMs: 10 * 60 * 1000 });

  const name = cleanFileName(file.name);
  const problem = checkStewartAttachment(name, file.bytes.byteLength);
  if (problem) throw badRequest(problem);
  const kind = extensionOfFile(name) as StewartAttachmentKind;

  let upload: { bytes: Uint8Array; fileName: string; mime: string };
  let truncated = false;
  if (kind === "pdf") {
    if (!looksLikePdf(file.bytes)) throw badRequest("That file isn't a valid PDF.");
    upload = { bytes: file.bytes, fileName: "attachment.pdf", mime: "application/pdf" };
  } else if (isStewartImage(kind)) {
    try {
      const { default: sharp } = await import("sharp");
      const image = sharp(file.bytes, { limitInputPixels: 25_000_000, animated: false });
      const meta = await image.metadata();
      const expected = kind === "jpg" ? "jpeg" : kind;
      if (meta.format !== expected) throw new Error("Wrong image format");
      const bytes = await image.rotate().png().toBuffer();
      if (bytes.length > 16 * 1024 * 1024) throw new Error("Image too large");
      upload = { bytes, fileName: "attachment.png", mime: "image/png" };
    } catch {
      throw badRequest("That image is unreadable, too large, or does not match its file extension.");
    }
  } else {
    const extracted = kind === "doc" || kind === "ppt" ? await (await import("./legacy-office")).extractLegacyOffice(kind, file.bytes) : extractText(kind, file.bytes);
    truncated = extracted.truncated;
    upload = { bytes: new TextEncoder().encode(extracted.text), fileName: "attachment.txt", mime: "text/plain" };
  }

  let fileId: string;
  try {
    const stored = await stewartClient().files.upload({
      file: await toFile(upload.bytes, upload.fileName, { type: upload.mime }),
      expires_in_seconds: STEWART_ATTACHMENT_TTL_SECONDS,
    });
    fileId = stored.id;
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      throw badRequest("We couldn't process that document. It may be damaged or password-protected.");
    }
    console.error("[stewart] attachment upload failed", err instanceof Anthropic.APIError ? { status: err.status, name: err.name } : err);
    throw new ServiceError(503, "We couldn't prepare that document right now. Please try again in a moment.");
  }

  const exp = Math.floor(Date.now() / 1000) + STEWART_ATTACHMENT_TTL_SECONDS;
  return {
    token: signAttachment({ fileId, userId, name, kind, truncated, exp }),
    name,
    kind,
    truncated,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

// The student removed (or replaced) the attachment before its expiry: delete the stored copy now. Best-effort — the
// file expires on its own regardless.
export async function deleteStewartAttachment(fileId: string): Promise<void> {
  if (!isStewartConfigured()) return;
  try {
    await stewartClient().files.delete(fileId);
  } catch (err) {
    console.warn("[stewart] attachment delete failed (it will expire on its own)", err instanceof Anthropic.APIError ? err.status : err);
  }
}
