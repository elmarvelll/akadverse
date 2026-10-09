// services/auth/student-signup/verify-student-signup.ts
//
// Step 2 of student sign-up: check the OTP, then create the account across the two databases.
//
//   Main AkadVerse DB   User            (identity / authentication)
//   E-Learning DB       StudentProfile  (academic record; StudentProfile.userId === User.id)
//
// The databases can't share a transaction, so it is done defensively:
//   1. everything is re-validated before the first write;
//   2. the OTP is CLAIMED atomically (services/auth/signup-otp/claim-signup-otp.ts — shared by every account type);
//   3. the User is written first with a pre-generated id (the email's unique index arbitrates races), then the
//      StudentProfile; if the profile write fails, the User created in THIS call is deleted again and the OTP claim
//      is released, so the student can simply retry and no half-made account is left behind;
//   4. an older account with no profile (mode "link") only gets the profile attached — no second User, password untouched.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict } from "@/lib/service-error";
import { isAdminEmail } from "@/lib/admin-identity";
import { isEmailForRole } from "@/lib/account-domains";
import { assertMatricAvailable, createStudentProfile, normalizeMatricNumber, type AcademicSelection } from "@/services/e-learning/student/signup-academics";
import { STUDENT_ROLE } from "@/services/auth/signup-otp/config";
import { claimSignupOtp } from "@/services/auth/signup-otp/claim-signup-otp";

interface Payload extends AcademicSelection {
  matricNumber: string;
}

export async function verifyStudentSignup(pendingId: string, code: string) {
  const { pending, release } = await claimSignupOtp(pendingId, code);

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
