// services/auth/signup-otp/claim-signup-otp.ts
//
// Step 2 of EVERY sign-up: check the code and CLAIM it atomically, so a second concurrent verify with the same code
// can't also succeed. Wrong codes count against a per-code attempt limit; expired codes are refused. The caller then
// creates the account, and calls `release()` if that fails so the person can retry with the same code.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound, tooManyRequests } from "@/lib/service-error";
import { SIGNUP_OTP_MAX_ATTEMPTS } from "./config";
import { otpMatches } from "./otp";

export async function claimSignupOtp(pendingId: string, code: string) {
  const pending = await prisma.pendingSignup.findUnique({ where: { id: String(pendingId) } });
  if (!pending) throw notFound("That sign-up has expired. Please start again.");
  if (pending.otpAttempts >= SIGNUP_OTP_MAX_ATTEMPTS) throw tooManyRequests("Too many wrong codes. Request a new code to continue.");
  if (pending.otpExpiresAt.getTime() < Date.now()) throw badRequest("That code has expired. Request a new one.");
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) throw badRequest("Enter the 6-digit code.");

  if (!otpMatches(clean, pending.email, pending.otpHash)) {
    const { otpAttempts } = await prisma.pendingSignup.update({ where: { id: pending.id }, data: { otpAttempts: { increment: 1 } } });
    const left = SIGNUP_OTP_MAX_ATTEMPTS - otpAttempts;
    throw badRequest(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Request a new code to continue.");
  }

  // Claim the OTP: only one caller can flip it from the real hash to the "used" marker.
  const usedMarker = `used:${randomUUID()}`;
  const claimed = await prisma.pendingSignup.updateMany({ where: { id: pending.id, otpHash: pending.otpHash }, data: { otpHash: usedMarker } });
  if (claimed.count !== 1) throw conflict("That code was just used. If you're not signed in yet, please sign in.");
  const release = () => prisma.pendingSignup.updateMany({ where: { id: pending.id, otpHash: usedMarker }, data: { otpHash: pending.otpHash } });
  return { pending, release };
}
