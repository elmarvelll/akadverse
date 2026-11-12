// services/auth/signup-otp/issue-signup-otp.ts
//
// Step 1 of EVERY sign-up (Student, Faculty, HOD, DAPU): after the caller has validated the details, store them on a
// PendingSignup (with only a hash of the code) and email a 6-digit OTP to that exact address. No User exists until the
// code is verified. Applies the resend cooldown and the site-wide circuit breaker on brand-new sign-ups.

import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tooManyRequests } from "@/lib/service-error";
import { MAX_NEW_SIGNUPS_PER_WINDOW, NEW_SIGNUP_WINDOW_MS, PENDING_SIGNUP_RETENTION_MS, SIGNUP_OTP_RESEND_COOLDOWN_MS, SIGNUP_OTP_TTL_MS } from "./config";
import { generateOtp, hashOtp } from "./otp";
import { sendSignupOtpEmail, type OtpSender } from "./send-otp-email";

export interface PendingDetails {
  // The account type the person signed up AS (from the email's domain). Descriptive only: completing a sign-up
  // re-derives everything from the email and never grants a role from this field.
  role: Role;
  authMethod: "credentials" | "google";
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  payload: Prisma.InputJsonValue;
  existingUserId?: string | null;
}

export async function issueSignupOtp(email: string, details: PendingDetails, send: OtpSender = sendSignupOtpEmail) {
  // Housekeeping, then the resend cooldown / circuit breaker.
  await prisma.pendingSignup.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PENDING_SIGNUP_RETENTION_MS) } } });
  const pending = await prisma.pendingSignup.findUnique({ where: { email } });
  if (!pending) {
    // A brand-new sign-up (not a resend for one already in progress): apply the site-wide circuit breaker.
    const recent = await prisma.pendingSignup.count({ where: { createdAt: { gte: new Date(Date.now() - NEW_SIGNUP_WINDOW_MS) } } });
    if (recent >= MAX_NEW_SIGNUPS_PER_WINDOW) throw tooManyRequests("Sign-up is very busy right now. Please try again in a few minutes.");
  } else {
    const wait = pending.otpLastSentAt.getTime() + SIGNUP_OTP_RESEND_COOLDOWN_MS - Date.now();
    if (wait > 0) throw tooManyRequests(`Please wait ${Math.ceil(wait / 1000)} seconds before requesting another code.`);
  }

  // Issue the OTP (replaces any earlier one for this email).
  const code = generateOtp();
  const now = new Date();
  const data = {
    ...details,
    existingUserId: details.existingUserId ?? null,
    otpHash: hashOtp(code, email),
    otpExpiresAt: new Date(now.getTime() + SIGNUP_OTP_TTL_MS),
    otpAttempts: 0,
    otpLastSentAt: now,
  };
  const row = await prisma.pendingSignup.upsert({ where: { email }, create: { email, ...data }, update: data });
  await send(email, code);

  return {
    pendingId: row.id,
    email,
    expiresInSeconds: Math.round(SIGNUP_OTP_TTL_MS / 1000),
    resendAfterSeconds: Math.round(SIGNUP_OTP_RESEND_COOLDOWN_MS / 1000),
  };
}
