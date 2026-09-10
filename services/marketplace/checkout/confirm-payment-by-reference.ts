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
      vendorDeliveryBookingId: true,
      business: { select: { name: true, user: { select: { id: true, email: true } } } },
      items: { select: { quantity: true, price: true, product: { select: { name: true } }, side: { select: { name: true } } } },
    },
  });

  if (pendingOrders.length === 0) {
    return { confirmedOrderIds: [] };
  }

  // Additive for the Vendor checkout path — a reference shared by
  // Business-only orders has no matching row here, so this is a pure
  // no-op for Business checkouts (see
  // docs/marketplace/decisions/vendor-extends-business.md). Confirmed in
  // the SAME transaction as the orders below so a booking can never end
  // up CONFIRMED with its orders still "pending", or vice versa.
  const vendorDeliveryBookingId = pendingOrders.find((o) => o.vendorDeliveryBookingId)?.vendorDeliveryBookingId ?? null;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: { in: pendingOrders.map((o) => o.id) } },
      data: { paymentStatus: "paid" },
    });

    if (vendorDeliveryBookingId) {
      await tx.vendorDeliveryBooking.updateMany({
        where: { id: vendorDeliveryBookingId, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED" },
      });

      // Vendor orders are never manually accepted/rejected (spec §6) —
      // payment confirmation IS the acceptance moment. Business orders are
      // untouched here: they keep starting at PENDING_SELLER and go
      // through the seller's own accept/reject flow unchanged. See
      // docs/marketplace/decisions/vendor-independent-architecture.md.
      const vendorOrderIds = pendingOrders.filter((o) => o.vendorDeliveryBookingId).map((o) => o.id);
      if (vendorOrderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: vendorOrderIds } },
          data: { status: "ACCEPTED", acceptedAt: now, fulfillmentStatus: "PROCESSING" },
        });
        for (const orderId of vendorOrderIds) {
          await recordOrderEvent(tx, { orderId, type: "SELLER_ACCEPTED", actorType: "system", message: "Vendor orders are auto-accepted on payment — no manual accept step." });
        }
      }
    }

    for (const order of pendingOrders) {
      await recordOrderEvent(tx, { orderId: order.id, type: "ORDER_CREATED", actorType: "buyer", actorId: order.userId });
      await recordOrderEvent(tx, { orderId: order.id, type: "SELLER_NOTIFIED", actorType: "system" });
    }
  });

  // The cart was fully snapshotted into these orders at initialize time —
  // clearing it now removes exactly what was just paid for. Scoped to
  // Business-only cart lines (productId set, product's business is type
  // BUSINESS) — NOT a blanket delete-everything-for-this-user, since
  // CartItem is now shared with the Vendor cart (see
  // docs/marketplace/decisions/vendor-extends-business.md): a user paying
  // for a Business checkout must not have an unrelated, still-in-progress
  // Vendor cart silently wiped out. The Vendor checkout path clears its
  // own cart lines separately, below.
  const userId = pendingOrders[0].userId;
  if (vendorDeliveryBookingId) {
    // Vendor checkout path — clear only vendor-scoped cart lines (Sides,
    // or Products belonging to a School Vendor), same rationale as the
    // Business branch below.
    await prisma.cartItem.deleteMany({
      where: { userId, OR: [{ sideId: { not: null } }, { product: { business: { type: "SCHOOL_VENDOR" } } }] },
    });
  } else {
    await prisma.cartItem.deleteMany({ where: { userId, productId: { not: null }, product: { business: { type: "BUSINESS" } } } });
  }

  // Notify each business owner of their new order. Fire-and-forget by
  // design (see services/marketplace/notifications/email.service.ts) —
  // a slow/failed email must never hold up payment confirmation.
  for (const order of pendingOrders) {
    const owner = order.business.user;
    const itemSummary = order.items
      .map((item) => `${item.quantity} x ${item.product?.name ?? item.side?.name ?? "item"} (₦${(item.price * item.quantity).toLocaleString()})`)
      .join("<br/>");
    const totalAmount = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (owner?.email) {
      void sendEmail({
        to: owner.email,
        ...newOrderEmail({ businessName: order.business.name, orderId: order.id, itemSummary, totalAmount }),
      });
    }
    if (owner?.id) {
      // A vendor order's owner dashboard lives at a different route tree
      // than Business's — see
      // docs/marketplace/decisions/vendor-independent-architecture.md.
      const dashboardBase = order.vendorDeliveryBookingId
        ? `/studashboard/marketplace/vendor-dashboard/${order.businessId}`
        : `/studashboard/marketplace/business/${order.businessId}`;
      await createNotification({
        recipientId: owner.id,
        type: "NEW_ORDER",
        title: "New order",
        message: `You have a new order on ${order.business.name}.`,
        targetUrl: `${dashboardBase}/orders`,
        orderId: order.id,
        businessId: order.businessId,
      });
    }
  }

  return { confirmedOrderIds: pendingOrders.map((o) => o.id) };
}
