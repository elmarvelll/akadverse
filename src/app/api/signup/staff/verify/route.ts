// POST /api/signup/staff/verify { pendingId, code } — check the OTP and create the Faculty / HOD / DAPU account.
import { NextResponse } from "next/server";
import { readJsonBody, runController } from "@/lib/controller-helpers";
import { verifyStaffSignup } from "@/services/auth/staff-signup/verify-staff-signup";

export async function POST(request: Request) {
  return runController(async () => {
    const { pendingId, code } = await readJsonBody<{ pendingId: string; code: string }>(request);
    const { email } = await verifyStaffSignup(pendingId, code);
    return NextResponse.json({ email }); // no user id / no secrets: the browser then signs in normally
  });
}
