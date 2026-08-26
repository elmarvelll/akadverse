// src/types/next-auth.d.ts
//
// NextAuth's built-in `Session` and `JWT` types don't know about the custom
// fields we attach in the `jwt`/`session` callbacks (src/lib/auth.ts): `id`,
// `role` (for role-based home-route redirects, see src/proxy.ts), and
// `firstName` (so the dashboard can greet the user without a second fetch —
// see src/context/AuthContext.tsx). This file uses TypeScript's
// "declaration merging" to extend those interfaces so all of these
// type-check everywhere else in the app instead of requiring `as any`
// casts.

import "next-auth";
import "next-auth/jwt";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      role: Role;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    role: Role;
  }
}
