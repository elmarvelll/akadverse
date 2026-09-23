// services/e-learning/shared/identity.ts
//
// The one place E-Learning code is allowed to import the Marketplace/Core
// Prisma client (`prisma` from src/lib/prisma.ts) — a genuine identity
// lookup, exactly the exception AGENTS.md §35/§36 carves out ("Application
// code can resolve the identity when necessary"). Every E-Learning table
// stores a Core `User.id` (`studentUserId`, `facultyUserId`, etc.) rather
// than a name, so anywhere the UI needs to *show* a name, it resolves it
// here instead of duplicating name data into the E-Learning database.
//
// No other services/e-learning/** file should import "@/lib/prisma"
// directly — go through this module so the cross-database boundary stays
// in one, obvious place.

import { prisma } from "@/lib/prisma";

export interface ResolvedIdentity {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function resolveIdentity(userId: string): Promise<ResolvedIdentity | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return user;
}

// Batch form — used whenever a page needs to label a list of rows (e.g.
// each course's assigned lecturer) instead of resolving one id at a time.
export async function resolveIdentities(userIds: string[]): Promise<Map<string, ResolvedIdentity>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

export function fullName(identity: ResolvedIdentity | null | undefined): string {
  return identity ? `${identity.firstName} ${identity.lastName}` : "Unknown";
}

// ---------------------------------------------------------------------------
// Notifications — the existing Core `Notification` table (no second
// notification system). Lives here because it is the one module allowed to
// touch the Core client. Best-effort by design: a failed notification must
// never roll back or block an academic decision that already committed.
// ---------------------------------------------------------------------------
export async function notifyUsers(userIds: string[], n: { type: string; title: string; message: string; link?: string }) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, scope: "ELEARNING" as const, type: n.type, title: n.title, message: n.message, link: n.link ?? null })),
    });
  } catch (error) {
    console.error("[elearning] notification failed", error);
  }
}
