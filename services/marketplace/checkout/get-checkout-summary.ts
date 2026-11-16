import { prisma } from "@/lib/prisma";
import { calculateBusinessQuote, type DeliverySelections } from "@/services/marketplace/pricing/business-pricing";
export async function getCheckoutSummary(userId: string, selections: DeliverySelections = {}) {
    const q = await calculateBusinessQuote(userId, selections);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { location: true } });
    return { items: q.items.map(i => { const g = q.groups.find(g => g.businessId === i.businessId)!; return { ...i, estimatedDeliveryDate: g.date?.slice(0, 10) ?? "Unavailable", deliveryWindow: g.plan ? `${clock(g.plan.slot.windowStart)} - ${clock(g.plan.slot.windowEnd)}` : "Pricing unavailable" }; }), location: user?.location ?? "", subtotal: q.subtotalKobo / 100, deliveryFee: q.deliveryFeeKobo / 100, serviceFee: q.serviceFeeKobo / 100, total: q.totalKobo / 100, available: q.available, quoteToken: q.token, businesses: q.groups.map(g => ({ businessId: g.businessId, businessName: g.businessName, subtotalKobo: g.subtotalKobo, deliveryFeeKobo: g.deliveryFeeKobo, selectedSlotId: g.selectedSlotId, date: g.date, options: g.options })) };
}
export type CheckoutSummary = Awaited<ReturnType<typeof getCheckoutSummary>>;
function clock(value: string) { const [h, m] = value.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; }
