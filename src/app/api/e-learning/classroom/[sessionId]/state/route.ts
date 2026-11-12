// GET /api/e-learning/classroom/[sessionId]/state
//
// Polled every few seconds by the class page: still live?, the question queue, the current "Do you understand?"
// poll. See services/e-learning/classroom/state.ts for why this is polling and not a socket.

import { NextResponse } from "next/server";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getClassroomState } from "@/services/e-learning/classroom/state";
import { ServiceError } from "@/lib/service-error";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const session = await requireElearningRole(["student", "faculty"]);
    const state = await getClassroomState({ id: session.user.id, role: session.user.role }, sessionId);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[classroom state]", e);
    return NextResponse.json({ error: "Couldn't load the class." }, { status: 500 });
  }
}
