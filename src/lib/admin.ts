// src/lib/admin.ts
//
// Shared "is this an admin" guard for the Marketplace's admin-only routes:
// deliverer application approval (docs/marketplace/systems/deliverer-system.md),
// delivery coordinator assignment
// (docs/marketplace/systems/delivery-coordinator-system.md), and the full
// Admin Dashboard (docs/admin/). The platform has no separate "delivery
// coordinator" role/model — the product spec describes it as a function,
// not a distinct account type — so coordinator actions are implemented as
// admin-only routes too. See
// docs/marketplace/decisions/delivery-coordinator-is-admin.md.
//
// Kept in src/lib/ (not services/marketplace/**) since it's a generic
// flag check — it doesn't touch any marketplace model itself, unlike
// services/marketplace/business/business-ownership.service.ts's ownership
// check.
//
// Admin access is `User.isAdmin`, independent of `role` — a student,
// faculty, admin, or super_admin account can independently also be an
// admin. This replaced an earlier `role === "super_admin"`-only gate; see
// docs/admin/decisions/admin-flag-replaces-role-check.md. Throws
// ServiceError (401/403) rather than returning a NextResponse — see
// src/lib/service-error.ts and src/lib/controller-helpers.ts.

import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/service-error";

export async function requireAdmin(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  if (!session.user.isAdmin) throw forbidden("Admin access required.");
  return session;
}
