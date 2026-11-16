import { body, respond } from "@/services/productivity-layer/assistant/http";
import { checkServiceSecret, verifyDelegation } from "@/services/productivity-layer/assistant/security";
import { serviceCallback } from "@/services/productivity-layer/assistant/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return respond(async () => {
    checkServiceSecret(request.headers.get("x-productivity-service-token"));
    const scope = verifyDelegation(request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
    return serviceCallback(scope, await body(request, 65536));
  });
}
