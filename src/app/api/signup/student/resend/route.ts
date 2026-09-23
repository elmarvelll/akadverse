// POST /api/signup/student/resend { pendingId } — a fresh OTP (the old one stops working; cooldown applies).
import { NextResponse } from "next/server";
import { readJsonBody, runController } from "@/lib/controller-helpers";
import { resendStudentSignupOtp } from "@/services/auth/student-signup/resend-student-signup-otp";

export async function POST(request: Request) {
  return runController(async () => {
    const { pendingId } = await readJsonBody<{ pendingId: string }>(request);
    return NextResponse.json(await resendStudentSignupOtp(pendingId));
  });
}
