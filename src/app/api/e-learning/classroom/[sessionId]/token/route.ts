// GET /api/e-learning/classroom/[sessionId]/token
//
// The LiveKit join token for a live class. Authenticates the caller, then services/e-learning/classroom/token.ts
// checks they're this class's lecturer or a registered student and sets the publish grant accordingly (only lecturers
// can publish). The browser then connects straight to LiveKit; no video passes through this server.

import { NextResponse } from "next/server";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { createJoinToken } from "@/services/e-learning/classroom/token";
import { ServiceError } from "@/lib/service-error";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const session = await requireElearningRole(["student", "faculty"]);
    const joined = await createJoinToken({ id: session.user.id, role: session.user.role }, sessionId);
    return NextResponse.json(joined, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[classroom token]", e);
    return NextResponse.json({ error: "Couldn't join the class." }, { status: 500 });
  }
}
