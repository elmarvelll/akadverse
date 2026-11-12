// services/auth/student-signup/google-signup-token.ts
//
// After Google OAuth returns a NEW institutional student, the server has no account yet, so it hands the browser a
// short-lived, server-signed token carrying only the identity Google verified (email + name). The browser cannot forge
// or alter it (signed with NEXTAUTH_SECRET); the sign-up API trusts THIS token, never an email typed into the form.

import { decode, encode } from "next-auth/jwt";
import { badRequest } from "@/lib/service-error";

const PURPOSE = "student-google-signup";
const MAX_AGE_SECONDS = 15 * 60;

export interface GoogleSignupIdentity {
  email: string;
  firstName: string;
  lastName: string;
}

export async function createGoogleSignupToken(identity: GoogleSignupIdentity): Promise<string> {
  return encode({ secret: process.env.NEXTAUTH_SECRET!, maxAge: MAX_AGE_SECONDS, // The app augments next-auth's JWT type with session fields; this token is a different, single-purpose payload.
    token: { purpose: PURPOSE, ...identity } as never });
}

export async function readGoogleSignupToken(token: string): Promise<GoogleSignupIdentity> {
  const decoded = await decode({ token, secret: process.env.NEXTAUTH_SECRET! }).catch(() => null);
  if (!decoded || decoded.purpose !== PURPOSE || typeof decoded.email !== "string") {
    throw badRequest("Your Google sign-up link expired. Please continue with Google again.");
  }
  return { email: decoded.email, firstName: String(decoded.firstName ?? ""), lastName: String(decoded.lastName ?? "") };
}
