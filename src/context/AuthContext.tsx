// src/context/AuthContext.tsx
//
// `useAuth()` — a thin adapter over NextAuth's `useSession()` hook.
//
// Why not a real React Context here: NextAuth's <SessionProvider> (already
// mounted app-wide in src/app/providers.tsx) *is* the context provider —
// it fetches the session once, caches it, and shares it across every
// component that calls useSession(). Wrapping that in a second Context
// would just duplicate state and risk the two falling out of sync. So this
// file is deliberately just a hook, not a Provider — it re-shapes
// useSession()'s { data, status } into the { user, isAuthenticated,
// isLoading } shape the dashboard pages want, in one place, without a
// second subscription or a second network request.
//
// This also means "getting the user's name from the backend" doesn't need
// a bespoke fetch: useSession() itself is backed by a request to
// /api/auth/session (NextAuth's own endpoint), and the name/role it returns
// were populated server-side from Prisma in the `jwt` callback
// (src/lib/auth.ts) — so the data genuinely comes from the backend, just
// without us hand-rolling another API route and another loading state for
// the exact same information.

"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  role: Role;
  // Marketplace admin access — independent of `role` (a student, faculty,
  // admin, or super_admin account can independently also be an admin). See
  // prisma/schema.prisma's comment on User.isAdmin.
  isAdmin: boolean;
}

export interface UseAuthResult {
  user: AuthUser | null;
  // True only while NextAuth is still resolving the session on first load.
  isLoading: boolean;
  // True once resolved AND a session exists.
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthResult {
  // `status` is one of "loading" | "authenticated" | "unauthenticated" —
  // NextAuth manages this transition for us, so we don't need our own
  // useState/useEffect/fetch to track it.
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}
