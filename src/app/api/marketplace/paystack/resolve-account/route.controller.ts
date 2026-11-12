// src/app/api/marketplace/paystack/resolve-account/route.controller.ts
//
// Controller for GET /api/marketplace/paystack/resolve-account. See
// services/marketplace/payment/resolve-account.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { resolveAccount as resolveAccountAction } from "@/services/marketplace/payment/resolve-account";

export async function resolveAccount(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const accountNumber = request.nextUrl.searchParams.get("accountNumber") ?? undefined;
    const bankCode = request.nextUrl.searchParams.get("bankCode") ?? undefined;
    const resolved = await resolveAccountAction(accountNumber, bankCode);
    return NextResponse.json(resolved);
  });
}
