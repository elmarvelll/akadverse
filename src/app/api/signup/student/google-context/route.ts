// GET /api/signup/student/google-context?token=… — the identity Google verified, read from the server-signed token
// (so the form can show the locked institutional email and prefill the name). 400 if it is forged or expired.
import { NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { readGoogleSignupToken } from "@/services/auth/student-signup/google-signup-token";

export async function GET(request: Request) {
  return runController(async () => {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    return NextResponse.json(await readGoogleSignupToken(token), { headers: { "Cache-Control": "no-store" } });
  });
}
