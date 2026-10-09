// services/auth/staff-signup/staff-role.ts
//
// Which role an account created by Faculty / HOD / DAPU sign-up gets. Signing up "as" Faculty/HOD/DAPU never grants that
// role by itself (AGENTS.md §7: the account-type selector is not an authorization mechanism) — every such account keeps
// the schema's default role ("student") and is given its real role elsewhere. The one exception is the dev-test account:
//
// During development, this one account needs to be able to test every E-Learning role by signing up under each domain
// (marvelousifezue31@stu.cu.edu.ng, @faculty.cu.edu.ng, @DAPU.cu.edu.ng, etc. — each domain creates a *different* User
// row, so each can carry a different real, stored role rather than one account pretending to be several roles at once).
// Gated on BOTH the exact local part AND non-production so it can never become a production privilege-escalation path —
// with NODE_ENV=production (as any real deployment has) this returns null for everyone.

import { accountTypeForEmail } from "@/lib/account-domains";

export const DEV_TEST_LOCAL_PART = "marvelousifezue31";

export type StaffAccountType = "faculty" | "hod" | "dapu";
export const STAFF_ACCOUNT_TYPES: readonly StaffAccountType[] = ["faculty", "hod", "dapu"];

// The role to store on the new User, or null for "the schema default". Derived only from the already-validated email.
export function roleGrantedAtSignup(email: string): StaffAccountType | null {
  if (process.env.NODE_ENV === "production" || email.split("@")[0] !== DEV_TEST_LOCAL_PART) return null;
  const type = accountTypeForEmail(email);
  return type && type !== "student" ? type : null;
}
