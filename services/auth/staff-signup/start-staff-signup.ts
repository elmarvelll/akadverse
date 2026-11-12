// services/auth/staff-signup/start-staff-signup.ts
//
// Step 1 of Faculty / HOD / DAPU sign-up: validate everything, then email a 6-digit OTP to the exact address being signed
// up (shared OTP machinery: services/auth/signup-otp). Nothing is written to `User` or to the E-Learning database yet —
// only a PendingSignup row (hashed OTP + the validated details).
//
// Nothing here trusts the browser: the email is rebuilt from the local part + the chosen account type's domain and
// re-checked, and Faculty/HOD's College -> Department is re-validated against the E-Learning database. DAPU is
// university-wide and has neither.

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict } from "@/lib/service-error";
import { buildEmail, isEmailForRole, isValidLocalPart } from "@/lib/account-domains";
import { resolveDepartmentSelection } from "@/services/e-learning/student/signup-academics";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/services/auth/signup-otp/config";
import { issueSignupOtp } from "@/services/auth/signup-otp/issue-signup-otp";
import { sendSignupOtpEmail, type OtpSender } from "@/services/auth/signup-otp/send-otp-email";
import { assertStaffProfileAvailable } from "./create-staff-profile";
import { roleGrantedAtSignup, STAFF_ACCOUNT_TYPES, type StaffAccountType } from "./staff-role";

export interface StartStaffSignupInput {
  accountType: StaffAccountType;
  localPart: string;
  firstName: string;
  lastName: string;
  password: string;
  location?: string;
  collegeId?: string;
  departmentId?: string;
}

export interface StaffPayload {
  accountType: StaffAccountType;
  departmentId: string | null;
  location: string | null;
}

const BCRYPT_ROUNDS = 10;

function cleanName(value: unknown, label: string) {
  const v = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!v) throw badRequest(`Enter your ${label}.`);
  if (v.length > 60) throw badRequest(`Your ${label} is too long.`);
  return v;
}

export async function startStaffSignup(input: StartStaffSignupInput, send: OtpSender = sendSignupOtpEmail) {
  const accountType = input.accountType;
  if (!STAFF_ACCOUNT_TYPES.includes(accountType)) throw badRequest("Choose Faculty, HOD or DAPU.");

  const localPart = String(input.localPart ?? "").trim();
  if (!localPart || !isValidLocalPart(localPart)) throw badRequest("Enter the part of your institutional email before the @.");
  const email = buildEmail(localPart, accountType); // account type -> domain, decided here on the server
  if (!isEmailForRole(email, accountType)) throw badRequest("Please use your institutional email address.");

  const firstName = cleanName(input.firstName, "first name");
  const lastName = cleanName(input.lastName, "last name");
  const password = String(input.password ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw badRequest(`Password can be at most ${MAX_PASSWORD_LENGTH} characters.`);
  const location = String(input.location ?? "").trim().slice(0, 120) || null;

  // Faculty and HOD choose a College and Department (re-validated, never trusted). DAPU is university-wide.
  let departmentId: string | null = null;
  if (accountType === "faculty" || accountType === "hod") {
    departmentId = (await resolveDepartmentSelection({ collegeId: String(input.collegeId ?? ""), departmentId: String(input.departmentId ?? "") })).department.id;
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw conflict("An account with that email already exists.");
  // A HOD profile is unique per department: refuse up front (before any email is sent) when one would be created and can't be.
  const granted = roleGrantedAtSignup(email);
  if ((granted === "faculty" || granted === "hod") && departmentId) await assertStaffProfileAvailable(granted, departmentId);

  const payload: StaffPayload = { accountType, departmentId, location };
  return issueSignupOtp(
    email,
    { role: accountType, authMethod: "credentials", passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), firstName, lastName, payload: { ...payload } },
    send,
  );
}
