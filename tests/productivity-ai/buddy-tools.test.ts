import { it, mock, before } from "node:test";
import assert from "node:assert/strict";

// In-memory transaction boundary: a failure rolls back listings, receipts and executions.
let state = { listings: [] as Record<string, unknown>[], receipts: [] as Record<string, unknown>[], commits: 0 };
let notifications = 0;
type Application = { id: string; userId: string; status: string; contactDetails?: string };
function applications(row: Record<string, unknown>) { return row.applications as Application[]; }
const tx = {
  async $queryRaw() { return []; },
  buddyListing: {
    async create({ data }: { data: Record<string, unknown> }) { const row = { id: `listing-${state.listings.length + 1}`, ...data }; row.applications = data.kind === "GROUP" ? [{ id: "creator", userId: data.creatorId, status: "ACCEPTED" }] : [];
      state.listings.push(row); return { id: row.id }; },
    async findUnique({ where }: { where: { id: string } }) { return state.listings.find(row => row.id === where.id) ?? null; },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) { const row = state.listings.find(row => row.id === where.id)!; Object.assign(row, data); return row; },
  },
  buddyApplication: {
    async create({ data }: { data: { listingId: string; userId: string; contactDetails?: string } }) {
      const row = state.listings.find(row => row.id === data.listingId)!;
      const application = { id: `application-${applications(row).length}`, ...data, status: "PENDING" };
      applications(row).push(application); return application;
    },
    async findFirst({ where }: { where: { id: string; listingId: string } }) { const row = state.listings.find(row => row.id === where.listingId); return row ? applications(row).find(a => a.id === where.id) ?? null : null; },
    async count({ where }: { where: { listingId: string; status: string } }) { const row = state.listings.find(row => row.id === where.listingId)!; return applications(row).filter(a => a.status === where.status).length; },
    async update({ where, data }: { where: { id: string }; data: { status: string } }) { const application = state.listings.flatMap(applications).find(a => a.id === where.id)!; Object.assign(application, data); return application; },
    async updateMany({ where, data }: { where: { listingId: string; status: string }; data: { status: string } }) { const row = state.listings.find(row => row.id === where.listingId)!; for (const a of applications(row).filter(a => a.status === where.status)) Object.assign(a, data); },
  },
  productivityRequest: {
    async findUnique({ where }: { where: { ownerId_key: { ownerId: string; key: string } } }) { return state.receipts.find(row => row.ownerId === where.ownerId_key.ownerId && row.key === where.ownerId_key.key) ?? null; },
    async create({ data }: { data: Record<string, unknown> }) { state.receipts.push(data); return data; },
  },
};
mock.module("@/lib/prisma", { namedExports: { prisma: {
  async $transaction(work: (client: typeof tx) => Promise<unknown>) {
    const before = structuredClone(state);
    try { return await work(tx); } catch (error) { state = before; throw error; }
  },
} } });
mock.module("@/services/productivity-layer/assistant/store", { namedExports: {
  json: (value: unknown) => JSON.parse(JSON.stringify(value)),
  lockOwner: async () => {},
} });
mock.module("@/services/marketplace/notifications/notification.service", { namedExports: {
  createNotification: async () => { notifications++; },
} });
let executeBuddyMutation: typeof import("@/services/productivity-layer/assistant/buddy").executeBuddyMutation;
let buddySnapshot: typeof import("@/services/productivity-layer/assistant/buddy").buddySnapshot;
let buddyWriteTools: Set<string>;
let validateTool: typeof import("@/services/productivity-layer/assistant/schema").validateTool;
before(async () => {
  ({ executeBuddyMutation, buddySnapshot, buddyWriteTools } = await import("@/services/productivity-layer/assistant/buddy"));
  ({ validateTool } = await import("@/services/productivity-layer/assistant/schema"));
});
const hooks = { async authorize() {}, async commit() { state.commits++; } };
const input = { title: "Biology", description: "Study together", invitation_url: "https://t.me/+abcdef123", max_members: 3 };

it("commits buddy creation and receipt together and replays without a duplicate", async () => {
  state = { listings: [], receipts: [], commits: 0 };
  const result = await executeBuddyMutation("student-A", "create_buddy_group", input, "request-1", "hash-1", hooks);
  assert.deepEqual(result, { id: "listing-1", message: "Group listing created." });
  assert.equal(state.listings.length, 1);
  assert.equal(state.receipts.length, 1);
  assert.equal(state.commits, 1);
  await executeBuddyMutation("student-A", "create_buddy_group", input, "request-1", "hash-1", hooks);
  assert.equal(state.listings.length, 1);
  assert.equal(state.commits, 2);
  assert.equal(notifications, 0);
  await assert.rejects(executeBuddyMutation("student-A", "create_buddy_group", input, "request-1", "different-hash", hooks));
});
it("rolls back the domain write and receipt when execution persistence fails", async () => {
  state = { listings: [], receipts: [], commits: 0 };
  await assert.rejects(executeBuddyMutation("student-A", "create_buddy_group", input, "request-2", "hash-2", {
    async authorize() {}, async commit() { throw new Error("Simulated execution failure"); },
  }));
  assert.equal(state.listings.length, 0);
  assert.equal(state.receipts.length, 0);
});
it("rejects unauthorized execution, unsupported actions and invalid invitation URLs before saving", async () => {
  state = { listings: [], receipts: [], commits: 0 };
  await assert.rejects(executeBuddyMutation("student-A", "create_buddy_group", input, "request-3", "hash-3", {
    async authorize() { throw new Error("Expired delegation"); }, async commit() {},
  }));
  await assert.rejects(executeBuddyMutation("student-A", "remove_buddy_member", {}, "request-4", "hash-4", hooks));
  await assert.rejects(executeBuddyMutation("student-A", "create_buddy_group", { ...input, invitation_url: "https://evil.test/invite" }, "request-5", "hash-5", hooks));
  assert.equal(state.listings.length, 0);
  assert.equal(state.receipts.length, 0);
});
it("uses listing ownership and application membership for confirmation snapshots", async () => {
  const listing = { id: "listing-1", creatorId: "student-A", title: "Biology", status: "OPEN", kind: "GROUP", maxMembers: 3 };
  let application: Record<string, unknown> | null = { id: "application-1", userId: "student-B", status: "PENDING" };
  const client = {
    $queryRaw: async () => [],
    buddyListing: { findUnique: async () => listing },
    buddyApplication: { count: async () => 1, findFirst: async () => application, findUnique: async () => null },
  } as unknown as Parameters<typeof buddySnapshot>[0];
  await assert.rejects(buddySnapshot(client, "student-B", "close_buddy_listing", { listing_id: listing.id }));
  await assert.rejects(buddySnapshot(client, "student-A", "apply_buddy", { listing_id: listing.id }));
  const snapshot = await buddySnapshot(client, "student-A", "accept_buddy_application", { listing_id: listing.id, application_id: "application-1" });
  assert.equal("memberCount" in snapshot && snapshot.memberCount, 1);
  application = null;
  await assert.rejects(buddySnapshot(client, "student-A", "accept_buddy_application", { listing_id: listing.id, application_id: "other-listing-application" }));
});
it("validates buddy schemas without caller-controlled identity or unsupported operations", () => {
  validateTool("create_buddy_group", input);
  assert.throws(() => validateTool("create_buddy_group", { ...input, userId: "student-B" }));
  assert.throws(() => validateTool("list_buddies", { view: "private" }));
  assert.throws(() => validateTool("accept_buddy_application", { listing_id: "listing-1" }));
  assert.throws(() => validateTool("create_buddy_request", { title: "Study", description: "Together" }));
  assert.equal(buddyWriteTools.size, 6);
});

it("applies and accepts using existing capacity rules, notifies once per receipt, and closes the group", async () => {
  state = { listings: [], receipts: [], commits: 0 }; notifications = 0;
  await executeBuddyMutation("student-A", "create_buddy_group", { ...input, max_members: 2 }, "flow-create", "create", hooks);
  const args = { listing_id: "listing-1" };
  await executeBuddyMutation("student-B", "apply_buddy", args, "flow-apply", "apply", hooks);
  assert.equal(notifications, 1);
  await executeBuddyMutation("student-B", "apply_buddy", args, "flow-apply", "apply", hooks);
  assert.equal(notifications, 1);
  const application = applications(state.listings[0]).find(a => a.userId === "student-B")!;
  await assert.rejects(executeBuddyMutation("student-B", "accept_buddy_application", { ...args, application_id: application.id }, "flow-denied", "denied", hooks));
  await executeBuddyMutation("student-A", "accept_buddy_application", { ...args, application_id: application.id }, "flow-accept", "accept", hooks);
  assert.equal(state.listings[0].status, "FULL");
  assert.equal(notifications, 2);
  await assert.rejects(executeBuddyMutation("student-C", "apply_buddy", args, "flow-full", "full", hooks));
  await executeBuddyMutation("student-A", "close_buddy_listing", args, "flow-close", "close", hooks);
  assert.equal(state.listings[0].status, "CLOSED");
});
it("requires request contact details and declines pending applicants without matching them", async () => {
  state = { listings: [], receipts: [], commits: 0 }; notifications = 0;
  await executeBuddyMutation("student-A", "create_buddy_request", { title: "Study", description: "Biology", contact_details: "Owner contact" }, "request-create", "create", hooks);
  await assert.rejects(executeBuddyMutation("student-B", "apply_buddy", { listing_id: "listing-1" }, "request-no-contact", "no-contact", hooks));
  await executeBuddyMutation("student-B", "apply_buddy", { listing_id: "listing-1", contact_details: "Applicant contact" }, "request-apply", "apply", hooks);
  const application = applications(state.listings[0])[0];
  await executeBuddyMutation("student-A", "decline_buddy_application", { listing_id: "listing-1", application_id: application.id }, "request-decline", "decline", hooks);
  assert.equal(application.status, "DECLINED");
  assert.equal(state.listings[0].status, "OPEN");
});
