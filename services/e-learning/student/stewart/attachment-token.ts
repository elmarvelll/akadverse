// services/e-learning/student/stewart/attachment-token.ts
//
// The handle the browser holds for a document it attached to a Stewart conversation. The document itself is stored
// server-side (with the AI provider's Files API); the browser only ever gets this opaque, signed token and sends it
// back with each question. It binds the stored file to the student who uploaded it and to an expiry, so:
//   - a student can't make Stewart read a file someone else uploaded by guessing or replaying its id;
//   - nothing about where the file lives is usable from the browser (no storage URL, no provider key);
//   - a token stops working when the attachment's lifetime ends.
// HMAC-SHA256 with NEXTAUTH_SECRET (already required by the app), compared in constant time.

import { createHmac, timingSafeEqual } from "node:crypto";
import { badRequest } from "@/lib/service-error";
import type { StewartAttachmentKind } from "@/lib/stewart/config";

export interface AttachmentClaims {
  fileId: string;
  userId: string;
  name: string;
  kind: StewartAttachmentKind;
  truncated: boolean;
  // Unix seconds.
  exp: number;
}

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is not configured.");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`stewart-attachment:${payload}`).digest("base64url");

export function signAttachment(claims: AttachmentClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Throws a student-facing 400 for anything that isn't this user's own, unexpired, untampered attachment.
export function verifyAttachment(token: unknown, userId: string, now: Date = new Date()): AttachmentClaims {
  const invalid = () => badRequest("That attachment is no longer available. Please attach the document again.");
  if (typeof token !== "string" || token.length > 4096) throw invalid();
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) throw invalid();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid();

  let claims: AttachmentClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (claims.userId !== userId || typeof claims.fileId !== "string" || !Number.isFinite(claims.exp)) throw invalid();
  if (claims.exp * 1000 <= now.getTime()) throw invalid();
  return claims;
}
