// src/app/api/marketplace/uploads/route.controller.ts
//
// Controller for POST /api/marketplace/uploads. See
// services/marketplace/uploads/upload.service.ts.

import { NextRequest, NextResponse } from "next/server";
import { runController } from "@/lib/controller-helpers";
import { badRequest } from "@/lib/service-error";
import { uploadMarketplaceImage } from "@/services/marketplace/uploads/upload.service";

export async function upload(request: NextRequest): Promise<NextResponse> {
  return runController(async () => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw badRequest("No file provided.");

    const result = await uploadMarketplaceImage(file);
    return NextResponse.json(result, { status: 201 });
  });
}
