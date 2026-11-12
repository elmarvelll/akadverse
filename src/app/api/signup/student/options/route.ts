// GET /api/signup/student/options — the sign-up form's dropdown data (from the E-Learning database) and the student domain.
import { NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { getStudentSignupOptions } from "@/services/auth/student-signup/get-signup-options";

export async function GET() {
  return runController(async () => NextResponse.json(await getStudentSignupOptions(), { headers: { "Cache-Control": "no-store" } }));
}
