// src/lib/cron-auth.ts
//
// Shared guard for every /api/cron/* route (see docs/marketplace/systems/cron-system.md).
// Vercel Cron calls these routes on schedule with an `Authorization: Bearer
// <CRON_SECRET>` header (configured once in vercel.json + the project's env
// vars) — this is the only thing standing between these routes and anyone
// who guesses the URL, since they're not behind the normal session-cookie
// gate (src/proxy.ts's PUBLIC_API_PREFIXES lets /api/cron/* through
// unauthenticated so Vercel's scheduler, which has no session, can call
// them at all).

import { NextRequest, NextResponse } from "next/server";

export function requireCronSecret(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Refuse to run rather than silently allow every caller through if the
    // secret was never configured — a misconfigured deploy should fail
    // loudly here, not quietly skip auth.
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
