// Existing payment/lifecycle tests opt into explicit zero-priced ranges. Pricing-specific
// tests use production services directly and cover missing/nonzero/inactive fees.
import { prisma } from "@/lib/prisma";
import { createOrdersForCheckout as create } from "@/services/marketplace/checkout/create-orders-for-checkout";
import { getCheckoutSummary as summary } from "@/services/marketplace/checkout/get-checkout-summary";
import { calculateBusinessQuote } from "@/services/marketplace/pricing/business-pricing";
async function configure(userId: string) {
    const cart = await prisma.cartItem.findMany({ where: { userId }, select: { product: { select: { businessId: true } } } });
    let slots = await prisma.centralDeliverySlot.findMany({ where: { active: true } });
    if (!slots.length)
        slots = [await prisma.centralDeliverySlot.create({ data: { label: "Test delivery", windowStart: "17:00", windowEnd: "20:30" } })];
    for (const businessId of new Set(cart.flatMap(c => c.product ? [c.product.businessId] : [])))
        for (const slot of slots)
            await prisma.businessDeliveryPrice.createMany({data:[{businessId,slotId:slot.id,feeKobo:0}],skipDuplicates:true});
}
export async function createOrdersForCheckout(userId: string, location: string) {
    await configure(userId);
    for (let attempt = 0; ; attempt++) {
        const quote = await calculateBusinessQuote(userId);
        try { return await create(userId, location, {}, quote.token); }
        catch (error) {
            // These tests exercise lifecycle/capacity, with the test buyer explicitly
            // accepting refreshed quotes. Production UI requires a second click.
            if (attempt >= 10 || !(error instanceof Error) || !/changed/.test(error.message)) throw error;
        }
    }
}
export async function getCheckoutSummary(userId: string) { await configure(userId); return summary(userId); }
export { EmptyCartError } from "@/services/marketplace/checkout/create-orders-for-checkout";
