// POST /api/signup/student/verify { pendingId, code } — check the OTP and create the User + StudentProfile.
import { NextResponse } from "next/server";
import { readJsonBody, runController } from "@/lib/controller-helpers";
import { verifyStudentSignup } from "@/services/auth/student-signup/verify-student-signup";

export async function POST(request: Request) {
  return runController(async () => {
    const { pendingId, code } = await readJsonBody<{ pendingId: string; code: string }>(request);
    const { email } = await verifyStudentSignup(pendingId, code);
    return NextResponse.json({ email }); // no user id / no secrets: the browser then signs in normally
  });
}
