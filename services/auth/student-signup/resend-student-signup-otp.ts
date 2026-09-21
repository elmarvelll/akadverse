// services/auth/student-signup/resend-student-signup-otp.ts
//
// Issues a fresh OTP for a pending sign-up. The previous code stops working (its hash is overwritten), attempts reset,
// and a cooldown limits how often a code can be requested.

import { prisma } from "@/lib/prisma";
import { notFound, tooManyRequests } from "@/lib/service-error";
import { SIGNUP_OTP_RESEND_COOLDOWN_MS, SIGNUP_OTP_TTL_MS } from "./config";
import { generateOtp, hashOtp } from "./otp";
import { sendSignupOtpEmail, type OtpSender } from "./send-otp-email";

export async function resendStudentSignupOtp(pendingId: string, send: OtpSender = sendSignupOtpEmail) {
  const pending = await prisma.pendingSignup.findUnique({ where: { id: String(pendingId) } });
  if (!pending) throw notFound("That sign-up has expired. Please start again.");
  const wait = pending.otpLastSentAt.getTime() + SIGNUP_OTP_RESEND_COOLDOWN_MS - Date.now();
  if (wait > 0) throw tooManyRequests(`Please wait ${Math.ceil(wait / 1000)} seconds before requesting another code.`);

  const code = generateOtp();
  const now = new Date();
  await prisma.pendingSignup.update({
    where: { id: pending.id },
    data: { otpHash: hashOtp(code, pending.email), otpExpiresAt: new Date(now.getTime() + SIGNUP_OTP_TTL_MS), otpAttempts: 0, otpLastSentAt: now },
  });
  await send(pending.email, code);
  return { email: pending.email, expiresInSeconds: Math.round(SIGNUP_OTP_TTL_MS / 1000), resendAfterSeconds: Math.round(SIGNUP_OTP_RESEND_COOLDOWN_MS / 1000) };
}
