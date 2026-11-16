import { NextResponse } from "next/server";
import { runController } from "@/lib/marketplace-controller-helpers";
import { requireDelivererId } from "../shared/require-deliverer";
import { listMySchedule } from "@/services/marketplace/deliverer/list-my-schedule";
export const dynamic = "force-dynamic";
export async function GET() {
  return runController(async () => NextResponse.json({ schedule: await listMySchedule(await requireDelivererId()) }));
}
