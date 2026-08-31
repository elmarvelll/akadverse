// src/app/api/marketplace/paystack/banks/route.controller.ts
//
// Controller for GET /api/marketplace/paystack/banks. See
// services/marketplace/payment/list-banks.ts.

import { NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { listBanks as listBanksAction } from "@/services/marketplace/payment/list-banks";

export async function getBanks(): Promise<NextResponse> {
  return runController(async () => {
    const banks = await listBanksAction();
    return NextResponse.json({ banks });
  });
}
