import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/service-error";
import { object, text } from "../validation";
import { capacity, canAccept, inviteUrl } from "@/features/productivity/buddy/domain";
import { createNotification } from "@/services/marketplace/notifications/notification.service";

const identity = { firstName: true, lastName: true } as const;
// Public projections never select either contact or invitation fields.
const cardSelect = {
  id: true, creatorId: true, kind: true, title: true, description: true,
  maxMembers: true, status: true, createdAt: true, creator: { select: identity },
  applications: { select: { userId: true, status: true } },
} satisfies Prisma.BuddyListingSelect;
type CardRow = Prisma.BuddyListingGetPayload<{ select: typeof cardSelect }>;
function card(row: CardRow, userId: string) {
  const { applications, ...publicRow } = row;
  return { ...publicRow, mine: row.creatorId === userId,
    memberCount: applications.filter(a => a.status === "ACCEPTED").length,
    ...(row.creatorId === userId ? { pendingCount: applications.filter(a => a.status === "PENDING").length } : {}),
    application: applications.find(a => a.userId === userId)?.status ?? null };
}
export async function browseBuddy(userId: string, params: URLSearchParams) {
  const view = params.get("view") || "discover", search = (params.get("search") || "").trim().slice(0, 160);
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  if (!Number.isInteger(page)) throw badRequest("Invalid page.");
  const where: Prisma.BuddyListingWhereInput = view === "manage" ? { creatorId: userId, kind: "GROUP" }
    : view === "joined" ? { kind: "GROUP", creatorId: { not: userId }, applications: { some: { userId, status: "ACCEPTED" } } }
    : view === "created-requests" ? { kind: "REQUEST", creatorId: userId }
    : view === "applied-requests" ? { kind: "REQUEST", creatorId: { not: userId }, applications: { some: { userId } } }
    : view === "group-applications" ? { kind: "GROUP", creatorId: { not: userId }, applications: { some: { userId } } }
    : view === "activity" ? { OR: [{ creatorId: userId }, { applications: { some: { userId } } }] }
    : { status: "OPEN", ...(view === "groups" ? { kind: "GROUP" } : view === "requests" ? { kind: "REQUEST" } : {}) };
  const rows = await prisma.buddyListing.findMany({ where: { AND: [where, ...(search ? [{ OR: [{ title: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }] }] : [])] }, select: cardSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 24, take: 25 });
  return { items: rows.slice(0, 24).map(row => card(row, userId)), hasMore: rows.length > 24 };
}
export async function buddyDetail(userId: string, id: string) {
  return prisma.$transaction(async tx => {
    const row = await tx.buddyListing.findUnique({ where: { id }, select: cardSelect });
    if (!row) throw notFound("This listing is unavailable.");
    const own = row.creatorId === userId, accepted = row.applications.some(a => a.userId === userId && a.status === "ACCEPTED");
    const secret = own || accepted ? await tx.buddyListing.findUnique({ where: { id }, select: { privateDetails: true } }) : null;
    const privateDetails = row.kind === "GROUP" ? secret && inviteUrl(secret.privateDetails) : secret?.privateDetails;
    const applications = own ? await tx.buddyApplication.findMany({ where: { listingId: id }, select: { id: true, userId: true, status: true, createdAt: true, user: { select: identity } }, orderBy: { createdAt: "asc" } }) : [];
    // The applicant's contact is shared only with the creator after matching.
    const contacts = own && row.kind === "REQUEST" ? await tx.buddyApplication.findMany({ where: { listingId: id, status: "ACCEPTED" }, select: { id: true, contactDetails: true } }) : [];
    return { ...card(row, userId), ...(own || accepted ? { privateDetails: privateDetails ?? null } : {}), applications: applications.map(a => ({ ...a, ...(contacts.find(c => c.id === a.id) || {}) })) };
  });
}
const field = (value: unknown, maximum: number, label: string) => text(value, maximum, label).trim();
export async function createBuddy(userId: string, input: unknown) {
  return prisma.$transaction(tx => createBuddyInTransaction(tx, userId, input));
}
export async function createBuddyInTransaction(tx: Prisma.TransactionClient, userId: string, input: unknown) {
  const o = object(input);
  if (o.kind !== "GROUP" && o.kind !== "REQUEST") throw badRequest("Choose a group or buddy request.");
  const title = field(o.title, 160, "Title"), description = field(o.description, 4000, "Description");
  let privateDetails = field(o.privateDetails, 2000, o.kind === "GROUP" ? "Invitation link" : "Contact details"), maximum: number | null = null;
  if (o.kind === "GROUP") {
    const url = inviteUrl(privateDetails); if (!url) throw badRequest("Use a valid HTTPS WhatsApp or Telegram invitation link."); privateDetails = url;
    try { maximum = capacity(o.maxMembers); } catch (e) { throw badRequest((e as Error).message); }
  }
  return tx.buddyListing.create({ data: { creatorId: userId, kind: o.kind, title, description, privateDetails, maxMembers: maximum,
    status: maximum === 1 ? "FULL" : "OPEN",
    ...(o.kind === "GROUP" ? { applications: { create: { userId, status: "ACCEPTED" } } } : {}) }, select: { id: true } });
}
export async function mutateBuddy(userId: string, input: unknown) {
  const result = await prisma.$transaction(tx => mutateBuddyInTransaction(tx, userId, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 });
  await notifyBuddyMutation(result, String(object(input).id));
  return { message: buddyMutationMessage(String(object(input).action), result.message) };
}
export async function mutateBuddyInTransaction(tx: Prisma.TransactionClient, userId: string, input: unknown) {
  const o = object(input), id = field(o.id, 200, "Listing"), action = o.action;
  if (!["apply", "accept", "decline", "close"].includes(String(action))) throw badRequest("Invalid action.");
  // One lock domain for apply, approve, decline and close. Under READ COMMITTED
  // a waiter sees the preceding commit before checking capacity or matching.
  await tx.$queryRaw`SELECT "id" FROM "public"."BuddyListing" WHERE "id" = ${id} FOR UPDATE`;
  const row = await tx.buddyListing.findUnique({ where: { id }, select: cardSelect });
  if (!row) throw notFound("This listing is unavailable.");
  if (action !== "apply" && row.creatorId !== userId) throw forbidden("Only the creator can manage this listing.");
  if (action === "close") { await tx.buddyListing.update({ where: { id }, data: { status: "CLOSED" } }); return { recipient: "", message: "Listing closed." }; }
  if (action === "apply") {
    if (row.creatorId === userId) throw conflict("You cannot apply to your own listing.");
    const existing = row.applications.find(a => a.userId === userId);
    if (existing) throw conflict(`Your application is already ${existing.status.toLowerCase()}.`);
    if (!canAccept(row.status, row.applications.filter(a => a.status === "ACCEPTED").length, row.maxMembers)) throw conflict("This listing is full, matched or closed.");
    const contactDetails = row.kind === "REQUEST" ? field(o.contactDetails, 2000, "Your contact details") : null;
    await tx.buddyApplication.create({ data: { listingId: id, userId, contactDetails } });
    return { recipient: row.creatorId, message: "A new application is pending review." };
  }
  const applicationId = field(o.applicationId, 200, "Application");
  const applicant = await tx.buddyApplication.findFirst({ where: { id: applicationId, listingId: id } });
  if (!applicant || applicant.userId === row.creatorId || applicant.status !== "PENDING") throw conflict("This application is no longer pending.");
  if (action === "accept") {
    const count = await tx.buddyApplication.count({ where: { listingId: id, status: "ACCEPTED" } });
    if (!canAccept(row.status, count, row.maxMembers)) throw conflict("This listing is full, matched or closed.");
    if (row.kind === "REQUEST" && count > 0) throw conflict("This request is already matched.");
    await tx.buddyApplication.update({ where: { id: applicant.id }, data: { status: "ACCEPTED" } });
    if (row.kind === "REQUEST") {
      await tx.buddyListing.update({ where: { id }, data: { status: "MATCHED" } });
      await tx.buddyApplication.updateMany({ where: { listingId: id, status: "PENDING" }, data: { status: "DECLINED" } });
    } else if (row.maxMembers !== null && count + 1 >= row.maxMembers) await tx.buddyListing.update({ where: { id }, data: { status: "FULL" } });
  } else await tx.buddyApplication.update({ where: { id: applicant.id }, data: { status: "DECLINED" } });
  return { recipient: applicant.userId, message: action === "accept" ? "Your application was accepted. Open the listing to access the shared details." : "Your application was declined." };
}
export function buddyMutationMessage(action: string, message: string) {
  return action === "apply" ? "Request submitted." : action === "accept" ? "Application accepted." : action === "decline" ? "Application declined." : message;
}
export async function notifyBuddyMutation(result: { recipient: string; message: string }, id: string) {
  if (result.recipient) {
    try { await createNotification({ recipientId: result.recipient, type: "BUDDY_APPLICATION", title: "Buddy System", message: result.message, targetUrl: `/studashboard/productivity-layer#buddy?listing=${encodeURIComponent(id)}` }); }
    catch { console.error("Buddy notification delivery failed"); }
  }
}
