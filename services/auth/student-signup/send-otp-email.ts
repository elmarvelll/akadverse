// services/auth/student-signup/send-otp-email.ts
//
// Emails the sign-up code through the project's existing email provider (Resend, via the shared sendEmail()).
// The code goes only into the email BODY (never the subject: sendEmail() logs subjects). It is never returned by an API and never logged in production; in
// development with no RESEND_API_KEY the (otherwise silent) send is made usable by printing the code to the
// server console — that branch is dead code in production.

import { sendEmail } from "@/services/marketplace/notifications/email.service";
import { SIGNUP_OTP_TTL_MS } from "./config";

export type OtpSender = (to: string, code: string) => Promise<void>;

export const sendSignupOtpEmail: OtpSender = async (to, code) => {
  const minutes = Math.round(SIGNUP_OTP_TTL_MS / 60000);
  await sendEmail({
    to,
    // The subject is written to the server log by sendEmail() on every send, so the code must NEVER be in it — body only.
    subject: "Your AkadVerse verification code",
    type: "student_signup_otp",
    html: `<!doctype html><html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #eaeaea;">
        <h1 style="font-size:18px;margin:0 0 16px;">Verify your student email</h1>
        <p style="margin:0 0 16px;">Use this code to finish creating your AkadVerse account:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;">${code}</p>
        <p style="margin:0;color:#555;font-size:14px;">It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.</p>
      </div></body></html>`,
  });
  if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
    console.warn(`[dev] student sign-up OTP for ${to}: ${code}`);
  }
};
