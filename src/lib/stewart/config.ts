// src/lib/stewart/config.ts
//
// Limits and supported formats for Stewart (the Study Zone AI assistant), shared by the browser (fast feedback) and
// the server (the actual enforcement — every limit here is re-checked in services/e-learning/student/stewart/*).

// Up to eight files per conversation. PDFs/images are read natively; Office/text files are extracted server-side.
export const STEWART_ATTACHMENT_TYPES = {
  doc: { label: "Word", mime: ["application/msword"] },
  ppt: { label: "PowerPoint", mime: ["application/vnd.ms-powerpoint"] },
  png: { label: "Image", mime: ["image/png"] },
  jpg: { label: "Image", mime: ["image/jpeg"] },
  jpeg: { label: "Image", mime: ["image/jpeg"] },
  webp: { label: "Image", mime: ["image/webp"] },
  pdf: { label: "PDF", mime: ["application/pdf"] },
  docx: { label: "Word", mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  pptx: { label: "PowerPoint", mime: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
  txt: { label: "Text", mime: ["text/plain"] },
  md: { label: "Markdown", mime: ["text/markdown", "text/x-markdown", "text/plain"] },
} as const;
export type StewartAttachmentKind = keyof typeof STEWART_ATTACHMENT_TYPES;
export const STEWART_ATTACHMENT_ACCEPT = Object.keys(STEWART_ATTACHMENT_TYPES).map((ext) => `.${ext}`).join(",");

// 4 MB: the upload passes through a serverless function, whose request body limit on the current host is ~4.5 MB
// (course materials avoid this by uploading straight to Storage; a chat attachment has to be read by the server).
export const STEWART_MAX_ATTACHMENTS = 8;
export const isStewartImage = (kind: string) => ["png", "jpg", "jpeg", "webp"].includes(kind);
export const STEWART_MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const STEWART_MAX_ATTACHMENT_MB = STEWART_MAX_ATTACHMENT_BYTES / (1024 * 1024);

// Extracted text beyond this is cut, and BOTH the student and the model are told (never silently): roughly 75-100k
// tokens, which keeps one question on a big document within a sensible cost.
export const STEWART_MAX_EXTRACTED_CHARS = 300_000;

export const STEWART_MAX_MESSAGE_CHARS = 4_000;
// Older turns beyond this are dropped from what's sent (the attached document itself is always kept).
export const STEWART_MAX_HISTORY_MESSAGES = 24;

// How long an uploaded attachment stays usable. The file is stored with the AI provider with this expiry and the
// signed handle the browser holds expires at the same time — "this chat session", not permanent storage.
export const STEWART_ATTACHMENT_TTL_SECONDS = 6 * 60 * 60;

export const extensionOfFile = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

// Returns a message for the student, or null when the file is acceptable. Used on both sides.
export function checkStewartAttachment(name: string, size: number): string | null {
  const ext = extensionOfFile(name);
  if (!Object.hasOwn(STEWART_ATTACHMENT_TYPES, ext)) return "That file type isn't supported. Attach a PDF, Word, PowerPoint, text, PNG, JPEG, or WebP file.";
  if (size <= 0) return "That file is empty.";
  if (size > STEWART_MAX_ATTACHMENT_BYTES) return `That file is too large. The maximum is ${STEWART_MAX_ATTACHMENT_MB} MB.`;
  return null;
}
