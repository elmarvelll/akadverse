import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { RevisionWebhookError } from "./errors";
export const MAX_REVISION_BODY_BYTES = 256 * 1024;
export const MAX_AGE_MS = 5 * 60 * 1000;
export const FUTURE_SKEW_MS = 30 * 1000;
export function utcTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)) return;
  // Python datetime.isoformat() emits microseconds. Normalize only for
  // millisecond clock comparison; preserve the original header for diagnostics.
  const parsed = Date.parse(value.replace(/(\.\d{3})\d+/, "$1"));
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)) return;
  return parsed;
}
// Temporary failure-only diagnostics: never log the secret or request body.
function signatureDebug(request: Request, correlationId: string, secret: string, reason: string, raw?: Buffer, expected?: Buffer) {
  const configured = process.env.AI_WEBHOOK_SECRET;
  console.log("[revision-questions] sig_debug", {
    correlationId,
    signatureReceived: request.headers.get("x-akadverse-signature"),
    signatureComputed: expected?.toString("hex") ?? null,
    bodySha256: raw ? createHash("sha256").update(raw).digest("hex") : null,
    bodyLength: raw?.byteLength ?? null,
    timestampReceived: request.headers.get("x-akadverse-timestamp"),
    idempotencyKeyReceived: request.headers.get("idempotency-key"),
    secretEnvironmentVariable: "AI_WEBHOOK_SECRET",
    configuredSecretByteLength: configured === undefined ? null : Buffer.byteLength(configured, "utf8"),
    effectiveSecretByteLength: Buffer.byteLength(secret, "utf8"),
    configuredSecretHasOuterWhitespace: configured === undefined ? null : configured !== configured.trim(),
    configuredSecretHasControlCharacters: configured === undefined ? null : /[\x00-\x1f\x7f]/.test(configured),
    reason,
  });
}
export async function authenticateRevisionRequest(request: Request, secret = process.env.AI_WEBHOOK_SECRET?.trim(), now = Date.now(), correlationId: string = randomUUID()) {
  if (!secret) throw new RevisionWebhookError(503, "WEBHOOK_NOT_CONFIGURED", "Revision webhook authentication is not configured.");
  const signature = request.headers.get("x-akadverse-signature") || "", timestamp = request.headers.get("x-akadverse-timestamp"), time = utcTimestamp(timestamp);
  if (!/^[a-f0-9]{64}$/i.test(signature) || time === undefined) {
    signatureDebug(request, correlationId, secret, "invalid_auth_headers");
    throw new RevisionWebhookError(401, "INVALID_SIGNATURE", "Invalid webhook authentication.");
  }
  if (now - time > MAX_AGE_MS || time - now > FUTURE_SKEW_MS) {
    signatureDebug(request, correlationId, secret, "timestamp_outside_window");
    throw new RevisionWebhookError(401, "EXPIRED_TIMESTAMP", "The webhook timestamp is outside the accepted window.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new RevisionWebhookError(415, "UNSUPPORTED_CONTENT_TYPE", "Send application/json.");
  const reader = request.body?.getReader(); if (!reader) throw new RevisionWebhookError(400, "EMPTY_BODY", "A JSON request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_REVISION_BODY_BYTES) { await reader.cancel(); throw new RevisionWebhookError(413, "PAYLOAD_TOO_LARGE", "The revision payload exceeds 256 KiB."); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  const expected = createHmac("sha256", secret).update(raw).digest(), supplied = Buffer.from(signature, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    signatureDebug(request, correlationId, secret, "hmac_mismatch", raw, expected);
    throw new RevisionWebhookError(401, "INVALID_SIGNATURE", "Invalid webhook authentication.");
  }
  return { raw, bodyHash: createHash("sha256").update(raw).digest("hex"), idempotencyKey: request.headers.get("idempotency-key") || "" };
}
