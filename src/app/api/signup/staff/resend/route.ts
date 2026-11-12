// POST /api/signup/staff/resend { pendingId } — a fresh OTP (the old one stops working; cooldown applies).
import { NextResponse } from "next/server";
import { readJsonBody, runController } from "@/lib/controller-helpers";
import { resendSignupOtp } from "@/services/auth/signup-otp/resend-signup-otp";

export async function POST(request: Request) {
  return runController(async () => {
    const { pendingId } = await readJsonBody<{ pendingId: string }>(request);
    return NextResponse.json(await resendSignupOtp(pendingId));
  });
}
