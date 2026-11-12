// services/auth/student-signup/start-student-signup.ts
//
// Step 1 of student sign-up: validate everything, then email a 6-digit OTP. Nothing is written to `User` or to the
// E-Learning database yet — only a PendingSignup row (hashed OTP + the validated details).
//
// Nothing here trusts the browser: the email is rebuilt from the local part + the STUDENT role's domain, the domain is
// re-checked, and the College -> Department -> Programme chain is re-validated against the E-Learning database.
// For Google sign-ups the identity comes from the server-signed token, never from a typed email.

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict } from "@/lib/service-error";
import { buildEmail, isEmailForRole, isValidLocalPart } from "@/lib/account-domains";
import { assertMatricAvailable, normalizeMatricNumber, resolveAcademicSelection } from "@/services/e-learning/student/signup-academics";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, STUDENT_ROLE } from "@/services/auth/signup-otp/config";
import { issueSignupOtp } from "@/services/auth/signup-otp/issue-signup-otp";
import { readGoogleSignupToken } from "./google-signup-token";
import { sendSignupOtpEmail, type OtpSender } from "@/services/auth/signup-otp/send-otp-email";

export interface StartStudentSignupInput {
  firstName: string;
  lastName: string;
  localPart?: string;
  password?: string;
  googleToken?: string;
  matricNumber: string;
  collegeId: string;
  departmentId: string;
  programmeId: string;
  level: number;
}

const BCRYPT_ROUNDS = 10;

function cleanName(value: unknown, label: string) {
  const v = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!v) throw badRequest(`Enter your ${label}.`);
  if (v.length > 60) throw badRequest(`Your ${label} is too long.`);
  return v;
}

export async function startStudentSignup(input: StartStudentSignupInput, send: OtpSender = sendSignupOtpEmail) {
  const isGoogle = !!input.googleToken;

  // ---- identity: who is signing up, and with which email ------------------------------------------------------------
  let email: string;
  let firstName: string;
  let lastName: string;
  let passwordHash: string | null = null;
  if (isGoogle) {
    const g = await readGoogleSignupToken(String(input.googleToken));
    email = g.email.trim().toLowerCase();
    firstName = cleanName(input.firstName || g.firstName, "first name");
    lastName = cleanName(input.lastName || g.lastName, "last name");
  } else {
    const localPart = String(input.localPart ?? "").trim();
    if (!localPart || !isValidLocalPart(localPart)) throw badRequest("Enter the part of your student email before the @.");
    email = buildEmail(localPart, STUDENT_ROLE); // role -> domain, decided here on the server
    firstName = cleanName(input.firstName, "first name");
    lastName = cleanName(input.lastName, "last name");
    const password = String(input.password ?? "");
    if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password.length > MAX_PASSWORD_LENGTH) throw badRequest(`Password can be at most ${MAX_PASSWORD_LENGTH} characters.`);
    passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }
  // The one domain rule, applied to the final address whichever way it was produced.
  if (!isEmailForRole(email, STUDENT_ROLE)) throw badRequest("Students must use their student email address (@stu.cu.edu.ng).");

  // ---- academic details ---------------------------------------------------------------------------------------------
  const matricNumber = normalizeMatricNumber(input.matricNumber);
  const { college, department, programme, level } = await resolveAcademicSelection({
    collegeId: input.collegeId, departmentId: input.departmentId, programmeId: input.programmeId, level: Number(input.level),
  });

  // ---- duplicates ---------------------------------------------------------------------------------------------------
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  let existingUserId: string | null = null;
  if (existing) {
    if (existing.role !== STUDENT_ROLE) throw conflict("An account with that email already exists.");
    if (await elearningDb.studentProfile.findUnique({ where: { userId: existing.id } })) throw conflict("You're already registered. Please sign in instead.");
    existingUserId = existing.id; // an older account with no student profile: the profile is attached to it, no second user
  }
  await assertMatricAvailable(matricNumber, existingUserId ?? undefined);

  // ---- issue the OTP to this exact address (shared with every account type) ------------------------------------------
  const issued = await issueSignupOtp(
    email,
    {
      role: STUDENT_ROLE,
      authMethod: isGoogle ? "google" : "credentials",
      passwordHash,
      firstName,
      lastName,
      payload: { matricNumber, collegeId: college.id, departmentId: department.id, programmeId: programme.id, level },
      existingUserId,
    },
    send,
  );
  return { ...issued, mode: existingUserId ? ("link" as const) : ("create" as const) };
}
