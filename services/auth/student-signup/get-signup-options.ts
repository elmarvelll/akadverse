// services/auth/student-signup/get-signup-options.ts
//
// What the sign-up form's dropdowns offer, plus the student email domain (from the same role→domain source the
// server validates against). Public: it only lists academic names, no personal data.

import { getSignupOptions } from "@/services/e-learning/student/signup-academics";
import { getAccountType } from "@/lib/account-domains";

export async function getStudentSignupOptions() {
  return { ...(await getSignupOptions()), studentDomain: getAccountType("student").domain };
}
