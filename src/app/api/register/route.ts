// src/app/api/register/route.ts
//
// RETIRED. This endpoint used to create Faculty / HOD / DAPU accounts directly, without verifying that the person owns
// the email address. Every account type now signs up with an emailed OTP:
//   Student            -> /api/signup/student/{start,verify,resend}
//   Faculty, HOD, DAPU -> /api/signup/staff/{start,verify,resend}
// It stays as a stub (rather than being deleted) so an old client or script gets a clear answer instead of a 404, and
// so it can never again be used to create an unverified account.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Sign-up now verifies your email with a one-time code. Please sign up from the sign-up page." },
    { status: 410 },
  );
}
