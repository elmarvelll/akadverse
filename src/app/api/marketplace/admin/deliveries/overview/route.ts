import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/marketplace-admin";
import { runController } from "@/lib/marketplace-controller-helpers";
import { getDeliveryOverview } from "@/services/marketplace/delivery-roster/delivery-overview";

export async function GET() {
  return runController(async () => {
    await requireAdmin();
    return NextResponse.json({ overview: await getDeliveryOverview() });
  });
}
