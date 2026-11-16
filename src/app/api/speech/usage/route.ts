import { requireProductivityUser } from "@/services/productivity-layer/auth";
import { checkOrigin } from "@/services/productivity-layer/validation";
import { body, respond } from "@/services/productivity-layer/assistant/http";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { badRequest } from "@/lib/service-error";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const user = await requireProductivityUser(), input = await body(request, 1024);
    enforceRateLimit(`speech-usage:${user.id}`, { limit: 20, windowMs: 600000 });
    if (typeof input.sessionId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.sessionId) || !["completed", "cancelled", "error"].includes(String(input.status)) || !Number.isInteger(input.durationSeconds) || Number(input.durationSeconds) < 0 || Number(input.durationSeconds) > 360) throw badRequest("Invalid voice session usage.");
    // Client-reported diagnostics only. No audio/transcripts or billing authority.
    console.info("[speech] Session ended", { userId: user.id, sessionId: input.sessionId, durationSeconds: input.durationSeconds, status: input.status });
    return { recorded: true };
  });
}
