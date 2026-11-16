import { NextRequest } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runRevisionSweep } from "@/services/e-learning/revision-questions/worker";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request); if (denied) return denied;
  try { return Response.json(await runRevisionSweep(), { headers: { "Cache-Control": "no-store" } }); }
  catch { console.warn("[revision-questions] sweep failed"); return Response.json({ error: "Revision processing is unavailable. Check database and provider configuration." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
