// services/marketplace/checkout/create-orders-for-checkout.ts
//
// Creates one Order (with its OrderItems) per business represented in the
// cart, all sharing one Paystack reference — see the comment on
// Order.paystackReference in prisma/schema.prisma for why that column
// isn't unique. Called by
// src/app/api/marketplace/checkout/initialize/route.controller.ts.
//
// Stock is re-validated and decremented HERE, inside the same transaction
// as order creation — not just at add-to-cart time, which can be stale by
// checkout (another buyer could have bought the remaining stock in
// between). Whichever stock source a cart line uses (its selected
// variant's, or the product's own) is what gets checked/decremented.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { conflict } from "@/lib/service-error";
import { getCartForUser } from "@/services/marketplace/cart/get-cart-for-user";
import { getEstimatedDeliveryForBusiness } from "@/services/marketplace/delivery/estimated-delivery.service";
import { SERVICE_FEE_RATE } from "./shared/service-fee";
import { EmptyCartError } from "./shared/empty-cart-error";

export { EmptyCartError };

export async function createOrdersForCheckout(userId: string, location: string) {
  const cartItems = await getCartForUser(userId);
  if (cartItems.length === 0) {
    throw new EmptyCartError("Your cart is empty.");
  }

  const byBusiness = new Map<string, typeof cartItems>();
  for (const item of cartItems) {
    byBusiness.set(item.businessId, [...(byBusiness.get(item.businessId) ?? []), item]);
  }

  const reference = `AKD-${Date.now()}-${randomUUID().slice(0, 8)}`;

  // The estimated delivery date/window is calculated per business (each
  // business has its own delivery days) before creating the orders, so
  // every order/item is stamped with it at creation time rather than
  // computed lazily later.
  const estimates = new Map(
    await Promise.all(
      Array.from(byBusiness.keys()).map(
        async (businessId) => [businessId, await getEstimatedDeliveryForBusiness(businessId)] as const
      )
    )
  );

  const orders = await prisma.$transaction(async (tx) => {
    const created = [];

    for (const [businessId, items] of byBusiness) {
      // A business already in the buyer's cart could have been rejected
      // (or hasn't been approved yet) since it was added — search/browse
      // already keep unapproved businesses out of reach for a NEW add, but
      // a stale cart line is still possible, so this is checked again
      // here as the actual point of no return.
      const business = await tx.business.findUnique({ where: { id: businessId }, select: { approvalStatus: true } });
      if (business?.approvalStatus !== "APPROVED") {
        throw conflict(`${items[0].sellerName} isn't currently accepting orders.`);
      }

      // Re-check + decrement stock for every line before creating
      // anything for this business — a real gap this closes: stock was
      // previously only ever clamped at add-to-cart time, never
      // re-verified here.
      for (const item of items) {
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } });
          if (!variant || variant.stock < item.quantity) {
            throw conflict(`${item.productName}${item.variantName ? ` (${item.variantName})` : ""} no longer has enough stock.`);
          }
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.quantity } } });
        } else {
          const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true } });
          if (!product || product.stock < item.quantity) {
            throw conflict(`${item.productName} no longer has enough stock.`);
          }
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        }
      }

      const estimate = estimates.get(businessId)!;
      const order = await tx.order.create({
        data: {
          userId,
          businessId,
          status: "PENDING_SELLER",
          paymentStatus: "pending",
          paystackReference: reference,
          deliveryLocation: location || null,
          estimatedDeliveryAt: estimate.estimatedDeliveryAt,
          deliveryWindowStart: estimate.deliveryWindowStart,
          deliveryWindowEnd: estimate.deliveryWindowEnd,
          totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              variantName: item.variantName,
              quantity: item.quantity,
              price: item.price,
              selectedVariants: item.selectedVariants ? JSON.stringify(item.selectedVariants) : null,
            })),
          },
        },
      });
      created.push(order);
    }

    // The cart itself is deliberately NOT cleared here — these orders are
    // still "pending payment" at this point (see paymentStatus: "pending"
    // above). It's only cleared once payment actually confirms, in
    // confirm-payment-by-reference.ts, same as before this change.
    return created;
  });

  const subtotal = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  return { reference, totalAmount: subtotal + subtotal * SERVICE_FEE_RATE, orderIds: orders.map((o) => o.id) };
}
