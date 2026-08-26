// src/app/api/auth/[...nextauth]/route.ts
//
// This is the single catch-all endpoint that NextAuth uses for *everything*
// auth-related: /api/auth/signin, /api/auth/callback/google,
// /api/auth/session, /api/auth/signout, /api/auth/csrf, etc. The
// `[...nextauth]` folder name is a Next.js "catch-all route segment" — it
// matches any path under /api/auth/.
//
// All the actual configuration (providers, callbacks, session strategy)
// lives in src/lib/auth.ts so it can be imported elsewhere too (e.g. from
// middleware or server components calling getServerSession).

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth's App Router handler works for both GET requests (e.g. loading
// the session, OAuth redirects) and POST requests (e.g. submitting the
// credentials sign-in form).
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
