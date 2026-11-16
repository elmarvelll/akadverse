import { requireProductivityUser } from "@/services/productivity-layer/auth";
import { checkOrigin } from "@/services/productivity-layer/validation";
import { badRequest } from "@/lib/service-error";
import { body, respond, identifier } from "@/services/productivity-layer/assistant/http";
import { listConversations, createConversation, conversationView, deleteConversation } from "@/services/productivity-layer/assistant/store";
import { chat, decide, reconcile } from "@/services/productivity-layer/assistant/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  return respond(async () => {
    const user = await requireProductivityUser(request.headers.get("x-productivity-user"));
    const search = new URL(request.url).searchParams, id = search.get("conversation");
    const before = search.has("before") ? Number(search.get("before")) : undefined;
    if (before !== undefined && (!Number.isInteger(before) || before < 0)) throw badRequest("Invalid message cursor.");
    return id ? conversationView(user.id, identifier(id), before) : listConversations(user.id, search.has("cursor") ? identifier(search.get("cursor")) : undefined);
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const user = await requireProductivityUser(request.headers.get("x-productivity-user")), input = await body(request);
    if (input.action === "create") return createConversation(user.id);
    const id = identifier(input.conversation_id), key = identifier(input.request_id, "Message identifier");
    if (input.action === "delete") return deleteConversation(user.id, id, input.confirmed === true);
    if (input.action === "chat" && typeof input.message === "string") return chat(user.id, id, key, input.message);
    if (input.action === "decide" && typeof input.confirm === "boolean") return decide(user.id, id, key, identifier(input.pending_id), input.confirm);
    if (input.action === "reconcile") return reconcile(user.id, id, key, identifier(input.execution_id));
    throw badRequest("Unsupported assistant request.");
  });
}
