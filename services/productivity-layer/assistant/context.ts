import { prisma } from "@/lib/prisma";
import type { requireProductivityActor } from "../auth";
import { localNow } from "@/features/productivity/schedule/domain";
import type { Scope } from "./store";

/** Caller must validate the signed actor and active turn first. No browser/session cache. */
export async function assistantContext(scope: Scope, actor: Awaited<ReturnType<typeof requireProductivityActor>>) {
  const where = { ownerId: scope.sub, conversationId: scope.cid };
  const [messages, executions, pending, preference] = await Promise.all([
    prisma.productivityAIMessage.findMany({ where, orderBy: { sequence: "desc" }, take: 24,
      select: { id: true, sequence: true, role: true, content: true, status: true } }),
    prisma.productivityAIToolExecution.findMany({ where, orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, messageId: true, toolName: true, status: true, result: true, error: true } }),
    prisma.productivityAIPendingAction.findMany({ where: { ...where, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }, take: 10, select: { id: true, preview: true, expiresAt: true } }),
    prisma.productivityPreferences.findUnique({ where: { ownerId: scope.sub }, select: { timezone: true } }),
  ]);
  const timezone = preference?.timezone || "Africa/Lagos";
  return {
    account: { student: { id: actor.id, name: `${actor.firstName} ${actor.lastName}`.trim(), timezone, development: false },
      email: actor.email, serverTime: new Date().toISOString(), localNow: localNow(timezone) },
    conversation_id: scope.cid, turn_id: scope.turn, messages: messages.reverse(),
    pending: pending.map(row => ({ id: row.id, preview: {
      tool: (row.preview as { tool?: string }).tool,
      arguments: (row.preview as { arguments?: unknown }).arguments,
    }, expiresAt: row.expiresAt })),
    executions: executions.map(row => ({ ...row, result: boundedMemory(row.result) })),
  };
}
function boundedMemory(value: unknown) {
  const serialized = JSON.stringify(value);
  return serialized && serialized.length > 6000 ? { omitted: true, reason: "Previous result was large. Re-read relevant current records before acting." } : value;
}
