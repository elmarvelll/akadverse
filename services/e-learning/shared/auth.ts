// services/e-learning/shared/auth.ts
//
// Server-side authorization for the E-Learning system (AGENTS.md §34).
// Every protected E-Learning route/page/API must go through this — never
// trust a client-side role value, a URL segment, or a hidden nav item.
//
// Role itself comes from the Core database via the NextAuth session (see
// src/lib/auth.ts's `jwt` callback) — the same `role` Marketplace uses, per
// AGENTS.md §5/§45 ("ONE AkadVerse identity"). This module only adds the
// E-Learning-specific piece: which of the six roles are part of the
// academic system, and profile-based scope checks (department, Level
// Adviser responsibility, etc.) that go beyond "what's your role".

import { getServerSession, type Session } from "next-auth";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/service-error";
import { elearningDb } from "@/lib/db/elearning";

// The academic-system roles (AGENTS.md §5). `admin`/`super_admin` are
// Marketplace-only concepts (see prisma/schema.prisma's comment on Role)
// and never get E-Learning access.
export const ELEARNING_ROLES = ["student", "faculty", "hod", "dapu", "dean", "vc"] as const;
export type ElearningRole = (typeof ELEARNING_ROLES)[number];

export function isElearningRole(role: Role): role is ElearningRole {
  return (ELEARNING_ROLES as readonly string[]).includes(role);
}

// Confirms there's a signed-in session AND that the user's role is part of
// the academic system at all (rules out admin/super_admin, who have no
// E-Learning portal). Returns the session so callers don't need a second
// getServerSession() call.
export async function requireElearningSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  if (!isElearningRole(session.user.role)) {
    throw forbidden("This account doesn't have E-Learning access.");
  }
  return session;
}

// Confirms the signed-in user's role is one of `allowed`. Use this on top
// of (or via) requireElearningSession for anything role-specific — e.g. a
// HOD-only approvals endpoint, a DAPU-only timeframe editor.
export async function requireElearningRole(allowed: readonly ElearningRole[]): Promise<Session> {
  const session = await requireElearningSession();
  if (!allowed.includes(session.user.role as ElearningRole)) {
    throw forbidden("You don't have access to this.");
  }
  return session;
}

// ---------------------------------------------------------------------------
// Scope checks
//
// Role alone isn't always enough (AGENTS.md §34) — a HOD can only manage
// their own department, a Level Adviser only their own level/department.
// These resolve the caller's E-Learning profile so route handlers can
// compare it against the resource being accessed instead of trusting a
// department/level value the client sent.
// ---------------------------------------------------------------------------

export async function requireStudentProfile(session: Session) {
  const profile = await elearningDb.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw forbidden("No student profile found for this account.");
  return profile;
}

export async function requireFacultyProfile(session: Session) {
  const profile = await elearningDb.facultyProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw forbidden("No faculty profile found for this account.");
  return profile;
}

export async function requireHodProfile(session: Session) {
  const profile = await elearningDb.hodProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw forbidden("No HOD profile found for this account.");
  return profile;
}

export async function requireDapuProfile(session: Session) {
  const profile = await elearningDb.dapuProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw forbidden("No DAPU profile found for this account.");
  return profile;
}

// A faculty member only gets Level Adviser scope when their profile
// actually says so (AGENTS.md §20) — never inferred from role or the URL.
export async function requireLevelAdviserProfile(session: Session) {
  const profile = await requireFacultyProfile(session);
  if (!profile.isLevelAdviser) {
    throw forbidden("You're not assigned as a Level Adviser.");
  }
  return profile;
}
