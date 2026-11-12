// Pure policy shared by upload, worker and tests. Normal uploads keep their own limits.
const MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
export function eligibility(m: { type: string; mimeType: string; fileSize: number }) {
  if (m.type !== "NOTES") return "ineligible";
  return MIME_TYPES.has(m.mimeType) && m.fileSize > 0 && m.fileSize <= 20 * 1024 * 1024 ? "eligible" : "unsupported";
}
export function positiveSetting(name: string, fallback: number, max: number) {
  const n = Number(process.env[name]);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
export function retryDelay(attempt: number, random = Math.random()) {
  const base = positiveSetting("AI_INGEST_RETRY_BASE_SECONDS", 60, 3600);
  const cap = positiveSetting("AI_INGEST_RETRY_MAX_SECONDS", 3600, 86400);
  return Math.round(Math.min(cap, base * 2 ** Math.min(20, Math.max(0, attempt - 1))) * (0.5 + random * 0.5) * 1000);
}
// Arbitrary upstream text can contain tokens, URLs, stack traces or document content.
// Persist only a classification from known processing errors.
export function safeProcessingError(message?: string | null) {
  if (/scanned|ocr|no extractable|empty document/i.test(message ?? "")) return "No extractable text. Scanned documents require OCR, which is unavailable.";
  if (/corrupt|invalid file|unsupported/i.test(message ?? "")) return "The document is corrupt or unsupported.";
  if (/quota|rate limit|provider/i.test(message ?? "")) return "AI provider processing failed. Administrator review required.";
  return "AI processing failed. Administrator review required.";
}
