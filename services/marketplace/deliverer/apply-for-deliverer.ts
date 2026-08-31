// services/marketplace/deliverer/apply-for-deliverer.ts
//
// Submits ("Become a Deliverer") or resubmits a deliverer application.
// Deliverer.userId is @unique, so a REJECTED applicant reapplying can't
// just create a second row — this updates the existing one back to
// PENDING instead, which is what actually lets rejection be non-permanent
// (see docs/marketplace/decisions/rejected-deliverer-can-reapply.md).
// PENDING/APPROVED/SUSPENDED all block a resubmission outright. Called by
// src/app/api/marketplace/deliverer/apply/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { badRequest, conflict } from "@/lib/service-error";

export interface DelivererApplicationInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export async function applyForDeliverer(userId: string, input: DelivererApplicationInput) {
  const existing = await prisma.deliverer.findUnique({ where: { userId } });
  if (existing && existing.status !== "REJECTED") {
    throw conflict("You've already applied to become a deliverer.");
  }

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim();
  if (!firstName || !lastName || !email) {
    throw badRequest("First name, last name, and email are required.");
  }
  const phone = input.phone?.trim() || undefined;

  return existing
    ? prisma.deliverer.update({
        where: { userId },
        data: { firstName, lastName, email, phone, status: "PENDING", appliedAt: new Date(), rejectedAt: null, rejectionReason: null },
        select: { id: true, status: true, appliedAt: true },
      })
    : prisma.deliverer.create({
        data: { userId, firstName, lastName, email, phone },
        select: { id: true, status: true, appliedAt: true },
      });
}
