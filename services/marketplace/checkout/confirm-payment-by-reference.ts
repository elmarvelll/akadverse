// services/marketplace/checkout/confirm-payment-by-reference.ts
//
// Idempotent: re-running this for a reference that's already been marked
// paid (e.g. both the verify call and the webhook fire for the same
// payment) just does nothing on the second call. Called by
// src/app/api/marketplace/checkout/verify/route.controller.ts and
// src/app/api/webhooks/paystack/webhook.controller.ts (via
// services/marketplace/payment/paystack-webhook.service.ts).

import { prisma } from "@/lib/prisma";
import { recordOrderEvent } from "@/services/marketplace/order/record-order-event";
import { sendEmail, newOrderEmail } from "@/services/marketplace/notifications/email.service";
import { createNotification } from "@/services/marketplace/notifications/notification.service";

export async function confirmPaymentByReference(reference: string): Promise<{ confirmedOrderIds: string[] }> {
  const pendingOrders = await prisma.order.findMany({
    where: { paystackReference: reference, paymentStatus: "pending" },
    select: {
      id: true,
      userId: true,
      businessId: true,
      business: { select: { name: true, user: { select: { id: true, email: true } } } },
      items: { select: { quantity: true, price: true, product: { select: { name: true } } } },
    },
  });

  if (pendingOrders.length === 0) {
    return { confirmedOrderIds: [] };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: { in: pendingOrders.map((o) => o.id) } },
      data: { paymentStatus: "paid" },
    });

    for (const order of pendingOrders) {
      await recordOrderEvent(tx, { orderId: order.id, type: "ORDER_CREATED", actorType: "buyer", actorId: order.userId });
      await recordOrderEvent(tx, { orderId: order.id, type: "SELLER_NOTIFIED", actorType: "system" });
    }
  });

  // The cart was fully snapshotted into these orders at initialize time —
  // clearing it now removes exactly what was just paid for.
  const userId = pendingOrders[0].userId;
  await prisma.cartItem.deleteMany({ where: { userId } });

  // Notify each business owner of their new order. Fire-and-forget by
  // design (see services/marketplace/notifications/email.service.ts) —
  // a slow/failed email must never hold up payment confirmation.
  for (const order of pendingOrders) {
    const owner = order.business.user;
    const itemSummary = order.items
      .map((item) => `${item.quantity} x ${item.product.name} (₦${(item.price * item.quantity).toLocaleString()})`)
      .join("<br/>");
    const totalAmount = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (owner?.email) {
      void sendEmail({
        to: owner.email,
        ...newOrderEmail({ businessName: order.business.name, orderId: order.id, itemSummary, totalAmount }),
      });
    }
    if (owner?.id) {
      await createNotification({
        recipientId: owner.id,
        type: "NEW_ORDER",
        title: "New order",
        message: `You have a new order on ${order.business.name}.`,
        targetUrl: `/studashboard/marketplace/business/${order.businessId}/orders`,
        orderId: order.id,
        businessId: order.businessId,
      });
    }
  }

  return { confirmedOrderIds: pendingOrders.map((o) => o.id) };
}
