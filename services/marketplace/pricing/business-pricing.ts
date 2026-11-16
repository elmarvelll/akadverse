import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Db } from "@/services/marketplace/order/shared/db";
import { badRequest, conflict } from "@/lib/service-error";
import { getCartForUser } from "@/services/marketplace/cart/get-cart-for-user";
import { findCentralSlot } from "@/services/marketplace/delivery-roster/central-scheduling";
import { usageKey, type OccurrenceUsage } from "@/services/marketplace/delivery-roster/roster-capacity";
export function moneyKobo(value: number): number {
    const result = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(result) || result > 2147483647 || Math.abs(value * 100 - result) > 0.00001)
        throw badRequest("Amounts must be non-negative with at most two decimal places.");
    return result;
}
export type DeliverySelections = Record<string, string>;
export async function calculateBusinessQuote(userId: string, selections: DeliverySelections = {}, db: Db = prisma) {
    if (!selections || typeof selections !== "object" || Array.isArray(selections) || Object.values(selections).some((v) => typeof v !== "string"))
        throw badRequest("Invalid delivery selections.");
    const items = await getCartForUser(userId, db);
    const settings = await db.businessPricingSettings.findUniqueOrThrow({ where: { id: "default" } });
    const now = new Date();
    const projected = new Map<string, OccurrenceUsage>();
    const groups = [];
    for (const businessId of new Set(items.map((i) => i.businessId))) {
        const lines = items.filter((i) => i.businessId === businessId);
        const business = await db.business.findUnique({ where: { id: businessId } });
        if (!business || business.type !== "BUSINESS" || business.approvalStatus !== "APPROVED" || business.blocked)
            throw conflict("This business is not accepting orders.");
        const prices = await db.businessDeliveryPrice.findMany({ where: { businessId, active: true }, orderBy: { slotId: "asc" } });
        const options = [];
        for (const price of prices) {
            const plan = await findCentralSlot(businessId, db, now, projected, [price.slotId]);
            if (plan && plan !== "full")
                options.push({ slotId: price.slotId, label: `${plan.slot.label} (${plan.slot.windowStart}–${plan.slot.windowEnd})`, date: plan.date.toISOString(), feeKobo: price.feeKobo, plan });
        }
        const balanced = await findCentralSlot(businessId, db, now, projected, prices.map(p => p.slotId));
        const selected = selections[businessId] ? options.find((o) => o.slotId === selections[businessId]) : options.find(o => balanced && balanced !== "full" && o.slotId === balanced.slot.id);
        if (selections[businessId] && !selected)
            throw conflict("Selected delivery range is unavailable or has no active pricing.");
        const subtotalKobo = lines.reduce((sum, i) => {
            if (!Number.isInteger(i.quantity) || i.quantity < 1)
                throw badRequest("Invalid quantity.");
            return sum + moneyKobo(i.price) * i.quantity;
        }, 0);
        if (selected) {
            const key = usageKey(selected.slotId, selected.plan.date);
            const current = projected.get(key) ?? { paid: 0, pending: 0, overflow: 0 };
            projected.set(key, { ...current, pending: current.pending + 1, overflow: (current.overflow ?? 0) + Number(selected.plan.isOverflow) });
        }
        groups.push({ businessId, businessName: lines[0].sellerName, subtotalKobo, deliveryFeeKobo: selected?.feeKobo ?? null, selectedSlotId: selected?.slotId ?? null, date: selected?.date ?? null, options: options.map(o => ({ slotId: o.slotId, label: o.label, date: o.date, feeKobo: o.feeKobo })), plan: selected?.plan ?? null });
    }
    const subtotalKobo = groups.reduce((s, g) => s + g.subtotalKobo, 0);
    const deliveryFeeKobo = groups.reduce((s, g) => s + (g.deliveryFeeKobo ?? 0), 0);
    const totalKobo = subtotalKobo + deliveryFeeKobo + settings.serviceFeeKobo;
    if (!Number.isSafeInteger(totalKobo) || totalKobo > 2147483647)
        throw badRequest("Checkout amount exceeds the supported limit.");
    const available = groups.length > 0 && groups.every((g) => g.plan !== null);
    const token = createHash("sha256").update(JSON.stringify({ userId, items, groups: groups.map(g => ({ businessId: g.businessId, subtotalKobo: g.subtotalKobo, deliveryFeeKobo: g.deliveryFeeKobo, selectedSlotId: g.selectedSlotId, date: g.date })), serviceFeeKobo: settings.serviceFeeKobo })).digest("hex");
    return { items, groups, subtotalKobo, deliveryFeeKobo, serviceFeeKobo: settings.serviceFeeKobo, totalKobo, available, token };
}
