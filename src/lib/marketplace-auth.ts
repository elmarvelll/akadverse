// src/lib/marketplace-auth.ts
//
// Marketplace is students-only (AGENTS.md §9) — enforced at three levels:
// nav (hidden for non-students, see src/app/studashboard/page.tsx's
// workspace cards), routing (src/proxy.ts blocks non-students from
// /studashboard/marketplace* and /api/marketplace* outright), and here:
// the backend check individual Marketplace service/controller code can
// call so it never trusts that the request even reached this far because
// of the proxy alone.
//
// Kept alongside src/lib/admin.ts (same shape: throws ServiceError,
// doesn't touch any Marketplace model itself) rather than inside
// services/marketplace/**, since — like requireAdmin — it's a generic role
// check any Marketplace route can reach for, not owned by one resource.

import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/service-error";

export async function requireStudent(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  if (session.user.role !== "student") {
    throw forbidden("Marketplace is only available to students.");
  }
  return session;
}
