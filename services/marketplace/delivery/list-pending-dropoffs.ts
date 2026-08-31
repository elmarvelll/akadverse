// services/marketplace/delivery/list-pending-dropoffs.ts
//
// The delivery coordinator's queue: orders whose seller has requested the
// Seller -> Coordinator handoff (an OTP has been issued) but the
// coordinator hasn't yet verified it. This is the coordinator's "who's at
// the counter right now" view — separate from list-ready-items.ts, which
// is the *next* stage (already received, waiting for deliverer
// assignment). Called by
// src/app/api/marketplace/admin/dropoffs/route.controller.ts.

import { prisma } from "@/lib/prisma";

export async function listPendingDropoffs() {
  const orders = await prisma.order.findMany({
    where: {
      status: "ACCEPTED",
      fulfillmentStatus: "READY_FOR_PICKUP",
      sellerDroppedOffAt: null,
      dropoffOtp: { not: null },
    },
    select: {
      id: true,
      businessId: true,
      business: { select: { name: true } },
      dropoffOtpExpiry: true,
      dropoffOtpAttempts: true,
      estimatedDeliveryAt: true,
      items: { select: { quantity: true } },
    },
    orderBy: { id: "asc" },
  });

  return orders.map((order) => ({
    orderId: order.id,
    businessId: order.businessId,
    businessName: order.business.name,
    itemCount: order.items.length,
    quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    otpExpiry: order.dropoffOtpExpiry?.toISOString() ?? null,
    otpAttempts: order.dropoffOtpAttempts,
    estimatedDeliveryAt: order.estimatedDeliveryAt?.toISOString() ?? null,
  }));
}
