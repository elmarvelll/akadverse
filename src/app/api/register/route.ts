// src/app/api/register/route.ts
//
// Backend endpoint for the signup form (src/app/signup/page.tsx).
// The signup page POSTs { firstName, lastName, email, password, location }
// as JSON here; this route validates it, hashes the password, and creates
// a new `User` row via Prisma. `location` is optional, matching the
// nullable `location` column on the Prisma `User` model.
//
// Every account created here gets the schema's default role ("student") —
// we deliberately never accept a `role` field from the client, since
// letting a signup request choose its own role would let anyone self-assign
// Faculty/Admin/Super Admin access. The signup UI's role selector is
// cosmetic for the same reason (see src/app/signup/page.tsx).
//
// This is a plain REST-style API route (not part of NextAuth) because
// account *creation* with a password is our own business logic — NextAuth
// only handles the sign-in/session side of things afterwards.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SignupFormValues } from "@/types/auth";

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

  // Create the user record. `role` is intentionally omitted so Prisma
  // applies the schema's default (`student`) — see the comment at the top
  // of this file for why that's not client-controlled.
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      location,
    },
  });

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
