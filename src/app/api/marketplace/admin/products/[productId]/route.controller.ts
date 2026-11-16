// .../admin/products/[productId]/route.controller.ts
//
// Controller for GET .../admin/products/[productId]. See
// services/marketplace/admin/get-product-detail-for-admin.ts.

import { NextResponse } from "next/server";
import { runController } from "@/lib/marketplace-controller-helpers";
import { requireAdmin } from "@/lib/marketplace-admin";
import { getProductDetailForAdmin } from "@/services/marketplace/admin/get-product-detail-for-admin";

export async function getProduct(productId: string): Promise<NextResponse> {
  return runController(async () => {
    await requireAdmin();
    const product = await getProductDetailForAdmin(productId);
    return NextResponse.json({ product });
  });
}
