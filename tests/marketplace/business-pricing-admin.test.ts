import "../helpers/env";
import { signInAs } from "../helpers/session";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeUser, businessCheckoutScenario } from "../helpers/fixtures";
import { GET, PUT } from "@/app/api/marketplace/admin/businesses/[businessId]/pricing/route";
after(() => prisma.$disconnect());
describe("admin business delivery pricing", () => {
    it("requires admin access, validates fees, isolates businesses and records changes", async () => {
        const a = await businessCheckoutScenario(), b = await businessCheckoutScenario();
        const admin = await makeUser({ isAdmin: true });
        const slot = await prisma.centralDeliverySlot.create({ data: { label: "Admin pricing test", windowStart: "17:00", windowEnd: "18:00" } });
        const context = { params: Promise.resolve({ businessId: a.business.id }) };
        const request = (fee: number) => new NextRequest("https://akadverse.test/api/pricing", { method: "PUT", body: JSON.stringify({ prices: [{ slotId: slot.id, fee, active: true }] }) });
        signInAs(null);
        assert.equal((await GET(request(550), context)).status, 401);
        signInAs(a.owner);
        assert.equal((await PUT(request(550), context)).status, 403);
        signInAs(a.buyer);
        assert.equal((await PUT(request(550), context)).status, 403);
        signInAs(admin);
        assert.equal((await PUT(request(-1), context)).status, 400);
        assert.equal((await PUT(request(550), context)).status, 200);
        assert.equal((await PUT(request(700), context)).status, 200);
        assert.equal(await prisma.businessDeliveryPrice.count({ where: { businessId: a.business.id, slotId: slot.id } }), 1);
        assert.equal((await prisma.businessDeliveryPrice.findUniqueOrThrow({ where: { businessId_slotId: { businessId: a.business.id, slotId: slot.id } } })).feeKobo, 70000);
        assert.equal(await prisma.businessDeliveryPrice.count({ where: { businessId: b.business.id } }), 0);
        assert.equal(await prisma.adminActionLog.count({ where: { targetId: a.business.id, action: "BUSINESS_DELIVERY_PRICE_CHANGED" } }), 2);
        const response = await GET(request(0), context);
        assert.equal(response.status, 200);
        assert.ok((await response.json()).slots.some((s: {
            id: string;
        }) => s.id === slot.id));
    });
});
