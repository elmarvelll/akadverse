// services/auth/student-signup/otp.ts
//
// Sign-up OTP primitives. Reuses the shared 6-digit generator from src/lib/otp.ts (cryptographically random) and stores
// only a keyed hash of the code (HMAC-SHA256 with the server secret, bound to the email), so a database leak does not
// reveal live codes. Comparison is constant-time.

import { createHmac, timingSafeEqual } from "node:crypto";
import { generateOtp } from "@/lib/otp";

export { generateOtp };

export function hashOtp(code: string, email: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`${email.toLowerCase()}:${code.replace(/\s+/g, "")}`).digest("hex");
}

export function otpMatches(code: string, email: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code, email), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
