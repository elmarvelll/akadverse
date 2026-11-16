import "../helpers/env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { businessCheckoutScenario, addToCart } from "../helpers/fixtures";
import { calculateBusinessQuote, moneyKobo } from "@/services/marketplace/pricing/business-pricing";
import { createOrdersForCheckout } from "@/services/marketplace/checkout/create-orders-for-checkout";
import { installFakeProviders, paystack } from "../helpers/fake-providers";
import { reconcileCheckoutPayment } from "@/services/marketplace/checkout/reconcile-checkout-payment";
before(() => installFakeProviders());
after(() => prisma.$disconnect());
async function priced(price = 3000) { const s = await businessCheckoutScenario({ price, quantity: 1 }); const slot = await prisma.centralDeliverySlot.create({ data: { label: "Pricing test", windowStart: "17:00", windowEnd: "18:00" } }); await prisma.businessDeliveryPrice.create({ data: { businessId: s.business.id, slotId: slot.id, feeKobo: 70000 } }); return { ...s, slot }; }
describe("business delivery financial integrity", () => {
    it("rejects invalid monetary values", () => { for (const v of [-1, NaN, Infinity, 0.001])
        assert.throws(() => moneyKobo(v)); assert.equal(moneyKobo(550.25), 55025); });
    it("blocks missing pricing and duplicate configurations", async () => { const s = await businessCheckoutScenario(); const q = await calculateBusinessQuote(s.buyer.id); assert.equal(q.available, false); await assert.rejects(createOrdersForCheckout(s.buyer.id, "Hall", {}, q.token)); const p = await priced(); await assert.rejects(prisma.businessDeliveryPrice.create({ data: { businessId: p.business.id, slotId: p.slot.id, feeKobo: 1 } })); });
    it("calculates 3850, requires reviewed quote, preserves snapshots and verifies payment idempotently", async () => {
        const s = await priced();
        let q = await calculateBusinessQuote(s.buyer.id);
        assert.equal(q.totalKobo, 385000);
        await assert.rejects(createOrdersForCheckout(s.buyer.id, "Hall"));
        await prisma.businessDeliveryPrice.update({ where: { businessId_slotId: { businessId: s.business.id, slotId: s.slot.id } }, data: { feeKobo: 85000 } });
        await assert.rejects(createOrdersForCheckout(s.buyer.id, "Hall", {}, q.token), /changed/);
        q = await calculateBusinessQuote(s.buyer.id);
        const init = await createOrdersForCheckout(s.buyer.id, "Hall", {}, q.token);
        assert.equal(init.amountKobo, 400000);
        const snapshot = await prisma.checkoutFinancialSnapshot.findUniqueOrThrow({ where: { reference: init.reference } });
        assert.equal(snapshot.serviceFeeKobo, 15000);
        assert.equal(snapshot.totalKobo, init.amountKobo);
        await prisma.businessDeliveryPrice.update({ where: { businessId_slotId: { businessId: s.business.id, slotId: s.slot.id } }, data: { feeKobo: 100 } });
        assert.deepEqual(await prisma.checkoutFinancialSnapshot.findUniqueOrThrow({ where: { reference: init.reference } }), snapshot);
        paystack.set(init.reference, { status: "success", amount: init.amountKobo });
        assert.equal((await reconcileCheckoutPayment(init.reference, "verify")).state, "paid");
        assert.equal((await reconcileCheckoutPayment(init.reference, "verify")).state, "paid");
        assert.equal(await prisma.order.count({ where: { paystackReference: init.reference } }), 1);
    });
    it("prices two businesses independently and charges one service fee", async () => { const a = await priced(3000), b = await priced(2000); await prisma.businessDeliveryPrice.update({ where: { businessId_slotId: { businessId: b.business.id, slotId: b.slot.id } }, data: { feeKobo: 55000 } }); await addToCart(a.buyer.id, b.product.id, 1); const q = await calculateBusinessQuote(a.buyer.id); assert.equal(q.groups.length, 2); assert.equal(q.totalKobo, 640000); const init = await createOrdersForCheckout(a.buyer.id, "Hall", {}, q.token); assert.equal(init.amountKobo, 640000); const snapshot = await prisma.checkoutFinancialSnapshot.findUniqueOrThrow({ where: { reference: init.reference } }); assert.equal(snapshot.serviceFeeKobo, 15000); assert.equal(snapshot.deliveryFeeKobo, 125000); });
    it("switches existing ranges and rejects inactive, foreign or disabled prices", async () => { const s = await priced(); const slot = await prisma.centralDeliverySlot.create({ data: { label: "Later", windowStart: "18:00", windowEnd: "19:00" } }); await prisma.businessDeliveryPrice.create({ data: { businessId: s.business.id, slotId: slot.id, feeKobo: 55000 } }); let q = await calculateBusinessQuote(s.buyer.id, { [s.business.id]: slot.id }); assert.equal(q.totalKobo, 370000); await prisma.businessDeliveryPrice.update({ where: { businessId_slotId: { businessId: s.business.id, slotId: slot.id } }, data: { active: false } }); await assert.rejects(calculateBusinessQuote(s.buyer.id, { [s.business.id]: slot.id })); await assert.rejects(calculateBusinessQuote(s.buyer.id, { [s.business.id]: "foreign" })); await prisma.centralDeliverySlot.update({ where: { id: s.slot.id }, data: { active: false } }); q = await calculateBusinessQuote(s.buyer.id); assert.equal(q.available, false); });
});
