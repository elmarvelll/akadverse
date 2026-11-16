import "../helpers/env";
import { signInAs } from "../helpers/session";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveSession } from "@/lib/marketplace-session";
import { requireAdmin } from "@/lib/marketplace-admin";
import { blockUser, unblockUser } from "@/services/marketplace/admin/block-user";
import { makeUser } from "../helpers/fixtures";
import { installFakeProviders, resend } from "../helpers/fake-providers";
import { ServiceError } from "@/lib/service-error";
import { listMarketplaceNotifications } from "@/app/api/marketplace/notifications/route.controller";
import { GET as notificationStream } from "@/app/api/marketplace/notifications/stream/route";
import { initializeCheckout } from "@/app/api/marketplace/checkout/initialize/route.controller";
import { initializeVendorCheckout } from "@/app/api/marketplace/vendor-checkout/initialize/route.controller";
import { NextRequest } from "next/server";

before(() => installFakeProviders());
beforeEach(() => { signInAs(null); resend.reset(); });
after(() => prisma.$disconnect());
const status = (n: number) => (error: unknown) => error instanceof ServiceError && error.status === n;
describe("Marketplace integration access boundaries", () => {
  it("denies a missing or non-student account while retaining core authentication", async () => {
    assert.equal(await getActiveSession(), null);
    const user = await makeUser(); signInAs(user);
    await prisma.user.update({ where: { id: user.id }, data: { role: "faculty" } });
    await assert.rejects(getActiveSession(), status(403));
    assert.equal((await getServerSession(authOptions))?.user.id, user.id);
  });
  it("blocks an existing Marketplace session immediately, preserves the core session, and restores access on unblock", async () => {
    const user = await makeUser(), admin = await makeUser({ isAdmin: true });
    signInAs(user); assert.equal((await getActiveSession())?.user.id, user.id);
    await blockUser(user.id, "Marketplace rule violation", admin.id);
    assert.equal((await listMarketplaceNotifications()).status, 403);
    assert.equal((await notificationStream(new NextRequest("https://akadverse.test/api/marketplace/notifications/stream"))).status, 403);
    assert.equal((await getServerSession(authOptions))?.user.id, user.id);
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 1);
    assert.equal(resend.sent.length, 1);
    await blockUser(user.id, "Duplicate request", admin.id);
    assert.equal(resend.sent.length, 1);
    await unblockUser(user.id, admin.id);
    assert.equal((await getActiveSession())?.user.id, user.id);
  });
  it("rechecks admin grants rather than accepting a stale session flag", async () => {
    const admin = await makeUser({ isAdmin: true }); signInAs(admin);
    assert.equal((await requireAdmin()).user.id, admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: false } });
    await assert.rejects(requireAdmin(), status(403));
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true, role: "faculty" } });
    assert.equal((await requireAdmin()).user.id, admin.id, "AkadVerse admin access is independent of academic role");
  });
  it("protects self/admin accounts from Marketplace blocking", async () => {
    const admin = await makeUser({ isAdmin: true }), other = await makeUser({ isAdmin: true });
    await assert.rejects(blockUser(admin.id, "reason", admin.id), status(400));
    await assert.rejects(blockUser(other.id, "reason", admin.id), status(409));
  });
  it("rejects malformed checkout shapes with 400 before reserving stock or scheduling payment work", async () => {
    signInAs(await makeUser());
    const request = (body: unknown) => new NextRequest("https://akadverse.test/api/marketplace/checkout/initialize", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    for (const body of [null, [], { location: 42 }, { quoteToken: {} }]) assert.equal((await initializeCheckout(request(body))).status, 400);
    for (const body of [null, [], { slotId: 42 }, { slotId: "slot", date: [] }, { slotId: "slot", location: 42 }]) assert.equal((await initializeVendorCheckout(request(body))).status, 400);
  });
});
