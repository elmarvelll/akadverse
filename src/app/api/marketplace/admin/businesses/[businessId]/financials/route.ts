import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/marketplace-admin";
import { runController } from "@/lib/marketplace-controller-helpers";
import { prisma } from "@/lib/prisma";
export async function GET(_r: NextRequest, { params }: {
    params: Promise<{
        businessId: string;
    }>;
}) {
    return runController(async () => {
        await requireAdmin();
        const { businessId } = await params;
        const orders = await prisma.order.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, paystackReference: true, paymentStatus: true, totalAmount: true } });
        const snapshots = await prisma.checkoutFinancialSnapshot.findMany({ where: { reference: { in: orders.flatMap(o => o.paystackReference ? [o.paystackReference] : []) } } });
        const payments = await prisma.checkoutPayment.findMany({ where: { reference: { in: snapshots.map(s => s.reference) } }, select: { reference: true, status: true, amountKobo: true, currency: true, paidAt: true } });
        return NextResponse.json({ orders, snapshots, payments });
    });
}
