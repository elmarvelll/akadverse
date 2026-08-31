// services/marketplace/delivery/list-ready-items.ts
//
// Order items dropped off and waiting for delivery-coordinator assignment.
// Called by
// src/app/api/marketplace/admin/deliveries/ready-items/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { READY_ITEM_WHERE } from "./shared/ready-item-filter";

export async function listReadyItems() {
  const items = await prisma.orderItem.findMany({
    where: READY_ITEM_WHERE,
    select: {
      id: true,
      quantity: true,
      price: true,
      product: { select: { name: true, businessId: true, business: { select: { name: true } } } },
      order: { select: { id: true, sellerDroppedOffAt: true, estimatedDeliveryAt: true } },
    },
    orderBy: { order: { sellerDroppedOffAt: "asc" } },
  });

  return items.map((item) => ({
    id: item.id,
    orderId: item.order.id,
    quantity: item.quantity,
    price: item.price,
    productName: item.product.name,
    businessId: item.product.businessId,
    businessName: item.product.business.name,
    sellerDroppedOffAt: item.order.sellerDroppedOffAt?.toISOString() ?? null,
    estimatedDeliveryAt: item.order.estimatedDeliveryAt?.toISOString() ?? null,
  }));
}
