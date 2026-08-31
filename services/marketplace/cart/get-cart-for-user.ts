// services/marketplace/cart/get-cart-for-user.ts
//
// The signed-in user's cart — read by every cart action that needs the
// current lines, and by src/app/api/marketplace/cart/route.controller.ts's
// GET handler and services/marketplace/checkout/get-checkout-summary.ts /
// create-orders-for-checkout.ts.

import { prisma } from "@/lib/prisma";
import type { CartLineItem } from "@/types/cart";
import { cartItemSelect, toCartLineItem } from "./shared/cart-mappers";

export async function getCartForUser(userId: string): Promise<CartLineItem[]> {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    select: cartItemSelect,
    orderBy: { createdAt: "desc" },
  });
  return items.map(toCartLineItem);
}
