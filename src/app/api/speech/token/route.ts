import { requireProductivityUser } from "@/services/productivity-layer/auth";
import { checkOrigin } from "@/services/productivity-layer/validation";
import { body, respond } from "@/services/productivity-layer/assistant/http";
import { createSpeechToken } from "@/services/speech/assemblyai";
import { enforceRateLimit } from "@/services/e-learning/student/stewart/rate-limit";
import { badRequest } from "@/lib/service-error";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const user = await requireProductivityUser();
    const input = await body(request, 1024);
    if (Object.keys(input).length) throw badRequest("Voice sessions do not accept client configuration or audio.");
    enforceRateLimit(`speech-token:${user.id}`, { limit: 4, windowMs: 600000 });
    return createSpeechToken();
  });
}
