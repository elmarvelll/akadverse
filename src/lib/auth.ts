// src/lib/auth.ts
//
// Central NextAuth configuration, shared by:
//   - the NextAuth API route handler (src/app/api/auth/[...nextauth]/route.ts)
//   - the proxy (src/proxy.ts), which needs to know the same `secret` to
//     verify the session JWT.
//
// Two sign-in methods are configured:
//   1. CredentialsProvider — classic email + password, checked against the
//      `User` table with bcryptjs.
//   2. GoogleProvider — "Continue with Google" / "Sign up with Google".
//      Google signs an EXISTING account in; a new Google user is
//      only accepted with an institutional student email and is sent through the
//      student sign-up (academic details + OTP) instead of being auto-created
//      (see the `signIn` callback below).

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin-identity";
import { isEmailForRole } from "@/lib/account-domains";
import { createGoogleSignupToken } from "@/services/auth/student-signup/google-signup-token";

export const authOptions: NextAuthOptions = {
  // Used by NextAuth to sign/encrypt the session JWT. Must be set in .env.
  secret: process.env.NEXTAUTH_SECRET!,

  // We use JWT-based sessions (no separate `Session` table in the DB) —
  // simpler to run since our Prisma schema doesn't define NextAuth's
  // adapter models. The session lasts 30 days before the user needs to
  // sign in again.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days, in seconds
  },

  // Custom pages: tell NextAuth to render our own /login route instead of
  // its default built-in sign-in page whenever it needs to send someone to
  // sign in (e.g. when middleware redirects an unauthenticated request).
  pages: {
    signIn: "/login",
  },

  providers: [
    // ---- Email + password login ----
    CredentialsProvider({
      name: "Credentials",

      // Declares the fields NextAuth's default sign-in form would render.
      // We don't use that default form (we have our own /login page), but
      // this is still required by the provider's type signature.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      // Called by NextAuth whenever someone submits the credentials form
      // (from our /login page, via signIn("credentials", {...})).
      // Return the user object to log them in, or `null` to reject.
      async authorize(credentials) {
        // Bail out early if either field is missing.
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Normalised the same way every stored email is (trimmed, lower-case), so any casing the person types matches.
        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        // Look up the user by their unique email.
        const user = await prisma.user.findUnique({
          where: { email },
        });

        // No account with that email.
        if (!user) {
          return null;
        }

        // Defensive check: a user created via "Sign up with Google" has an
        // empty password (see the `signIn` callback), so they can't log in
        // with credentials until they set one.
        if (!user.password) {
          return null;
        }

        // Compare the submitted password against the bcrypt hash stored in
        // the database.
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          return null;
        }

        // Returning this object tells NextAuth the login succeeded; these
        // fields become available in the `jwt` callback below as `user`.
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        };
      },
    }),

    // ---- Google OAuth login/signup ----
    // Used for both "Continue with Google" (login page) and "Sign up with
    // Google" (signup page) — it's the same provider either way; whether it
    // creates a new user or logs in an existing one is decided in the
    // `signIn` callback below.
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // Runs whenever a JWT is created or updated (on sign in, and on every
    // subsequent request that reads the session). We use it to load fresh
    // user data from the database and stash it on the token, so the token
    // carries the *current* name/email/role rather than a stale snapshot
    // from sign-in time.
    //
    // Note: this only re-queries the database on the initial sign-in call
    // (when `user` is defined) — not on every single request — so a role
    // change made directly in the database won't take effect for an
    // already-signed-in user until their session JWT is re-issued (next
    // sign-in, or after maxAge expires). That's an intentional trade-off:
    // re-querying Prisma on every request that touches the session would
    // add a database round trip to pages that don't need one.
    async jwt({ token, user }) {
      // `user` is only defined on the initial sign-in call, not on later
      // token refreshes.
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: {
            email: user.email.toLowerCase(),
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isAdmin: true,
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.email = dbUser.email;
          token.name = `${dbUser.firstName} ${dbUser.lastName}`;
          // Kept separately from `name` (which is "First Last") so the UI
          // can greet someone by first name alone without string-splitting.
          token.firstName = dbUser.firstName;
          // Drives the role-based home-route redirect in src/proxy.ts.
          token.role = dbUser.role;
          // Marketplace admin access — independent of `role` (see
          // prisma/schema.prisma's comment on User.isAdmin). Checked by
          // src/lib/admin.ts#requireAdmin and used to show/hide the Admin
          // card on the home route (src/app/studashboard/page.tsx).
          token.isAdmin = dbUser.isAdmin || isAdminEmail(dbUser.email);
          // Keep the stored flag in step so admin user lists/queries agree
          // with what the session says (server-side; the client can't cause this).
          if (isAdminEmail(dbUser.email) && !dbUser.isAdmin) {
            await prisma.user.update({ where: { id: dbUser.id }, data: { isAdmin: true } });
          }
        }
      }
      return token;
    },

    // Runs whenever the session is checked (e.g. useSession() on the
    // client, or getServerSession() on the server). Copies the fields we
    // stored on the JWT into the `session.user` object so the rest of the
    // app can read them.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.firstName = token.firstName as string;
        session.user.role = token.role;
        // Derived from the server-signed token's email as well, so sessions that
        // pre-date this rule pick it up without a fresh sign-in.
        session.user.isAdmin = (token.isAdmin as boolean) || isAdminEmail(token.email);
      }
      return session;
    },

    // Runs right before a sign-in is completed. We use it to auto-create a
    // `User` row the first time someone signs in with Google, since Google
    // accounts never go through our /api/register endpoint.
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false; // reject sign-in if Google didn't give us an email
        // Only an email Google itself has verified counts as an identity.
        if ((profile as { email_verified?: boolean } | undefined)?.email_verified === false) return "/signup?error=google_unverified";

        const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (existingUser) return true; // an existing account: a normal session, no OTP again

        // A NEW Google user is never created here. Google alone doesn't grant access: it must be an institutional
        // student address, and the sign-up still needs the student's academic details + an emailed OTP. The verified
        // identity is handed to /signup in a short-lived, server-signed token (never a typed email).
        if (!isEmailForRole(email, "student")) return "/signup?error=google_domain";
        const nameParts = user.name?.trim().split(/\s+/) ?? [];
        const token = await createGoogleSignupToken({ email, firstName: nameParts[0] ?? "", lastName: nameParts.slice(1).join(" ") });
        return `/signup?google=${encodeURIComponent(token)}`;
      }

      // Returning true allows the sign-in to proceed.
      return true;
    },
  },
};
