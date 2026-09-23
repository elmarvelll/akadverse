// src/app/api/register/route.ts
//
// Backend endpoint for the Faculty/HOD/DAPU signup form (src/app/signup/page.tsx). Students use /api/signup/student/*.
// The signup page POSTs { firstName, lastName, email, password, location }
// as JSON here (the `email` is already the full address the local-part +
// account-type selector on that page built — see
// src/lib/account-domains.ts#buildEmail); this route validates it, hashes
// the password, and creates a new `User` row via Prisma. `location` is
// optional, matching the nullable `location` column on the Prisma `User`
// model.
//
// Every account created here gets the schema's default role ("student")
// — we deliberately never accept a `role` field from the client, since
// letting a signup request choose its own role would let anyone
// self-assign Faculty/HOD/DAPU/Dean/VC/Admin access (AGENTS.md §7's
// explicit rule: the account-type dropdown must never itself be an
// authorization mechanism). The one exception is DEV_TEST_LOCAL_PART
// below — see its comment.
//
// Admin: `isAdmin` is set (server-side, from the already-validated email only —
// never from a client field) when the email's complete local-part is the admin
// local-part; see src/lib/admin-identity.ts. NOTE this endpoint doesn't verify
// email ownership, so that rule trusts whoever registers such an address.
//
// This is a plain REST-style API route (not part of NextAuth) because
// account *creation* with a password is our own business logic — NextAuth
// only handles the sign-in/session side of things afterwards.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SignupFormValues } from "@/types/auth";
import { accountTypeForEmail } from "@/lib/account-domains";
import { isAdminEmail } from "@/lib/admin-identity";
import { ServiceError } from "@/lib/service-error";
import { serviceErrorResponse } from "@/lib/controller-helpers";
import { resolveDepartmentSelection } from "@/services/e-learning/student/signup-academics";
import { assertStaffProfileAvailable, createStaffProfile } from "@/services/auth/staff-signup/create-staff-profile";

// AGENTS.md §7: during development, this one account needs to be able to
// test every E-Learning role by signing up under each domain
// (marvelousifezue31@stu.cu.edu.ng, @faculty.cu.edu.ng, @DAPU.cu.edu.ng,
// etc. — each domain creates a *different* User row, so each can carry a
// different real, stored role rather than one account pretending to be
// several roles at once). Gated on BOTH the exact local part AND
// non-production so it can never become a production privilege-escalation
// path — flip NODE_ENV to "production" (as any real deployment does) and
// this whole branch is dead code.
const DEV_TEST_LOCAL_PART = "marvelousifezue31";

// How many salt rounds bcrypt uses when hashing the password. Higher is
// slower but more resistant to brute-force attacks; 10 is a common,
// reasonable default.
const BCRYPT_SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  // Parse the JSON body sent by the signup form. Wrapped in try/catch in
  // case the client sends malformed JSON.
  let body: Partial<SignupFormValues>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  // Optional — left undefined (rather than an empty string) when not
  // provided, so it's stored as SQL NULL instead of an empty row value.
  const location = body.location?.trim() || undefined;

  // Basic presence validation — every field on the signup form is required.
  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json(
      { error: "First name, last name, email, and password are all required." },
      { status: 400 }
    );
  }

  // Enforce the same minimum password length the signup form's UI enforces
  // (minLength={8}), so the rule holds even if someone bypasses the form
  // and calls this endpoint directly.
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  // This endpoint is now ONLY for the non-student role domains (Faculty / HOD / DAPU). A student account must go
  // through the student sign-up (academic details + emailed OTP + E-Learning student profile), otherwise this route
  // would be a way around those checks. Any other domain (Gmail, etc.) isn't an institutional address at all.
  const roleForEmail = accountTypeForEmail(email);
  if (!roleForEmail) {
    return NextResponse.json({ error: "Please use your institutional email address." }, { status: 400 });
  }
  if (roleForEmail === "student") {
    return NextResponse.json({ error: "Student accounts are created through student sign-up, which verifies your email." }, { status: 400 });
  }

  // Faculty and HOD also choose a College and Department. Both are required and re-validated against the E-Learning
  // database (never trusted from the browser). DAPU is university-wide and has neither.
  let departmentId: string | null = null;
  if (roleForEmail === "faculty" || roleForEmail === "hod") {
    try {
      departmentId = (await resolveDepartmentSelection({ collegeId: String(body.collegeId ?? ""), departmentId: String(body.departmentId ?? "") })).department.id;
    } catch (err) {
      return serviceErrorResponse(err);
    }
  }

  // Reject if an account with this email already exists. The `email`
  // column also has a unique constraint at the database level, but
  // checking here first lets us return a friendlier error message instead
  // of a raw database constraint violation.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  // Hash the plaintext password before storing it — we must never store
  // passwords in plain text.
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // `role` is omitted (letting Prisma apply the schema default, `student`)
  // for every account EXCEPT the narrow dev-testing exception described on
  // DEV_TEST_LOCAL_PART above — never derived from anything the client
  // sends directly, only from the domain actually present in the
  // already-validated `email`, and only reachable outside production.
  const localPart = email.split("@")[0];
  const devRoleOverride =
    process.env.NODE_ENV !== "production" && localPart === DEV_TEST_LOCAL_PART ? accountTypeForEmail(email) : null;

  // Choosing a department grants nothing: a profile is created only when the role is REALLY faculty/hod (today only the
  // dev-test exception above), and a HOD is refused up front if the department already has one.
  const staffRole = devRoleOverride === "faculty" || devRoleOverride === "hod" ? devRoleOverride : null;
  if (staffRole && departmentId) {
    try {
      await assertStaffProfileAvailable(staffRole, departmentId);
    } catch (err) {
      return serviceErrorResponse(err);
    }
  }

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      location,
      isAdmin: isAdminEmail(email),
      ...(devRoleOverride ? { role: devRoleOverride } : {}),
    },
  });

  if (staffRole && departmentId) {
    try {
      await createStaffProfile(user.id, staffRole, departmentId);
    } catch (err) {
      await prisma.user.deleteMany({ where: { id: user.id } }); // no account without its profile
      if (err instanceof ServiceError) return serviceErrorResponse(err);
      throw err;
    }
  }

  // Respond with a minimal success payload. Deliberately omit the password
  // hash (and don't return the full Prisma `user` object) so it's never
  // sent back to the client.
  return NextResponse.json(
    {
      message: "Account created successfully.",
      user: { id: user.id, email: user.email },
    },
    { status: 201 }
  );
}
