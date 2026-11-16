import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/marketplace-admin";
import { runController, readJsonBody } from "@/lib/marketplace-controller-helpers";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/service-error";
import { moneyKobo } from "@/services/marketplace/pricing/business-pricing";
import { lockRosterOperation } from "@/services/marketplace/delivery-roster/roster-capacity";
type Context = {
    params: Promise<{
        businessId: string;
    }>;
};
export async function GET(_request: NextRequest, ctx: Context) {
    return runController(async () => {
        await requireAdmin();
        const { businessId } = await ctx.params;
        const business = await prisma.business.findUnique({ where: { id: businessId } });
        if (business?.type !== "BUSINESS")
            throw badRequest("Business delivery pricing applies only to businesses.");
        const [slots, prices, settings] = await Promise.all([prisma.centralDeliverySlot.findMany({ orderBy: { windowStart: "asc" } }), prisma.businessDeliveryPrice.findMany({ where: { businessId } }), prisma.businessPricingSettings.findUniqueOrThrow({ where: { id: "default" } })]);
        return NextResponse.json({ slots, prices, serviceFee: settings.serviceFeeKobo / 100 });
    });
}
export async function PUT(request: NextRequest, ctx: Context) {
    return runController(async () => {
        const admin = await requireAdmin();
        const { businessId } = await ctx.params;
        const body = await readJsonBody<{
            prices: {
                slotId: string;
                fee: number;
                active: boolean;
            }[];
            serviceFee?: number;
        }>(request);
        if (!body || !Array.isArray(body.prices) || body.prices.some(p=>!p || typeof p!=="object") || new Set(body.prices.map(p => p.slotId)).size !== body.prices.length)
            throw badRequest("Invalid or duplicate ranges.");
        await prisma.$transaction(async (tx) => {
            await lockRosterOperation(tx, "MARKETPLACE");
            const business = await tx.business.findUnique({ where: { id: businessId } });
            if (business?.type !== "BUSINESS")
                throw badRequest("Business not found.");
            for (const p of body.prices) {
                if (typeof p.fee !== "number" || typeof p.active !== "boolean" || typeof p.slotId !== "string")
                    throw badRequest("Invalid price.");
                const slot = await tx.centralDeliverySlot.findUnique({ where: { id: p.slotId } });
                if (!slot)
                    throw badRequest("Unknown existing range.");
                const previous = await tx.businessDeliveryPrice.findUnique({ where: { businessId_slotId: { businessId, slotId: p.slotId } } });
                const feeKobo = moneyKobo(p.fee);
                await tx.businessDeliveryPrice.upsert({ where: { businessId_slotId: { businessId, slotId: p.slotId } }, create: { businessId, slotId: p.slotId, feeKobo, active: p.active }, update: { feeKobo, active: p.active } });
                await tx.adminActionLog.create({ data: { adminId: admin.user.id, action: "BUSINESS_DELIVERY_PRICE_CHANGED", targetType: "Business", targetId: businessId, message: JSON.stringify({ slotId: p.slotId, previous, new: { feeKobo, active: p.active } }) } });
            }
            if (body.serviceFee !== undefined) {
                if (typeof body.serviceFee !== "number")
                    throw badRequest("Invalid service fee.");
                const previous = await tx.businessPricingSettings.findUniqueOrThrow({ where: { id: "default" } });
                const serviceFeeKobo = moneyKobo(body.serviceFee);
                await tx.businessPricingSettings.update({ where: { id: "default" }, data: { serviceFeeKobo, updatedBy: admin.user.id } });
                await tx.adminActionLog.create({ data: { adminId: admin.user.id, action: "BUSINESS_SERVICE_FEE_CHANGED", targetType: "BusinessPricingSettings", targetId: "default", message: JSON.stringify({ previous: previous.serviceFeeKobo, serviceFeeKobo }) } });
            }
        });
        return NextResponse.json({ saved: true });
    });
}
