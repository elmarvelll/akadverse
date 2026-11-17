import { NextRequest } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runLearningSweep } from "@/services/e-learning/learning-ai/worker";
export const runtime = "nodejs";
export const maxDuration = 240;
export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request); if (denied) return denied;
  try { return Response.json(await runLearningSweep(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Learning processing is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
