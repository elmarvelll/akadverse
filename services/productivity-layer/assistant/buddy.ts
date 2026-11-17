import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/service-error";
import type { ProductivityExecutionHooks } from "../operations";
import { browseBuddy, buddyDetail, createBuddyInTransaction, mutateBuddyInTransaction, notifyBuddyMutation, buddyMutationMessage } from "../buddy-system/service";
import { json, lockOwner } from "./store";

type Args = Record<string, unknown>;
const actions: Record<string, string> = { apply_buddy: "apply", accept_buddy_application: "accept", decline_buddy_application: "decline", close_buddy_listing: "close" };
export const buddyWriteTools = new Set(["create_buddy_group", "create_buddy_request", ...Object.keys(actions)]);
export async function readBuddyTool(userId: string, name: string, args: Args) {
  if (name === "list_buddies") {
    const params = new URLSearchParams();
    for (const key of ["view", "search", "page"]) if (args[key] !== undefined) params.set(key, String(args[key]));
    return browseBuddy(userId, params);
  }
  const detail = await buddyDetail(userId, String(args.listing_id));
  const offset = (Number(args.application_page || 1) - 1) * 50;
  return { ...detail, applications: detail.applications.slice(offset, offset + 50), applicationCount: detail.applications.length, applicationsTruncated: detail.applications.length > offset + 50 };
}

export async function buddySnapshot(tx: Prisma.TransactionClient, userId: string, name: string, args: Args) {
  if (!args.listing_id) return { newRecord: true };
  const id = String(args.listing_id);
  // Match the Buddy UI's listing lock before fingerprinting capacity/application state.
  await tx.$queryRaw`SELECT "id" FROM "public"."BuddyListing" WHERE "id" = ${id} FOR UPDATE`;
  const row = await tx.buddyListing.findUnique({ where: { id }, select: {
    id: true, creatorId: true, title: true, description: true, kind: true, status: true, maxMembers: true,
  } });
  if (!row) throw notFound("This buddy listing is unavailable.");
  if (name !== "apply_buddy" && row.creatorId !== userId) throw forbidden("Only the creator can manage this listing.");
  if (name === "apply_buddy" && row.creatorId === userId) throw conflict("You cannot apply to your own listing.");
  const [memberCount, application] = await Promise.all([
    tx.buddyApplication.count({ where: { listingId: id, status: "ACCEPTED" } }),
    args.application_id
      ? tx.buddyApplication.findFirst({ where: { id: String(args.application_id), listingId: id }, select: { id: true, userId: true, status: true, user: { select: { firstName: true, lastName: true } } } })
      : tx.buddyApplication.findUnique({ where: { listingId_userId: { listingId: id, userId } }, select: { id: true, userId: true, status: true, user: { select: { firstName: true, lastName: true } } } }),
  ]);
  if (args.application_id && (!application || application.status !== "PENDING" || application.userId === row.creatorId)) throw conflict("This application is no longer pending.");
  return { ...row, memberCount, application };
}

/** Domain write, receipt, execution result and confirmation commit in one transaction. */
export async function executeBuddyMutation(userId: string, name: string, args: Args, requestId: string, requestHash: string, hooks: ProductivityExecutionHooks) {
  if (!buddyWriteTools.has(name)) throw badRequest("Unsupported buddy action.");
  let notification: { recipient: string; message: string } | undefined;
  const result = await prisma.$transaction(async tx => {
    await lockOwner(tx, userId);
    const saved = await tx.productivityRequest.findUnique({ where: { ownerId_key: { ownerId: userId, key: requestId } } });
    if (saved) {
      if (saved.requestHash !== requestHash) throw conflict("This request identifier was used for different input.");
      const value = (saved.result as { value: unknown }).value;
      await hooks.authorize(tx, true);
      await hooks.commit(tx, value);
      return value;
    }
    await hooks.authorize(tx, false);
    let value: { id: string; message: string };
    if (name === "create_buddy_group" || name === "create_buddy_request") {
      const group = name === "create_buddy_group";
      const created = await createBuddyInTransaction(tx, userId, {
        kind: group ? "GROUP" : "REQUEST", title: args.title, description: args.description,
        privateDetails: group ? args.invitation_url : args.contact_details, maxMembers: args.max_members,
      });
      value = { id: created.id, message: group ? "Group listing created." : "Buddy request created." };
    } else {
      notification = await mutateBuddyInTransaction(tx, userId, {
        id: args.listing_id, action: actions[name], applicationId: args.application_id, contactDetails: args.contact_details,
      });
      value = { id: String(args.listing_id), message: buddyMutationMessage(actions[name], notification.message) };
    }
    await tx.productivityRequest.create({ data: { ownerId: userId, key: requestId, requestHash, result: json({ value }) } });
    await hooks.commit(tx, value);
    return value;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });
  // Only committed, newly executed actions notify; receipt replays do not.
  if (notification) await notifyBuddyMutation(notification, String(args.listing_id));
  return result;
}
