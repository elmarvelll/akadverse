// services/marketplace/admin/resolve-dispute.ts
//
// Admin resolves a disputed order — records the resolution text and who
// resolved it, clears isDisputed, and writes DISPUTE_RESOLVED to the
// order's own OrderEvent history (dispute events are order-scoped, so
// they use that existing system rather than AdminActionLog). Called by
// src/app/api/marketplace/admin/disputes/[orderId]/resolve/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { notFound, badRequest, conflict } from "@/lib/service-error";
import { recordOrderEvent } from "@/services/marketplace/order/record-order-event";

export async function resolveDispute(orderId: string, resolution: string, adminUserId: string) {
  if (!resolution.trim()) throw badRequest("A resolution note is required.");

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, isDisputed: true } });
  if (!order) throw notFound("Order not found.");
  if (!order.isDisputed) throw conflict("This order isn't currently disputed.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { isDisputed: false, disputeResolvedAt: now, disputeResolvedBy: adminUserId, disputeResolution: resolution.trim() },
    });
    await recordOrderEvent(tx, { orderId, type: "DISPUTE_RESOLVED", actorType: "admin", actorId: adminUserId, message: resolution.trim() });
  });
}
