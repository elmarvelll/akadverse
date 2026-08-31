// services/marketplace/product/get-public-product-detail.ts
//
// Public (not owner-scoped) product detail, for the product detail modal —
// includes the estimated delivery date/window so a buyer can see it before
// adding to cart. Called by
// src/app/api/marketplace/products/[id]/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/service-error";
import { getEstimatedDeliveryForBusiness, formatEstimatedDelivery } from "@/services/marketplace/delivery/estimated-delivery.service";
import { productVariantSelect, toVariantSummary } from "@/services/marketplace/product/shared/product-variants";
import { productImageSelect, toImageRows } from "@/services/marketplace/product/shared/product-images";

export async function getPublicProductDetail(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      price: true,
      stock: true,
      secure_url: true,
      businessId: true,
      business: { select: { name: true, approvalStatus: true } },
      images: { select: productImageSelect },
      variants: { select: productVariantSelect },
    },
  });
  // Not found (not just forbidden) — a pending/rejected business's
  // products should be indistinguishable from not existing at all to a
  // buyer browsing by URL, same as any other buyer-visibility gate in
  // this app.
  if (!product || product.business.approvalStatus !== "APPROVED") throw notFound("Product not found.");

  const { secure_url, business, images, variants, ...rest } = product;
  const estimate = await getEstimatedDeliveryForBusiness(product.businessId);
  const { date, window } = formatEstimatedDelivery(estimate);

  return {
    ...rest,
    secureUrl: secure_url,
    sellerName: business.name,
    images: toImageRows(images).map((image) => ({ secureUrl: image.secureUrl, position: image.position })),
    variants: variants.map(toVariantSummary),
    estimatedDeliveryDate: date,
    deliveryWindow: window,
  };
}
