// .../vendor/[id]/capacity/route.ts
//
// GET -> this vendor's per-slot capacity + today's booked count.
// PUT  -> sets capacity for one slot.
// Thin route — see ./route.controller.ts.

import { NextRequest } from "next/server";
import { getCapacity, putCapacity } from "./route.controller";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getCapacity(id);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return putCapacity(request, id);
}
