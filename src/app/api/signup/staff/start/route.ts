// POST /api/signup/staff/start — Faculty / HOD / DAPU: validate the sign-up and email the OTP. Never returns the code.
import { NextResponse } from "next/server";
import { readJsonBody, runController } from "@/lib/controller-helpers";
import { startStaffSignup, type StartStaffSignupInput } from "@/services/auth/staff-signup/start-staff-signup";

export async function POST(request: Request) {
  return runController(async () => {
    const body = await readJsonBody<StartStaffSignupInput>(request);
    return NextResponse.json(await startStaffSignup(body), { status: 201 });
  });
}
