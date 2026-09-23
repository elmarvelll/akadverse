// services/auth/staff-signup/create-staff-profile.ts
//
// Faculty / HOD sign-up also asks for a College and Department. Choosing them grants NOTHING by itself: the account's
// role is assigned elsewhere (in the database; the sign-up form can never set it — see src/app/api/register/route.ts),
// and this is called only for an account whose role really is faculty / hod. It then creates the matching E-Learning
// profile in the chosen department (FacultyProfile / HodProfile, keyed by the Main User.id).
//
// A HOD profile is unique per department, and approvals/notifications are routed to "the HOD of a department", so it is
// never created if the department already has a HOD (the caller checks first and refuses BEFORE creating the account).

import { elearningDb } from "@/lib/db/elearning";
import { conflict } from "@/lib/service-error";

export type StaffRole = "faculty" | "hod";

export async function assertStaffProfileAvailable(role: StaffRole, departmentId: string) {
  if (role === "hod" && (await elearningDb.hodProfile.findUnique({ where: { departmentId } }))) {
    throw conflict("That department already has a HOD.");
  }
}

export async function createStaffProfile(userId: string, role: StaffRole, departmentId: string) {
  await assertStaffProfileAvailable(role, departmentId);
  try {
    return role === "faculty"
      ? await elearningDb.facultyProfile.create({ data: { userId, departmentId } })
      : await elearningDb.hodProfile.create({ data: { userId, departmentId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("A profile already exists for this account or department.");
    throw e;
  }
}
