// services/auth/student-signup/verify-student-signup.ts
//
// Step 2 of student sign-up: check the OTP, then create the account across the two databases.
//
//   Main AkadVerse DB   User            (identity / authentication)
//   E-Learning DB       StudentProfile  (academic record; StudentProfile.userId === User.id)
//
// The databases can't share a transaction, so it is done defensively:
//   1. everything is re-validated before the first write;
//   2. the OTP is CLAIMED atomically (a second concurrent verify with the same code can't also succeed);
//   3. the User is written first with a pre-generated id (the email's unique index arbitrates races), then the
//      StudentProfile; if the profile write fails, the User created in THIS call is deleted again and the OTP claim
//      is released, so the student can simply retry and no half-made account is left behind;
//   4. an older account with no profile (mode "link") only gets the profile attached — no second User, password untouched.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, notFound, tooManyRequests } from "@/lib/service-error";
import { isAdminEmail } from "@/lib/admin-identity";
import { isEmailForRole } from "@/lib/account-domains";
import { assertMatricAvailable, createStudentProfile, normalizeMatricNumber, type AcademicSelection } from "@/services/e-learning/student/signup-academics";
import { SIGNUP_OTP_MAX_ATTEMPTS, STUDENT_ROLE } from "./config";
import { otpMatches } from "./otp";

interface Payload extends AcademicSelection {
  matricNumber: string;
}

export async function verifyStudentSignup(pendingId: string, code: string) {
  const pending = await prisma.pendingSignup.findUnique({ where: { id: String(pendingId) } });
  if (!pending) throw notFound("That sign-up has expired. Please start again.");
  if (pending.otpAttempts >= SIGNUP_OTP_MAX_ATTEMPTS) throw tooManyRequests("Too many wrong codes. Request a new code to continue.");
  if (pending.otpExpiresAt.getTime() < Date.now()) throw badRequest("That code has expired. Request a new one.");
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) throw badRequest("Enter the 6-digit code.");

  if (!otpMatches(clean, pending.email, pending.otpHash)) {
    const { otpAttempts } = await prisma.pendingSignup.update({ where: { id: pending.id }, data: { otpAttempts: { increment: 1 } } });
    const left = SIGNUP_OTP_MAX_ATTEMPTS - otpAttempts;
    throw badRequest(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Request a new code to continue.");
  }

  // Claim the OTP: only one caller can flip it from the real hash to the "used" marker.
  const usedMarker = `used:${randomUUID()}`;
  const claimed = await prisma.pendingSignup.updateMany({ where: { id: pending.id, otpHash: pending.otpHash }, data: { otpHash: usedMarker } });
  if (claimed.count !== 1) throw conflict("That code was just used. If you're not signed in yet, please sign in.");
  const release = () => prisma.pendingSignup.updateMany({ where: { id: pending.id, otpHash: usedMarker }, data: { otpHash: pending.otpHash } });

  let createdUserId: string | null = null;
  try {
    // Re-validate: the world may have changed since step 1 (the server never trusts the stored copy blindly either).
    if (!isEmailForRole(pending.email, STUDENT_ROLE)) throw badRequest("Students must use their student email address.");
    const payload = pending.payload as unknown as Payload;
    const matricNumber = normalizeMatricNumber(payload.matricNumber);
    const selection: AcademicSelection = { collegeId: payload.collegeId, departmentId: payload.departmentId, programmeId: payload.programmeId, level: payload.level };

    let user = await prisma.user.findUnique({ where: { email: pending.email }, select: { id: true, role: true } });
    if (user && user.role !== STUDENT_ROLE) throw conflict("An account with that email already exists.");
    if (user && (await elearningDb.studentProfile.findUnique({ where: { userId: user.id } }))) {
      // Already fully registered (e.g. an earlier attempt finished): idempotent success, nothing more to write.
      await prisma.pendingSignup.deleteMany({ where: { id: pending.id } });
      return { email: pending.email, userId: user.id, created: false };
    }
    await assertMatricAvailable(matricNumber, user?.id);

    if (!user) {
      const id = randomUUID();
      try {
        await prisma.user.create({
          data: {
            id,
            firstName: pending.firstName,
            lastName: pending.lastName,
            email: pending.email,
            password: pending.passwordHash ?? "", // Google accounts have no password, exactly as the existing Google flow stores them
            role: STUDENT_ROLE,
            isAdmin: isAdminEmail(pending.email),
          },
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") throw conflict("An account with that email already exists. Please sign in.");
        throw e;
      }
      createdUserId = id;
      user = { id, role: STUDENT_ROLE };
    }

    await createStudentProfile(user.id, selection, matricNumber);
    await prisma.pendingSignup.deleteMany({ where: { id: pending.id } });
    return { email: pending.email, userId: user.id, created: !!createdUserId };
  } catch (err) {
    // Undo only what THIS call created, then let the student retry with the same code.
    if (createdUserId) await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => {});
    await release().catch(() => {});
    throw err;
  }
}
