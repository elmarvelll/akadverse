import { createPrivateKey, createPublicKey, sign, verify, timingSafeEqual, randomUUID } from "node:crypto";
import { ServiceError, unauthorized } from "@/lib/service-error";

const ISSUER = "akadverse-productivity";
export const SERVICE_PATH = "/api/productivity/assistant/service";
export type Delegation = { sub: string; cid: string; turn: string; aud: string; iss: string; exp: number; iat: number; jti: string };
const key = (name: string) => process.env[name]?.replace(/\\n/g, "\n").trim();
export function serviceSecret() {
  const secret = process.env.PRODUCTIVITY_AI_SERVICE_TOKEN?.trim();
  if (!secret || secret.length < 32) throw new ServiceError(503, "The Productivity Assistant service credentials are not configured.");
  return secret;
}
export function checkServiceSecret(value: string | null) {
  const expected = Buffer.from(serviceSecret()), actual = Buffer.from(value || "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw unauthorized("Invalid assistant service credentials.");
}
export function publicSigningKey() {
  const publicKey = key("PRODUCTIVITY_AI_JWT_PUBLIC_KEY");
  if (publicKey) return createPublicKey(publicKey);
  const privateKey = key("PRODUCTIVITY_AI_JWT_PRIVATE_KEY");
  if (!privateKey) throw new ServiceError(503, "The Productivity Assistant signing key is not configured.");
  return createPublicKey(createPrivateKey(privateKey));
}
export function signDelegation(ownerId: string, conversationId: string, turn: string, audience: "akadverse-productivity-ai" | "akadverse-productivity-backend") {
  const privateKey = key("PRODUCTIVITY_AI_JWT_PRIVATE_KEY");
  if (!privateKey) throw new ServiceError(503, "The Productivity Assistant signing key is not configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: process.env.PRODUCTIVITY_AI_JWT_KEY_ID || "productivity-v1" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: ownerId, cid: conversationId, turn, iss: ISSUER, aud: audience, iat: now, nbf: now - 5, exp: now + 300, jti: randomUUID() })).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}
export function verifyDelegation(token: string, audience = "akadverse-productivity-backend"): Delegation {
  try {
    if (token.length > 8192) throw new Error();
    const parts = token.split("."); if (parts.length !== 3) throw new Error();
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (header.alg !== "RS256" || header.typ !== "JWT" || header.kid !== (process.env.PRODUCTIVITY_AI_JWT_KEY_ID || "productivity-v1")) throw new Error();
    if (!verify("RSA-SHA256", Buffer.from(parts.slice(0, 2).join(".")), publicSigningKey(), Buffer.from(parts[2], "base64url"))) throw new Error();
    const value = JSON.parse(Buffer.from(parts[1], "base64url").toString()), now = Math.floor(Date.now() / 1000);
    if (value.iss !== ISSUER || value.aud !== audience || !Number.isInteger(value.exp) || value.exp <= now || !Number.isInteger(value.iat) || value.iat > now + 5 || value.exp - value.iat > 300 || !Number.isInteger(value.nbf) || value.nbf > now + 5) throw new Error();
    for (const field of ["sub", "cid", "turn", "jti"]) if (typeof value[field] !== "string" || !value[field] || value[field].length > 200) throw new Error();
    return value as Delegation;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 503) throw error;
    throw unauthorized("Invalid or expired assistant delegation.");
  }
}
export function assistantServiceUrl() {
  const raw = process.env.PRODUCTIVITY_AI_SERVICE_URL;
  if (!raw) throw new ServiceError(503, "The Productivity Assistant is not configured yet. You can still use the workspace forms.");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new ServiceError(503, "The Productivity Assistant service address is invalid.");
  return url;
}
