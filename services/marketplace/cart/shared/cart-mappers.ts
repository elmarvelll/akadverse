// services/marketplace/cart/shared/cart-mappers.ts
//
// Prisma select shape + row-to-DTO mapper shared by every cart action, so
// GET/POST/PATCH all return the exact same CartLineItem shape the
// frontend expects.

import type { Prisma } from "@prisma/client";
import type { CartLineItem } from "@/types/cart";

export const cartItemSelect = {
  id: true,
  quantity: true,
  selectedVariants: true,
  variantId: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      secure_url: true,
      businessId: true,
      business: { select: { name: true } },
    },
  },
  // The selected ProductVariant, when this line has one — its own
  // price/stock take priority over the product's (see toCartLineItem
  // below). Includes its joined name via the implicit-field value, same
  // as services/marketplace/product/shared/product-variants.ts.
  variant: {
    select: {
      price: true,
      stock: true,
      variantValues: { select: { value: { select: { value: true } } } },
    },
  },
} satisfies Prisma.CartItemSelect;

type CartItemRow = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

export function toCartLineItem(row: CartItemRow): CartLineItem {
  let selectedVariants: Record<string, string> | null = null;
  if (row.selectedVariants) {
    try {
      selectedVariants = JSON.parse(row.selectedVariants);
    } catch {
      selectedVariants = null;
    }
  }

  const variantName = row.variant?.variantValues[0]?.value.value ?? null;

  return {
    id: row.id,
    productId: row.product.id,
    businessId: row.product.businessId,
    productName: row.product.name,
    sellerName: row.product.business.name,
    price: row.variant?.price ?? row.product.price,
    quantity: row.quantity,
    stock: row.variant?.stock ?? row.product.stock,
    image: row.product.secure_url,
    selectedVariants,
    variantId: row.variantId,
    variantName,
  };
}
