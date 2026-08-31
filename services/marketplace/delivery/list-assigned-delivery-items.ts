// services/marketplace/delivery/list-assigned-delivery-items.ts
//
// Every DeliveryItem assigned to the signed-in deliverer, across every
// status — the Deliverer Dashboard's main list. Called by
// src/app/api/marketplace/deliverer/deliveries/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { formatEstimatedDelivery } from "@/services/marketplace/delivery/estimated-delivery.service";

export async function listAssignedDeliveryItems(delivererId: string) {
  const items = await prisma.deliveryItem.findMany({
    where: { delivery: { deliverymanId: delivererId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      quantity: true,
      businessId: true,
      business: { select: { name: true } },
      orderItem: {
        select: {
          id: true,
          failedDeliveryAttempts: true,
          retryDeliveryAt: true,
          product: { select: { name: true } },
          order: { select: { id: true, deliveryLocation: true, estimatedDeliveryAt: true, deliveryWindowStart: true, deliveryWindowEnd: true } },
        },
      },
    },
  });

  return items.map((item) => {
    const order = item.orderItem.order;
    const estimate =
      order.estimatedDeliveryAt && order.deliveryWindowStart && order.deliveryWindowEnd
        ? formatEstimatedDelivery({
            estimatedDeliveryAt: order.estimatedDeliveryAt,
            deliveryWindowStart: order.deliveryWindowStart,
            deliveryWindowEnd: order.deliveryWindowEnd,
          })
        : null;

    return {
      deliveryItemId: item.id,
      status: item.status,
      quantity: item.quantity,
      businessId: item.businessId,
      businessName: item.business.name,
      productName: item.orderItem.product.name,
      orderId: order.id,
      deliveryLocation: order.deliveryLocation,
      estimatedDate: estimate?.date ?? null,
      deliveryWindow: estimate?.window ?? null,
      failedDeliveryAttempts: item.orderItem.failedDeliveryAttempts,
      retryDeliveryAt: item.orderItem.retryDeliveryAt?.toISOString() ?? null,
    };
  });
}
