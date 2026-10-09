// services/auth/staff-signup/verify-staff-signup.ts
//
// Step 2 of Faculty / HOD / DAPU sign-up: check the OTP (shared: services/auth/signup-otp/claim-signup-otp.ts), then
// create the account. Everything is re-validated from the stored email — the PendingSignup's `role` is descriptive only
// and grants nothing. The User gets the schema's default role unless the dev-test exception applies (./staff-role.ts);
// only then is a Faculty/HOD profile created in the chosen department. If that profile can't be written, the User
// created in this call is removed and the code released, so the person can retry and no half-made account is left.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict } from "@/lib/service-error";
import { isAdminEmail } from "@/lib/admin-identity";
import { accountTypeForEmail, isEmailForRole } from "@/lib/account-domains";
import { claimSignupOtp } from "@/services/auth/signup-otp/claim-signup-otp";
import { createStaffProfile } from "./create-staff-profile";
import { roleGrantedAtSignup, STAFF_ACCOUNT_TYPES, type StaffAccountType } from "./staff-role";
import type { StaffPayload } from "./start-staff-signup";

export async function verifyStaffSignup(pendingId: string, code: string) {
  const { pending, release } = await claimSignupOtp(pendingId, code);

  let createdUserId: string | null = null;
  try {
    const payload = pending.payload as unknown as StaffPayload;
    const accountType = accountTypeForEmail(pending.email);
    if (!accountType || !STAFF_ACCOUNT_TYPES.includes(accountType as StaffAccountType) || !isEmailForRole(pending.email, accountType) || payload?.accountType !== accountType) {
      throw badRequest("That sign-up isn't valid. Please start again.");
    }
    if (!pending.passwordHash) throw badRequest("That sign-up isn't valid. Please start again.");
    if (await prisma.user.findUnique({ where: { email: pending.email }, select: { id: true } })) throw conflict("An account with that email already exists. Please sign in.");

    const granted = roleGrantedAtSignup(pending.email);
    const id = randomUUID();
    try {
      await prisma.user.create({
        data: {
          id,
          firstName: pending.firstName,
          lastName: pending.lastName,
          email: pending.email,
          password: pending.passwordHash,
          location: payload.location ?? undefined,
          isAdmin: isAdminEmail(pending.email),
          ...(granted ? { role: granted } : {}),
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw conflict("An account with that email already exists. Please sign in.");
      throw e;
    }
    createdUserId = id;

    // A profile only for an account whose role REALLY is faculty / hod (choosing a department grants nothing).
    if ((granted === "faculty" || granted === "hod") && payload.departmentId) await createStaffProfile(id, granted, payload.departmentId);

    await prisma.pendingSignup.deleteMany({ where: { id: pending.id } });
    return { email: pending.email, userId: id };
  } catch (err) {
    if (createdUserId) await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => {});
    await release().catch(() => {});
    throw err;
  }
}
