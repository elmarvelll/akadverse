// services/marketplace/admin/block-business.ts
//
// Admin blocks a business. This is a flag, never a delete — the
// business's products/orders/events/fines all remain in the database
// exactly as they were; nothing here removes anything. Called by
// src/app/api/marketplace/admin/businesses/[businessId]/block/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { notFound, badRequest } from "@/lib/service-error";
import { logAdminAction } from "./shared/log-admin-action";

export async function blockBusiness(businessId: string, reason: string, adminUserId: string) {
  if (!reason.trim()) throw badRequest("A reason is required.");

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, blocked: true } });
  if (!business) throw notFound("Business not found.");
  if (business.blocked) return;

  await prisma.business.update({
    where: { id: businessId },
    data: { blocked: true, blockedAt: new Date(), blockedReason: reason.trim(), blockedBy: adminUserId },
  });
  await logAdminAction({ adminId: adminUserId, action: "BUSINESS_BLOCKED", targetType: "business", targetId: businessId, message: reason.trim() });
}
