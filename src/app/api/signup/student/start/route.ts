// POST /api/signup/student/start — validate the sign-up and email the OTP. Never returns the code.
import { NextResponse } from "next/server";
import { readJsonBody, runController } from "@/lib/controller-helpers";
import { startStudentSignup, type StartStudentSignupInput } from "@/services/auth/student-signup/start-student-signup";

export async function POST(request: Request) {
  return runController(async () => {
    const body = await readJsonBody<StartStudentSignupInput>(request);
    return NextResponse.json(await startStudentSignup(body), { status: 201 });
  });
}
