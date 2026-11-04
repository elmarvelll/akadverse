import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runAiIngestSweep } from "@/services/e-learning/ai-ingest/worker";
// Daily Vercel fallback; use an external authenticated scheduler for prompt processing.
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  return NextResponse.json(await runAiIngestSweep(), { headers: { "Cache-Control": "no-store" } });
}
