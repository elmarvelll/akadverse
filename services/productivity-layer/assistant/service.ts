import { prisma } from "@/lib/prisma";
import { ServiceError, badRequest, notFound, conflict } from "@/lib/service-error";
import { requireProductivityActor } from "../auth";
import { signDelegation, assistantServiceUrl, serviceSecret, type Delegation } from "./security";
import { beginTurn, conversationView, finishTurn, assertTurn, lockOwner, type Scope } from "./store";
import { body } from "./http";
import { executeTool, performMutation, resultProjection } from "./tools";

import { assistantContext } from "./context";
import { assistantTiming } from "./timing";

export async function serviceCallback(scope: Delegation, input: Record<string, unknown>) {
  const [actor] = await assistantTiming("callback.authorize", scope.turn, () => Promise.all([
    requireProductivityActor(scope.sub), assertTurn(prisma, scope),
  ]));
  if (input.action === "context") return assistantTiming("callback.context", scope.turn, () => assistantContext(scope, actor));
  if (input.action === "tool" && typeof input.name === "string" && typeof input.step === "number") {
    const { step, name, arguments: args } = input;
    return assistantTiming("callback.tool", scope.turn, () => executeTool(scope, step, name, args));
  }
  throw badRequest("Unsupported assistant service action.");
}
export async function chat(ownerId: string, conversationId: string, clientKey: string, content: string) {
  // Configuration is checked before accepting a user turn, so setup errors are actionable.
  const url = assistantServiceUrl(), secret = serviceSecret();
  const reference = crypto.randomUUID();
  const started = await assistantTiming("chat.begin", reference, () => beginTurn(ownerId, conversationId, clientKey, content));
  if (!started.started) return conversationView(ownerId, conversationId);
  const scope: Scope = { sub: ownerId, cid: conversationId, turn: started.turn };
  try {
    const response = await assistantTiming("chat.service", started.turn, () => fetch(new URL("/api/v1/assistant/chat", url), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(65000),
      headers: { "Content-Type": "application/json", "X-Productivity-Service-Token": secret, Authorization: `Bearer ${signDelegation(ownerId, conversationId, started.turn, "akadverse-productivity-ai")}` },
      body: JSON.stringify({ conversation_id: conversationId, turn_id: started.turn, callback_token: signDelegation(ownerId, conversationId, started.turn, "akadverse-productivity-backend") }),
    }));
    if (!response.ok) throw new ServiceError(503, "The assistant service could not finish this message.");
    const value: unknown = await body(response);
    if (!value || typeof value !== "object" || !("message" in value) || typeof value.message !== "string" || value.message.length > 8000) throw new Error("invalid response");
    const message = value.message;
    const rawStatus = "status" in value ? value.status : "completed";
    const status = typeof rawStatus === "string" && ["completed", "awaiting_clarification", "awaiting_confirmation", "failed"].includes(rawStatus) ? rawStatus : "completed";
    // Tool records are authoritative; provider output cannot remove a pending confirmation.
    const pending = await prisma.productivityAIPendingAction.count({ where: { ownerId, conversationId, status: "pending", expiresAt: { gt: new Date() } } });
    await assistantTiming("chat.finish", started.turn, () => finishTurn(scope, message, pending ? "awaiting_confirmation" : status));
  } catch {
    await finishTurn(scope, "The assistant could not finish this message. Any confirmed changes are listed in the operation results. Review them before repeating a request.", "failed");
  }
  return assistantTiming("chat.view", started.turn, () => conversationView(ownerId, conversationId));
}
export async function decide(ownerId: string, conversationId: string, clientKey: string, pendingId: string, confirm: boolean) {
  const pending = await prisma.productivityAIPendingAction.findFirst({ where: { id: pendingId, ownerId, conversationId }, include: { execution: true } });
  if (!pending) throw notFound("This proposed action is unavailable.");
  if (pending.status !== "pending") return conversationView(ownerId, conversationId);
  const { turn, started } = await beginTurn(ownerId, conversationId, clientKey, confirm ? "Confirm the proposed action." : "Cancel the proposed action.");
  if (!started) return conversationView(ownerId, conversationId);
  const scope = { sub: ownerId, cid: conversationId, turn };
  try {
    if (!confirm) {
      await prisma.$transaction(async tx => {
        await lockOwner(tx, ownerId); await assertTurn(tx, scope);
        const changed = await tx.productivityAIPendingAction.updateMany({ where: { id: pendingId, ownerId, conversationId, status: "pending" }, data: { status: "cancelled", resolvedAt: new Date() } });
        if (!changed.count) throw conflict("This action has already been resolved.");
        await tx.productivityAIToolExecution.updateMany({ where: { id: pending.executionId, status: { not: "completed" } }, data: { status: "cancelled", completedAt: new Date() } });
      });
      await finishTurn(scope, "The proposed action was cancelled. No change was made by this proposal.", "completed");
    } else {
      const result = await performMutation(scope, pending.execution, pending.execution.arguments as Record<string, unknown>, pendingId);
      await finishTurn(scope, result.status === "completed" ? "The confirmed action was saved. Its result is shown below." : result.status === "unknown" ? "The outcome could not be confirmed. Do not repeat the change with a new request; use Recheck outcome." : "The proposed change could not be saved. Review the operation error and cancel this proposal before asking for a new one.", result.status === "completed" ? "completed" : "failed");
    }
  } catch {
    await finishTurn(scope, "This decision could not be completed. Reload the conversation and check the action's status before retrying.", "failed");
  }
  return conversationView(ownerId, conversationId);
}
export async function reconcile(ownerId: string, conversationId: string, clientKey: string, executionId: string) {
  const execution = await prisma.productivityAIToolExecution.findFirst({ where: { id: executionId, ownerId, conversationId } });
  if (!execution) throw notFound();
  if (execution.status === "completed") return conversationView(ownerId, conversationId);
  if (!["pending", "unknown"].includes(execution.status)) throw badRequest("This operation cannot be rechecked. Review its saved status.");
  const { turn, started } = await beginTurn(ownerId, conversationId, clientKey, "Recheck the previous operation's outcome.");
  if (started) {
    const scope = { sub: ownerId, cid: conversationId, turn };
    // Only reconcile a durable mutation receipt. Never re-run Gemini to discover whether it saved.
    const receipt = await prisma.$transaction(async tx => {
      await lockOwner(tx, ownerId); await assertTurn(tx, scope);
      const saved = await tx.productivityRequest.findUnique({ where: { ownerId_key: { ownerId, key: execution.operationKey } } });
      if (saved) {
        const raw = (saved.result as { value: unknown }).value;
        await tx.productivityAIToolExecution.update({ where: { id: execution.id }, data: { status: "completed", result: JSON.parse(JSON.stringify(resultProjection(execution.toolName, execution.arguments as Record<string, unknown>, raw))), completedAt: new Date() } });
      } else {
        // The owner lock fences the old turn: it can no longer commit a later write.
        await tx.productivityAIToolExecution.update({ where: { id: execution.id }, data: { status: "failed", error: { error: "No committed mutation receipt exists. The earlier worker is fenced; inspect the workspace before proposing a new change." }, completedAt: new Date() } });
      }
      return saved;
    });
    await finishTurn(scope, receipt ? "The earlier change was confirmed from its saved backend receipt. Its operation result is now available." : "No committed change was found for that operation. The earlier worker can no longer save a change; inspect the workspace before requesting another operation.", receipt ? "completed" : "failed");
  }
  return conversationView(ownerId, conversationId);
}

